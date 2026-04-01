import iconv from 'iconv-lite';
import { BankConverterConfig } from '../constants/bankConverterConfig';
import { BankConverterExcelConfig } from '../constants/bankConverterExcelConfig';
import { logger } from './LoggerService';
import {
  extractCommeetWireExportRows,
  readCommeetSheetMatrix,
} from '../../utils/commeetBankExcelParse';
import {
  groupCommeetWireRowsByPayeeName,
  normalizePayeeName,
  sumAmount14Strings,
} from '../../utils/bankWireMerge';
import { isSpecialPayeeCompany } from '../../utils/specialPayeeCompany';
import type { BankWireLedgerRow } from './BankWireExportLogService';

interface ParsedBankLine {
  date: string;
  transType: string;
  bankCode: string;
  payerAccountDigits: string;
  serial: string;
  amount17: string;
  payeeAccountDigits: string;
  receiveNameBytes: Buffer;
  receiveNameText: string; // 新增：收款人戶名文字（用於手續費計算）
}

/**
 * Commeet「付款資料」Excel -> 國泰整批付款 receive.txt 固定寬度格式轉換服務
 */
export class BankConverterService {
  private positions = BankConverterConfig.FIELD_POSITIONS;
  private lineLength = BankConverterConfig.LINE_LENGTH;

  private static warnMergedGroupBank3Mismatch(params: {
    formNo: string;
    payeeName: string;
    bank3: string;
    firstBank3: string;
  }) {
    logger.warn('合併群組內收款行末三碼不一致，TXT 採用首列', params);
  }

  /**
   * 產生固定寬度輸出行（361 bytes）
   */
  private convertLine(parsed: ParsedBankLine): Buffer {
    // 建立 361 bytes 的空白行（全部填空白）
    const out = Buffer.alloc(this.lineLength, 0x20); // 0x20 = 空格

    const pos = this.positions;

    // 識別代碼 [0]
    out.write('0', pos.RECORD_TYPE.start, 1, 'ascii');

    // 預定交易日期 [9..16] (8)：固定使用當前日期（YYYYMMDD）
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const currentDate = `${year}${month}${day}`;
    const outDate = currentDate.padEnd(8, ' ').slice(0, 8);
    out.write(outDate, pos.TRANS_DATE.start, pos.TRANS_DATE.length, 'ascii');

    // 交易類別 [17..19] (3) SPU/TRN
    out.write(
      parsed.transType.padEnd(3, ' ').slice(0, 3),
      pos.TRANS_TYPE.start,
      pos.TRANS_TYPE.length,
      'ascii'
    );

    // 1) 帳號格式轉換：付款行代碼(7) + 付款人帳號(16)
    // 付款行代碼 [30..36]：0130000
    const payerBankCode = (parsed.bankCode + '0000').slice(0, 7);
    out.write(
      payerBankCode,
      pos.PAYER_BANK_CODE.start,
      pos.PAYER_BANK_CODE.length,
      'ascii'
    );

    // 付款人帳號 [37..52]：最多 16 位，右補空白
    const payerAcc16 = parsed.payerAccountDigits.slice(0, 16).padEnd(16, ' ');
    out.write(
      payerAcc16,
      pos.PAYER_ACCOUNT.start,
      pos.PAYER_ACCOUNT.length,
      'ascii'
    );

    // 交易序號 [53..60] (8)
    out.write(
      parsed.serial.padEnd(8, ' ').slice(0, 8),
      pos.SERIAL.start,
      pos.SERIAL.length,
      'ascii'
    );

    // 3) 付款人戶名 [63..132] (70 bytes)：從 constants 讀取（已是 Big5 bytes）
    BankConverterConfig.PAYER_NAME_BYTES.copy(out, pos.PAYER_NAME.start);

    // 2) 金額欄位合併（保持原始金額不變）：
    // currency [133..135] = TWD
    out.write('TWD', pos.CURRENCY.start, pos.CURRENCY.length, 'ascii');

    // sign [136] = +
    out.write('+', pos.AMOUNT_SIGN.start, pos.AMOUNT_SIGN.length, 'ascii');

    // amount [137..150] = 14 digits（使用原始金額，從 amount17 前14位提取）
    const originalAmount14 = parsed.amount17.slice(0, 14).padStart(14, '0');
    out.write(originalAmount14, pos.AMOUNT.start, pos.AMOUNT.length, 'ascii');

    // 收款行代碼 [151..157]：amount17 後3位 + 0000（例：0130000）
    const payeeBank3 = parsed.amount17.slice(14, 17);
    const payeeBankCode = (payeeBank3 + '0000').slice(0, 7);
    out.write(
      payeeBankCode,
      pos.PAYEE_BANK_CODE.start,
      pos.PAYEE_BANK_CODE.length,
      'ascii'
    );

    // 收款人帳號 [158..173]：最多 16 位，右補空白
    const payeeAcc16 = parsed.payeeAccountDigits.slice(0, 16).padEnd(16, ' ');
    out.write(
      payeeAcc16,
      pos.PAYEE_ACCOUNT.start,
      pos.PAYEE_ACCOUNT.length,
      'ascii'
    );

    // 收款人戶名 [184..253] (70 bytes)：用原檔 bytes 填入，右補空白到 70 bytes
    const nameBytes =
      parsed.receiveNameBytes.length > pos.PAYEE_NAME.length
        ? parsed.receiveNameBytes.subarray(0, pos.PAYEE_NAME.length)
        : parsed.receiveNameBytes;
    nameBytes.copy(out, pos.PAYEE_NAME.start);

    // 收款人是否電告 [254]：固定為 0
    out.write(
      '0',
      pos.ELECTRONIC_NOTIFY.start,
      pos.ELECTRONIC_NOTIFY.length,
      'ascii'
    );

    // 判斷是否為特例公司，決定手續費分攤方式
    // 特例公司：台灣中油、雲一 → 手續費30元外加 → 強制使用15（外加）
    // 一般情況：一律使用13（內扣）
    const isSpecial = isSpecialPayeeCompany(parsed.receiveNameText);

    // 如果是特例公司，強制使用15（外加）；否則一律使用13（內扣）
    const handlingFeeAllocation: string = isSpecial ? '15' : '13';

    // 手續費分攤方式 [255..256] (2位)：15=外加, 13=內扣
    out.write(
      handlingFeeAllocation,
      pos.HANDLING_FEE_ALLOCATION.start,
      pos.HANDLING_FEE_ALLOCATION.length,
      'ascii'
    );

    // 最終金額 [305..310] (6位)：手續費分攤方式（前2位是13或15，後面補0到6位）
    const finalAllocation6 = handlingFeeAllocation.padEnd(6, '0');
    out.write(
      finalAllocation6,
      pos.FINAL_AMOUNT.start,
      pos.FINAL_AMOUNT.length,
      'ascii'
    );

    return out;
  }

  /**
   * Commeet「付款資料」Excel → 與 convertFileBuffer 相同之 361 bytes + CRLF 輸出
   */
  convertExcelBuffer(
    inputBuffer: Buffer,
    options?: { excludedFormNos?: Set<string> }
  ): { outputBuffer: Buffer; ledgerRows: BankWireLedgerRow[] } {
    const cfg = BankConverterExcelConfig;
    const sheet = readCommeetSheetMatrix(inputBuffer, cfg);
    if (!sheet.ok) {
      throw new Error(sheet.error);
    }

    const extracted = extractCommeetWireExportRows(sheet.jsonData, cfg);
    if (!extracted.ok) {
      throw new Error(extracted.error);
    }

    const excluded = options?.excludedFormNos ?? new Set<string>();
    let skippedExcluded = 0;
    for (const row of extracted.rows) {
      if (excluded.has(row.formNo)) skippedExcluded++;
    }

    const groups = groupCommeetWireRowsByPayeeName(extracted.rows, excluded);
    const ledgerRows: BankWireLedgerRow[] = [];
    const outLines: Buffer[] = [];

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]!;
      const mergedLineIndex = i + 1;
      const first = group[0]!;
      const amount14 = sumAmount14Strings(group.map((g) => g.amount14));

      for (const r of group) {
        if (r.payeeBank3 !== first.payeeBank3) {
          BankConverterService.warnMergedGroupBank3Mismatch({
            formNo: r.formNo,
            payeeName: r.payeeName,
            bank3: r.payeeBank3,
            firstBank3: first.payeeBank3,
          });
        }
        ledgerRows.push({
          mergedLineIndex,
          payeeName: normalizePayeeName(r.payeeName),
          payeeAccountDigits: r.accountDigits,
          bankCodeDigits: r.bankDigits,
          formNo: r.formNo,
          amountCents: parseInt(r.amount14, 10) || 0,
        });
      }

      const payeeBank3 = first.payeeBank3;
      const amount17 = amount14 + payeeBank3;
      if (amount17.length !== 17) {
        throw new Error(
          `合併後金額與收款行代碼組合異常（${first.payeeName}），請檢查金額或銀行代碼。`
        );
      }

      const receiveNameBytes = BankConverterService.encodePayeeNameBig5MaxBytes(
        first.payeeName,
        BankConverterConfig.FIELD_POSITIONS.PAYEE_NAME.length
      );

      const parsed: ParsedBankLine = {
        date: '19700101',
        transType: cfg.TRANS_TYPE,
        bankCode: cfg.PAYER_BANK_CODE_3,
        payerAccountDigits: cfg.PAYER_ACCOUNT_DIGITS.replace(/\D/g, ''),
        serial: cfg.SERIAL_FIXED,
        amount17,
        payeeAccountDigits: first.accountDigits.slice(0, 16),
        receiveNameBytes,
        receiveNameText: normalizePayeeName(first.payeeName),
      };

      outLines.push(this.convertLine(parsed));
    }

    logger.info('Excel 轉檔統計', {
      totalDataRows: extracted.totalDataRows,
      validWireRows: extracted.rows.length,
      mergeGroups: groups.length,
      outputLines: outLines.length,
      skippedNonWire: extracted.skippedNonWire,
      skippedInvalid: extracted.skippedInvalid,
      skippedExcluded,
    });

    if (outLines.length === 0) {
      if (
        extracted.rows.length > 0 &&
        skippedExcluded === extracted.rows.length
      ) {
        throw new Error(
          '已排除所有匯款列，請至少保留一筆轉檔，或取消勾選「不轉檔」。'
        );
      }
      const msg =
        `無法從 Excel 產生任何匯款列：資料列 ${extracted.totalDataRows} 筆；非匯款略過 ${extracted.skippedNonWire} 筆；匯款欄位不完整或金額錯誤 ${extracted.skippedInvalid} 筆。請確認「付款方式」為「${cfg.PAYMENT_METHOD_WIRE}」且欄位齊全。`;
      logger.error(msg);
      throw new Error(msg);
    }

    const crlf = Buffer.from([0x0d, 0x0a]);
    const outputBuffer = Buffer.concat(
      outLines.flatMap((l) => [l, crlf])
    );
    return { outputBuffer, ledgerRows };
  }

  /**
   * 收款人戶名 → Big5 bytes，至多 maxBytes，避免切斷雙位元組字元。
   */
  private static encodePayeeNameBig5MaxBytes(name: string, maxBytes: number): Buffer {
    const trimmed = name.trim();
    if (!trimmed) {
      return Buffer.alloc(0);
    }
    // Node Buffer 本身不支援 big5 編碼；以 iconv-lite 產生 Big5 bytes
    const full = iconv.encode(trimmed, 'big5') as Buffer;
    if (full.length <= maxBytes) {
      return full;
    }
    let low = 0;
    let high = trimmed.length;
    let best: Buffer = Buffer.alloc(0) as Buffer;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const slice = trimmed.slice(0, mid);
      const buf = iconv.encode(slice, 'big5') as Buffer;
      if (buf.length <= maxBytes) {
        best = buf as Buffer;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return best;
  }
}

import * as XLSX from 'xlsx';
import { BankConverterConfig } from '../constants/bankConverterConfig';
import { BankConverterExcelConfig } from '../constants/bankConverterExcelConfig';
import { isSpecialCompany } from './HandlingFeeService';
import { logger } from './LoggerService';

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
    const isSpecial = isSpecialCompany(parsed.receiveNameText);

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
  convertExcelBuffer(inputBuffer: Buffer): Buffer {
    const cfg = BankConverterExcelConfig;
    const workbook = XLSX.read(inputBuffer, { type: 'buffer' });
    const sheetName =
      workbook.SheetNames.includes(cfg.SHEET_NAME)
        ? cfg.SHEET_NAME
        : workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('Excel 檔案中沒有工作表');
    }
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error(`無法讀取工作表「${sheetName}」`);
    }

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: true,
    }) as unknown[][];

    if (!jsonData.length) {
      throw new Error('Excel 工作表為空');
    }

    const rawHeaders = jsonData[0] as unknown[];
    const headers = rawHeaders.map((h) => BankConverterService.cleanExcelHeader(h));
    const missing = cfg.REQUIRED_HEADERS.filter((req) => !headers.includes(req));
    if (missing.length > 0) {
      throw new Error(`Excel 缺少必要欄位：${missing.join('、')}`);
    }

    const idxMethod = headers.indexOf(cfg.HEADER.PAYMENT_METHOD);
    const idxPayeeName = headers.indexOf(cfg.HEADER.PAYEE_NAME);
    const idxBankCode = headers.indexOf(cfg.HEADER.BANK_CODE);
    const idxAccount = headers.indexOf(cfg.HEADER.ACCOUNT);
    const idxAmount = headers.indexOf(cfg.HEADER.AMOUNT);
    const idxFormNo = headers.indexOf(cfg.HEADER.FORM_NO);

    const dataRows = jsonData.slice(1);
    const outLines: Buffer[] = [];
    let wireCount = 0;
    let skippedNonWire = 0;
    let skippedInvalid = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!Array.isArray(row)) continue;
      if (BankConverterService.isExcelRowEmpty(row)) continue;

      const method = BankConverterService.cellString(row[idxMethod]);
      if (method !== cfg.PAYMENT_METHOD_WIRE) {
        skippedNonWire++;
        continue;
      }

      const payeeName = BankConverterService.cellString(row[idxPayeeName]).trim();
      const bankCodeRaw = row[idxBankCode];
      const accountRaw = row[idxAccount];
      const amountCell = row[idxAmount];

      const bankDigits = BankConverterService.bankCodeDigitsOnly(bankCodeRaw);
      const accountDigits = BankConverterService.accountDigitsPreserve(accountRaw);
      if (!payeeName || !bankDigits || !accountDigits || amountCell === '' || amountCell == null) {
        skippedInvalid++;
        if (skippedInvalid <= 3) {
          logger.debug('Excel 列略過（匯款但欄位不完整）', {
            rowIndex: i + 2,
            formNo: idxFormNo >= 0 ? BankConverterService.cellString(row[idxFormNo]) : '',
          });
        }
        continue;
      }

      const payeeBank3 = bankDigits.padStart(3, '0').slice(-3);
      let amount14: string;
      try {
        amount14 = BankConverterService.parseAmountToAmount14(amountCell);
      } catch (e: any) {
        skippedInvalid++;
        logger.debug('Excel 金額無法解析', {
          rowIndex: i + 2,
          message: e?.message,
        });
        continue;
      }

      const amount17 = amount14 + payeeBank3;
      if (amount17.length !== 17) {
        skippedInvalid++;
        continue;
      }

      const receiveNameBytes = BankConverterService.encodePayeeNameBig5MaxBytes(
        payeeName,
        BankConverterConfig.FIELD_POSITIONS.PAYEE_NAME.length
      );

      const parsed: ParsedBankLine = {
        date: '19700101',
        transType: cfg.TRANS_TYPE,
        bankCode: cfg.PAYER_BANK_CODE_3,
        payerAccountDigits: cfg.PAYER_ACCOUNT_DIGITS.replace(/\D/g, ''),
        serial: cfg.SERIAL_FIXED,
        amount17,
        payeeAccountDigits: accountDigits.slice(0, 16),
        receiveNameBytes,
        receiveNameText: payeeName,
      };

      outLines.push(this.convertLine(parsed));
      wireCount++;
    }

    logger.info('Excel 轉檔統計', {
      totalDataRows: dataRows.length,
      outputLines: wireCount,
      skippedNonWire,
      skippedInvalid,
    });

    if (outLines.length === 0) {
      const msg =
        `無法從 Excel 產生任何匯款列：資料列 ${dataRows.length} 筆；非匯款略過 ${skippedNonWire} 筆；匯款欄位不完整或金額錯誤 ${skippedInvalid} 筆。請確認「付款方式」為「${cfg.PAYMENT_METHOD_WIRE}」且欄位齊全。`;
      logger.error(msg);
      throw new Error(msg);
    }

    const crlf = Buffer.from([0x0d, 0x0a]);
    return Buffer.concat(outLines.flatMap((l) => [l, crlf]));
  }

  private static cleanExcelHeader(value: unknown): string {
    if (value == null || value === '') return '';
    return String(value).trim().replace(/^\*/, '');
  }

  private static isExcelRowEmpty(row: unknown[]): boolean {
    if (!row || !row.length) return true;
    return row.every(
      (c) =>
        c === null ||
        c === undefined ||
        c === '' ||
        (typeof c === 'string' && c.trim() === '')
    );
  }

  private static cellString(value: unknown): string {
    if (value == null || value === undefined) return '';
    return String(value).trim();
  }

  /** 銀行代碼：只保留數字，去空白 */
  private static bankCodeDigitsOnly(value: unknown): string {
    return BankConverterService.cellString(value).replace(/\D/g, '');
  }

  /**
   * 帳號：盡量保留前導零。若儲存格為數字型別，無法還原 Excel 文字型帳號，仍以數字字串表示。
   */
  private static accountDigitsPreserve(value: unknown): string {
    if (value == null || value === undefined) return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (Number.isInteger(value)) return String(value);
      return String(Math.trunc(value));
    }
    return String(value).replace(/[^\d]/g, '');
  }

  /**
   * 「付款金額（本幣）」→ 14 位金額字串（分，無小數點）。
   * 支援：字串 "174,000.00"；或數字 174000（視為元，*100）。
   */
  private static parseAmountToAmount14(cell: unknown): string {
    if (cell === null || cell === undefined || cell === '') {
      throw new Error('金額為空');
    }
    if (typeof cell === 'number' && Number.isFinite(cell)) {
      const cents = Math.round(cell * 100);
      if (cents < 0) throw new Error('金額不可為負');
      return String(cents).padStart(14, '0');
    }
    const s = String(cell).trim().replace(/,/g, '');
    const m = s.match(/^(\d+)\.(\d{2})$/);
    if (m && m[1] && m[2]) {
      const cents = parseInt(m[1] + m[2], 10);
      if (!Number.isFinite(cents) || cents < 0) throw new Error('金額格式錯誤');
      return String(cents).padStart(14, '0');
    }
    if (/^\d+$/.test(s)) {
      const yuan = parseInt(s, 10);
      const cents = yuan * 100;
      return String(cents).padStart(14, '0');
    }
    throw new Error(`無法解析金額：${s}`);
  }

  /**
   * 收款人戶名 → Big5 bytes，至多 maxBytes，避免切斷雙位元組字元。
   */
  private static encodePayeeNameBig5MaxBytes(name: string, maxBytes: number): Buffer {
    const trimmed = name.trim();
    if (!trimmed) {
      return Buffer.alloc(0) as unknown as Buffer;
    }
    const enc = 'big5' as BufferEncoding;
    let full: Buffer;
    try {
      full = Buffer.from(trimmed, enc) as unknown as Buffer;
    } catch {
      full = Buffer.from(trimmed, 'utf8') as unknown as Buffer;
    }
    if (full.length <= maxBytes) {
      return full;
    }
    let low = 0;
    let high = trimmed.length;
    let best: Buffer = Buffer.alloc(0) as unknown as Buffer;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const slice = trimmed.slice(0, mid);
      let buf: Buffer;
      try {
        buf = Buffer.from(slice, enc) as unknown as Buffer;
      } catch {
        buf = Buffer.from(slice, 'utf8') as unknown as Buffer;
      }
      if (buf.length <= maxBytes) {
        best = buf;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return best;
  }
}

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
  originalHandlingFeeAllocation: string; // 原始檔案中的手續費分攤方式（6位數，如130000、150000）
}

/**
 * 國泰網銀拆分格式 -> receive.txt 固定寬度格式轉換服務
 */
export class BankConverterService {
  private positions = BankConverterConfig.FIELD_POSITIONS;
  private lineLength = BankConverterConfig.LINE_LENGTH;

  /**
   * 以 bytes 解析網銀原始一行（latin1 讓字元=byte）
   */
  private parseBankLineBytes(lineLatin1: string): ParsedBankLine | null {
    if (!lineLatin1) return null;

    // 例：0        20260115SPU          013    265030001102    23265946 .... TWD+00000016200000050    16008050043               國立宜蘭大學４０２專戶 .... 0 .... 130000
    // 或：0        20260131SPU          0130000265030001102    23265946 .... TWD+...
    const head = lineLatin1.match(/^0\s+(\d{8})(SPU|TRN)\s+/);
    if (!head || !head[1] || !head[2]) {
      logger.debug('解析失敗：行首格式不符', {
        lineStart: lineLatin1.substring(0, 30),
      });
      return null;
    }
    const date = head[1];
    const transType = head[2];

    const afterHead = lineLatin1.slice(head[0].length);

    // 嘗試匹配 3 位銀行代碼（後接空格），或 7 位銀行代碼（後接帳號）
    let bankCodeMatch = afterHead.match(/^(\d{3})\s+/);
    let bankCode: string;
    let bankCodeLength: number; // 用於記錄匹配的長度

    if (bankCodeMatch && bankCodeMatch[1]) {
      // 格式：013     (3位銀行代碼 + 空格)
      bankCode = bankCodeMatch[1];
      bankCodeLength = bankCodeMatch[0].length;
    } else {
      // 格式：0130000265030001102 (可能是 7位銀行代碼 + 帳號，無空格分隔)
      // 嘗試匹配 7 位銀行代碼（0130000）或 3 位銀行代碼（013）
      const bankCode7Match = afterHead.match(/^(\d{7})/);
      if (bankCode7Match && bankCode7Match[1]) {
        // 取前3位作為銀行代碼
        bankCode = bankCode7Match[1].substring(0, 3);
        bankCodeLength = bankCode7Match[0].length;
      } else {
        logger.debug('解析失敗：無法識別銀行代碼', {
          afterHead: afterHead.substring(0, 20),
        });
        return null;
      }
    }

    const afterBankCode = afterHead.slice(bankCodeLength);

    // 解析付款人帳號
    // 格式可能是：
    // 1. 013    265030001102（3位銀行代碼 + 空格 + 帳號）
    // 2. 0130000265030001102（7位銀行代碼直接接帳號，無空格）
    let accountMatch: RegExpMatchArray | null;
    let account: string;

    // 先嘗試匹配標準格式（有空格）
    accountMatch = afterBankCode.match(/^\s+(\d{1,16})/);

    if (accountMatch && accountMatch[1]) {
      // 標準格式：有空格分隔
      account = accountMatch[1];
    } else {
      // 可能是連續數字格式：如果 afterHead 以 7 位數字開頭（非3位+空格），
      // 則帳號從第 8 位開始，直到遇到空格或非數字
      const continuousMatch = afterHead.match(/^(\d{7})(\d{1,16})(\s|$)/);
      if (continuousMatch && continuousMatch[2]) {
        account = continuousMatch[2];
        // 使用原始的 continuousMatch 作為 accountMatch，但只取帳號部分
        accountMatch = continuousMatch;
      } else {
        // 嘗試匹配緊接在銀行代碼後的數字（無空格）
        const noSpaceMatch = afterBankCode.match(/^(\d{1,16})(\s|$)/);
        if (noSpaceMatch && noSpaceMatch[1]) {
          account = noSpaceMatch[1];
          accountMatch = noSpaceMatch;
        } else {
          logger.debug('解析失敗：無法識別付款人帳號', {
            afterHead: afterHead.substring(0, 40),
            afterBankCode: afterBankCode.substring(0, 40),
          });
          return null;
        }
      }
    }

    const serialMatch = lineLatin1.match(/(\d{8})\s+TWD\+/);
    if (!serialMatch || !serialMatch[1]) {
      logger.debug('解析失敗：無法找到交易序號和TWD+', {
        lineSearch: lineLatin1.includes('TWD+') ? 'found TWD+' : 'no TWD+',
        linePreview: lineLatin1.substring(40, 80),
      });
      return null;
    }
    const serial = serialMatch[1];

    const twdIdx = lineLatin1.indexOf('TWD+');
    if (twdIdx === -1) {
      logger.debug('解析失敗：找不到 TWD+', {
        linePreview: lineLatin1.substring(50, 100),
      });
      return null;
    }

    const afterTwd = lineLatin1.slice(twdIdx + 4);
    const amountMatch = afterTwd.match(/^(\d{17})/);
    if (!amountMatch || !amountMatch[1]) return null;
    const amount17 = amountMatch[1];

    // 收款帳號（amount17 後的下一段數字）
    const afterAmountAbs = twdIdx + 4 + amount17.length;
    const tailAfterAmount = lineLatin1.slice(afterAmountAbs);
    const receiveAccMatch = tailAfterAmount.match(/^\s*(\d{1,16})/);
    if (!receiveAccMatch || !receiveAccMatch[1]) return null;
    const receiveAccountRaw = receiveAccMatch[1];
    const receiveAccEndAbs = afterAmountAbs + receiveAccMatch[0].length; // 含前導空白 + 數字

    // 最後 6 位數：手續費分攤方式（前2位是13或15，後面補0，如130000、150000）
    const handlingFeeMatch = lineLatin1.match(/(\d{6})\s*$/);
    if (!handlingFeeMatch || !handlingFeeMatch[1]) {
      logger.debug('解析失敗：無法找到最後6位手續費分攤方式', {
        lineEnd: lineLatin1.substring(Math.max(0, lineLatin1.length - 20)),
      });
      return null;
    }
    const originalHandlingFeeAllocation = handlingFeeMatch[1];

    // 找最後那個「單獨的 0 欄位」（收款人是否電告），以它作為收款戶名結束點
    let zeroPos = -1;
    for (let pos = lineLatin1.length - 1; pos >= 0; pos--) {
      if (lineLatin1[pos] === '0') {
        const prev = pos > 0 ? lineLatin1[pos - 1] : '';
        const next = pos < lineLatin1.length - 1 ? lineLatin1[pos + 1] : '';
        if (prev === ' ' && next === ' ') {
          zeroPos = pos;
          break;
        }
        // 也檢查行尾的情況（next 可能是空或換行）
        if (prev === ' ' && (next === '' || next === '\r' || next === '\n')) {
          zeroPos = pos;
          break;
        }
      }
    }
    if (zeroPos === -1) {
      logger.debug('解析失敗：找不到收款人是否電告的0欄位', {
        lineEnd: lineLatin1.substring(Math.max(0, lineLatin1.length - 30)),
        lineLength: lineLatin1.length,
      });
      return null;
    }

    // 收款戶名在「收款帳號結束」到「zeroPos」之間（去掉空白）
    const receiveNameRaw = lineLatin1.slice(receiveAccEndAbs, zeroPos).trim();

    // 付款人帳號：最多 16 位
    const payerAccountDigits = account.replace(/\D/g, '');
    // 收款帳號：最多 16 位
    const payeeAccountDigits = receiveAccountRaw.replace(/\D/g, '');

    // 將收款戶名從 latin1 轉換為文字（用於手續費計算）
    // 嘗試解碼為 Big5，如果失敗則使用原始字串
    let receiveNameText = '';
    try {
      const nameBuffer = Buffer.from(receiveNameRaw, 'latin1');
      // 使用類型斷言來處理 Big5 編碼
      receiveNameText = nameBuffer.toString('big5' as BufferEncoding).trim();
    } catch {
      receiveNameText = receiveNameRaw.trim();
    }

    return {
      date,
      transType,
      bankCode,
      payerAccountDigits,
      serial,
      amount17, // 14位金額 + 3位收款行(例：...013)
      payeeAccountDigits,
      // 收款戶名 bytes（Big5），保持原樣：latin1 轉回 bytes 不會變亂碼
      receiveNameBytes: Buffer.from(receiveNameRaw.trim(), 'latin1'),
      receiveNameText, // 新增：收款人戶名文字
      originalHandlingFeeAllocation, // 原始手續費分攤方式（6位數格式）
    };
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
   * 轉換檔案 Buffer：輸入網銀檔(big5 bytes) -> 輸出 receive(big5 bytes, CRLF)
   */
  convertFileBuffer(inputBuffer: Buffer): Buffer {
    const inputLatin1 = inputBuffer.toString('latin1');
    const rawLines = inputLatin1.split(/\r?\n/);

    logger.debug('開始轉換檔案', {
      inputSize: inputBuffer.length,
      totalLines: rawLines.length,
    });

    const outLines: Buffer[] = [];
    let parsedCount = 0;
    let skippedCount = 0;
    let emptyLineCount = 0;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (!line) {
        emptyLineCount++;
        continue;
      }
      const raw = line.replace(/\r$/, '');
      if (!raw) {
        emptyLineCount++;
        continue;
      }

      const parsed = this.parseBankLineBytes(raw);
      if (!parsed) {
        skippedCount++;
        // 記錄前幾行失敗的內容以便除錯
        if (skippedCount <= 3) {
          logger.debug(`無法解析第 ${i + 1} 行`, {
            linePreview: raw.substring(0, 100),
          });
        }
        continue;
      }

      const outLineBuf = this.convertLine(parsed);
      outLines.push(outLineBuf);
      parsedCount++;
    }

    logger.info('檔案轉換統計', {
      totalLines: rawLines.length,
      parsedCount,
      skippedCount,
      emptyLineCount,
    });

    // 如果沒有任何行被成功解析，拋出錯誤
    if (outLines.length === 0) {
      const errorMsg = `無法解析檔案內容：已處理 ${rawLines.length} 行，跳過 ${skippedCount} 行，空行 ${emptyLineCount} 行。請確認檔案格式是否正確。預期格式：行首應為 "0        YYYYMMDDSPU/TRN"`;
      logger.error(errorMsg, {
        totalLines: rawLines.length,
        skippedCount,
        emptyLineCount,
        firstFewLines: rawLines.slice(0, 3).map((l) => l.substring(0, 100)),
      });
      throw new Error(errorMsg);
    }

    // join with CRLF, keep bytes (Big5)
    const crlf = Buffer.from([0x0d, 0x0a]);
    const outputBuf = Buffer.concat(outLines.flatMap((l) => [l, crlf]));

    logger.info('檔案轉換完成', {
      outputSize: outputBuf.length,
      outputLines: outLines.length,
    });

    return outputBuf;
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

    const col: Record<string, number> = {};
    cfg.REQUIRED_HEADERS.forEach((name) => {
      col[name] = headers.indexOf(name);
    });

    const dataRows = jsonData.slice(1);
    const outLines: Buffer[] = [];
    let wireCount = 0;
    let skippedNonWire = 0;
    let skippedInvalid = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!Array.isArray(row)) continue;
      if (BankConverterService.isExcelRowEmpty(row)) continue;

      const method = BankConverterService.cellString(row[col[cfg.HEADER.PAYMENT_METHOD]]);
      if (method !== cfg.PAYMENT_METHOD_WIRE) {
        skippedNonWire++;
        continue;
      }

      const payeeName = BankConverterService.cellString(row[col[cfg.HEADER.PAYEE_NAME]]).trim();
      const bankCodeRaw = row[col[cfg.HEADER.BANK_CODE]];
      const accountRaw = row[col[cfg.HEADER.ACCOUNT]];
      const amountCell = row[col[cfg.HEADER.AMOUNT]];

      const bankDigits = BankConverterService.bankCodeDigitsOnly(bankCodeRaw);
      const accountDigits = BankConverterService.accountDigitsPreserve(accountRaw);
      if (!payeeName || !bankDigits || !accountDigits || amountCell === '' || amountCell == null) {
        skippedInvalid++;
        if (skippedInvalid <= 3) {
          logger.debug('Excel 列略過（匯款但欄位不完整）', {
            rowIndex: i + 2,
            formNo: BankConverterService.cellString(row[col[cfg.HEADER.FORM_NO]]),
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
        originalHandlingFeeAllocation: '000000',
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
      return Buffer.alloc(0);
    }
    const enc = 'big5' as BufferEncoding;
    let full: Buffer;
    try {
      full = Buffer.from(trimmed, enc);
    } catch {
      full = Buffer.from(trimmed, 'utf8');
    }
    if (full.length <= maxBytes) {
      return full;
    }
    let low = 0;
    let high = trimmed.length;
    let best = Buffer.alloc(0);
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const slice = trimmed.slice(0, mid);
      let buf: Buffer;
      try {
        buf = Buffer.from(slice, enc);
      } catch {
        buf = Buffer.from(slice, 'utf8');
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

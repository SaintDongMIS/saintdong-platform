import { BankConverterConfig } from '../constants/bankConverterConfig';
import { isSpecialCompany } from './HandlingFeeService';

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
    const head = lineLatin1.match(/^0\s+(\d{8})(SPU|TRN)\s+/);
    if (!head || !head[1] || !head[2]) return null;
    const date = head[1];
    const transType = head[2];

    const afterHead = lineLatin1.slice(head[0].length);
    const bankCodeMatch = afterHead.match(/^(\d{3})\s+/);
    if (!bankCodeMatch || !bankCodeMatch[1]) return null;
    const bankCode = bankCodeMatch[1];

    const afterBankCode = afterHead.slice(bankCodeMatch[0].length);
    const accountMatch = afterBankCode.match(/^(\d{1,16})/);
    if (!accountMatch || !accountMatch[1]) return null;
    const account = accountMatch[1];

    const serialMatch = lineLatin1.match(/(\d{8})\s+TWD\+/);
    if (!serialMatch || !serialMatch[1]) return null;
    const serial = serialMatch[1];

    const twdIdx = lineLatin1.indexOf('TWD+');
    if (twdIdx === -1) return null;

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
    if (!handlingFeeMatch || !handlingFeeMatch[1]) return null;
    const originalHandlingFeeAllocation = handlingFeeMatch[1];

    // 找最後那個「單獨的 0 欄位」（收款人是否電告），以它作為收款戶名結束點
    let zeroPos = -1;
    for (let pos = lineLatin1.length - 1; pos >= 0; pos--) {
      if (lineLatin1[pos] === '0') {
        const prev = lineLatin1[pos - 1];
        const next = lineLatin1[pos + 1];
        if (prev === ' ' && next === ' ') {
          zeroPos = pos;
          break;
        }
      }
    }
    if (zeroPos === -1) return null;

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

    const outLines: Buffer[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (!line) continue;
      const raw = line.replace(/\r$/, '');
      if (!raw) continue;

      const parsed = this.parseBankLineBytes(raw);
      if (!parsed) continue;

      const outLineBuf = this.convertLine(parsed);
      outLines.push(outLineBuf);
    }

    // join with CRLF, keep bytes (Big5)
    const crlf = Buffer.from([0x0d, 0x0a]);
    const outputBuf = Buffer.concat(outLines.flatMap((l) => [l, crlf]));

    return outputBuf;
  }
}

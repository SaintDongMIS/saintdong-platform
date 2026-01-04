const fs = require('fs');
const path = require('path');
const BankConfig = require('../server/constants/bankConverterConfig');

/**
 * 國泰網銀拆分格式 -> receive.txt 固定寬度格式
 *
 * 三個重點：
 * 1) 帳號格式轉換：013    265030001102 -> 0130000265030001102（中間補4個0）
 * 2) 金額欄位合併：TWD+00000007000000013    115506121053 -> TWD+000000070000000130000115506121053（中間補4個0）
 * 3) 加入付款人資訊：付款人戶名使用 constants 中定義的公司全名
 */
class CathayBankConverter {
  constructor(config = {}) {
    this.config = {
      overrideDate: config.overrideDate, // 可選：YYYYMMDD（覆寫預定交易日期）
    };
    this.positions = BankConfig.FIELD_POSITIONS;
    this.lineLength = BankConfig.LINE_LENGTH;
  }

  /**
   * 以 bytes 解析網銀原始一行（latin1 讓字元=byte）
   */
  parseBankLineBytes(lineLatin1) {
    if (!lineLatin1) return null;

    // 例：0        20260115SPU          013    265030001102    23265946 .... TWD+00000016200000050    16008050043               國立宜蘭大學４０２專戶 .... 0 .... 130000
    const head = lineLatin1.match(/^0\s+(\d{8})(SPU|TRN)\s+/);
    if (!head) return null;
    const date = head[1];
    const transType = head[2];

    const afterHead = lineLatin1.slice(head[0].length);
    const bankCodeMatch = afterHead.match(/^(\d{3})\s+/);
    if (!bankCodeMatch) return null;
    const bankCode = bankCodeMatch[1];

    const afterBankCode = afterHead.slice(bankCodeMatch[0].length);
    const accountMatch = afterBankCode.match(/^(\d{1,16})/);
    if (!accountMatch) return null;
    const account = accountMatch[1];

    const serialMatch = lineLatin1.match(/(\d{8})\s+TWD\+/);
    if (!serialMatch) return null;
    const serial = serialMatch[1];

    const twdIdx = lineLatin1.indexOf('TWD+');
    if (twdIdx === -1) return null;

    const afterTwd = lineLatin1.slice(twdIdx + 4);
    const amountMatch = afterTwd.match(/^(\d{17})/);
    if (!amountMatch) return null;
    const amount17 = amountMatch[1];

    // 收款帳號（amount17 後的下一段數字）
    const afterAmountAbs = twdIdx + 4 + amount17.length;
    const tailAfterAmount = lineLatin1.slice(afterAmountAbs);
    const receiveAccMatch = tailAfterAmount.match(/^\s*(\d{1,16})/);
    if (!receiveAccMatch) return null;
    const receiveAccountRaw = receiveAccMatch[1];
    const receiveAccEndAbs = afterAmountAbs + receiveAccMatch[0].length; // 含前導空白 + 數字

    // 最後 6 位金額
    const finalAmountMatch = lineLatin1.match(/(\d{6})\s*$/);
    if (!finalAmountMatch) return null;
    const finalAmount = finalAmountMatch[1];

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
      finalAmount,
    };
  }

  /**
   * 產生固定寬度輸出行（361 bytes）
   */
  convertLine(parsed) {
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
    const outDate = (this.config.overrideDate || currentDate)
      .padEnd(8, ' ')
      .slice(0, 8);
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
    BankConfig.PAYER_NAME_BYTES.copy(out, pos.PAYER_NAME.start);

    // 2) 金額欄位合併：
    // currency [133..135] = TWD
    out.write('TWD', pos.CURRENCY.start, pos.CURRENCY.length, 'ascii');

    // sign [136] = +
    out.write('+', pos.AMOUNT_SIGN.start, pos.AMOUNT_SIGN.length, 'ascii');

    // amount [137..150] = 14 digits（amount17 前14）
    const amount14 = parsed.amount17.slice(0, 14).padStart(14, '0');
    out.write(amount14, pos.AMOUNT.start, pos.AMOUNT.length, 'ascii');

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

    // 固定 0 欄位（收款人是否電告）[254]：維持空白（已經是 0x20）

    // 最終金額 [305..310] (6位)
    out.write(
      parsed.finalAmount.padStart(6, '0').slice(0, 6),
      pos.FINAL_AMOUNT.start,
      pos.FINAL_AMOUNT.length,
      'ascii'
    );

    return out;
  }

  /**
   * 轉檔：輸入網銀檔(big5 bytes) -> 輸出 receive(big5 bytes, CRLF)
   */
  convertFile(inputPath, outputPath) {
    const inputBuf = fs.readFileSync(inputPath);
    const inputLatin1 = inputBuf.toString('latin1');
    const rawLines = inputLatin1.split(/\r?\n/);

    const outLines = [];
    let ok = 0;
    let skipped = 0;

    for (let i = 0; i < rawLines.length; i++) {
      const raw = rawLines[i].replace(/\r$/, '');
      if (!raw) continue;

      const parsed = this.parseBankLineBytes(raw);
      if (!parsed) {
        skipped++;
        continue;
      }

      const outLineBuf = this.convertLine(parsed);
      outLines.push(outLineBuf);
      ok++;
    }

    // join with CRLF, keep bytes (Big5)
    const crlf = Buffer.from([0x0d, 0x0a]);
    const outputBuf = Buffer.concat(outLines.flatMap((l) => [l, crlf]));
    fs.writeFileSync(outputPath, outputBuf);

    console.log(`轉換完成：成功 ${ok} 筆，跳過 ${skipped} 筆`);
    console.log(`輸出：${outputPath}`);
  }
}

// 使用範例
if (require.main === module) {
  const args = process.argv.slice(2);
  const inputPath = args[0];
  const outputPath = args[1];

  // 可選參數：--date=YYYYMMDD
  let overrideDate;
  for (let i = 2; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--date=')) overrideDate = a.slice('--date='.length);
  }

  if (!inputPath || !outputPath) {
    console.error('缺少參數。用法：');
    console.error(
      '  node utils/bankFormatConverter.js <inputPath> <outputPath> [--date=YYYYMMDD]'
    );
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`找不到輸入檔：${inputPath}`);
    process.exit(1);
  }

  const converter = new CathayBankConverter({ overrideDate });
  try {
    converter.convertFile(inputPath, outputPath);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

module.exports = CathayBankConverter;

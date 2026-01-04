/**
 * 國泰銀行匯款格式轉換配置常數
 */

module.exports = {
  // 付款人戶名（固定，Big5 編碼的 bytes，70 bytes）
  PAYER_NAME_BYTES: Buffer.from([
    0xb8, 0x74, 0xaa, 0x46, 0xc0, 0xe7, 0xb3, 0x79, 0xaa, 0xd1, 0xa5, 0xf7, 0xa6, 0xb3, 0xad, 0xad, 0xa4, 0xbd, 0xa5, 0x71, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20
  ]),

  // receive.txt 固定寬度格式定義（bytes 位置）
  FIELD_POSITIONS: {
    RECORD_TYPE: { start: 0, length: 1 },           // 識別代碼
    TRANS_DATE: { start: 9, length: 8 },            // 預定交易日期
    TRANS_TYPE: { start: 17, length: 3 },           // 交易類別 (SPU/TRN)
    PAYER_BANK_CODE: { start: 30, length: 7 },      // 付款行代碼 (0130000)
    PAYER_ACCOUNT: { start: 37, length: 16 },       // 付款人帳號
    SERIAL: { start: 53, length: 8 },               // 交易序號
    PAYER_NAME: { start: 63, length: 70 },          // 付款人戶名
    CURRENCY: { start: 133, length: 3 },            // 幣別 (TWD)
    AMOUNT_SIGN: { start: 136, length: 1 },         // 金額正負號 (+)
    AMOUNT: { start: 137, length: 14 },             // 金額（14位）
    PAYEE_BANK_CODE: { start: 151, length: 7 },     // 收款行代碼
    PAYEE_ACCOUNT: { start: 158, length: 16 },      // 收款人帳號
    PAYEE_NAME: { start: 184, length: 70 },         // 收款人戶名
    FINAL_AMOUNT: { start: 305, length: 6 },        // 最終金額（6位）
  },

  // 每行總長度（bytes）
  LINE_LENGTH: 361,
};

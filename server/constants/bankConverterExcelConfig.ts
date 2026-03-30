/**
 * Commeet「付款資料」Excel → 國泰整批付款 361 bytes 轉檔欄位與固定參數
 */

export const BankConverterExcelConfig = {
  /** 工作表：Commeet 匯出檔預設 */
  SHEET_NAME: '付款資料',

  /** 必要欄位（第一列標題，會做 trim、去掉開頭 *） */
  REQUIRED_HEADERS: [
    '表單編號',
    '付款對象名稱',
    '銀行代碼',
    '帳戶號碼',
    '付款金額（本幣）',
    '付款方式',
  ] as const,

  /** 只輸出「匯款」列 */
  PAYMENT_METHOD_WIRE: '匯款',

  /** 付款人（公司）固定：與既有 txt 轉檔一致 */
  PAYER_BANK_CODE_3: '013',
  PAYER_ACCOUNT_DIGITS: '265030001102',

  /**
   * 每批固定交易序號（8 位）
   * 與 Commeet 網銀 txt 中 TWD+ 前的 8 碼一致（實務上為公司統編）
   */
  SERIAL_FIXED: '23265946',

  /** 交易類別：Commeet 匯出多為 SPU */
  TRANS_TYPE: 'SPU',

  /** Excel 欄位 key → 標題字串（與 REQUIRED 對應） */
  HEADER: {
    FORM_NO: '表單編號',
    PAYEE_NAME: '付款對象名稱',
    BANK_CODE: '銀行代碼',
    ACCOUNT: '帳戶號碼',
    AMOUNT: '付款金額（本幣）',
    PAYMENT_METHOD: '付款方式',
  },
} as const;

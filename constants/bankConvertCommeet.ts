/**
 * Commeet「付款資料」Excel → 國泰整批付款轉檔（前後端共用欄位定義）
 */

export const BankConvertCommeetConfig = {
  SHEET_NAME: '付款資料',

  REQUIRED_HEADERS: [
    '表單編號',
    '戶名',
    '銀行代碼',
    '帳戶號碼',
    '付款金額（本幣）',
    '付款方式',
  ] as const,

  PAYMENT_METHOD_WIRE: '匯款',

  PAYER_BANK_CODE_3: '013',
  PAYER_ACCOUNT_DIGITS: '265030001102',
  SERIAL_FIXED: '23265946',
  TRANS_TYPE: 'SPU',

  HEADER: {
    FORM_NO: '表單編號',
    PAYEE_NAME: '戶名',
    BANK_CODE: '銀行代碼',
    ACCOUNT: '帳戶號碼',
    AMOUNT: '付款金額（本幣）',
    PAYMENT_METHOD: '付款方式',
    PAYEE_TAX_ID: '付款對象統一編號/身分證號',
    BANK_NAME: '銀行名稱',
  },
} as const;

export type BankConvertCommeetConfigType = typeof BankConvertCommeetConfig;

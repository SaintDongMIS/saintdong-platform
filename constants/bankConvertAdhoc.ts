/** 臨時整批匯款（adhoc）預設與輸入格式 */

export type AdhocWireProfile = 'employee' | 'vendor';

export const BankConvertAdhocConfig = {
  /** 員工代墊：同戶名合併；廠商：一筆一列 */
  DEFAULT_MERGE_BY_PROFILE: {
    employee: 'by_payee_name',
    vendor: 'none',
  } as const satisfies Record<
    AdhocWireProfile,
    'by_payee_name' | 'none'
  >,

  /** 會計 Payment_YYYYMMDD.xlsx（0615(匯款) 等工作表） */
  PAYMENT_EXCEL: {
    WIRE_BLOCK_START: '匯款',
    WIRE_BLOCK_END_MARK: '合計',
    BLANK_MARKERS: ['(空白)', '空白', '—', '-'],
    COLUMNS: {
      CATEGORY: 0,
      PAYMENT_METHOD: 1,
      SCHEDULED_DATE: 2,
      PAYEE_NAME: 3,
      LINE_NOTE: 4,
      BANK_CODE: 5,
      BANK_NAME: 6,
      ACCOUNT: 7,
      AMOUNT: 8,
      ACTUAL_PAY_DATE: 9,
    },
  },

  PASTE_EXAMPLE_EMPLOYEE: `"江沅錡","油資","013","國泰世華","127506278376","14,116"
"何而淵","接待室桌巾","013","國泰世華","232500286723","17,104"`,

  PASTE_HINT:
    '可選：貼上 6 欄 CSV（戶名,事由,銀行,銀行名,帳號,金額）。主要請上傳會計 Payment Excel。',
} as const;

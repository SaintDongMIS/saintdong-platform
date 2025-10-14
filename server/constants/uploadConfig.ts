/**
 * 檔案上傳配置常數
 */
export const UploadConfig = {
  // 檔案大小限制
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB

  // 允許的檔案類型
  ALLOWED_MIME_TYPES: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv', // .csv
    'application/csv', // .csv
  ] as string[],

  // 允許的副檔名
  ALLOWED_EXTENSIONS: ['.xlsx', '.xls', '.csv'] as string[],

  // 必要欄位
  REQUIRED_FIELDS: ['表單編號', '申請人姓名', '表單本幣總計'] as string[],

  // 資料表名稱
  TABLE_NAME: 'ExpendForm' as const,
};

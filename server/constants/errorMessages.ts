/**
 * API 錯誤訊息常數
 */
export const ErrorMessages = {
  // 檔案上傳相關
  NO_FILE_SELECTED: '沒有選擇檔案',
  FILE_SIZE_EXCEEDED: '檔案大小超過限制 (10MB)',
  INVALID_FILE_TYPE: '只允許上傳 Excel 檔案 (.xlsx 或 .xls)',
  FILE_PROCESSING_FAILED: '檔案處理失敗',

  // Excel 相關
  EXCEL_PARSE_FAILED: 'Excel 檔案解析失敗',
  EXCEL_VALIDATION_FAILED: 'Excel 資料格式驗證失敗',
  EXCEL_NO_DATA: 'Excel 檔案中沒有有效資料',

  // 資料庫相關
  DATABASE_CONNECTION_FAILED: '資料庫連接失敗，無法處理檔案',
  DATABASE_OPERATION_FAILED: '資料庫操作失敗',
  TABLE_STRUCTURE_CHECK_FAILED: '資料表結構檢查失敗',

  // HTTP 相關
  METHOD_NOT_ALLOWED: 'Method Not Allowed',
} as const;

/**
 * HTTP 狀態碼常數
 */
export const HttpStatus = {
  BAD_REQUEST: 400,
  METHOD_NOT_ALLOWED: 405,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_SERVER_ERROR: 500,
} as const;

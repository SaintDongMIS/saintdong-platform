/**
 * 檔案上傳相關常數
 */

export const ALLOWED_EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
export const ALLOWED_TXT_EXTENSIONS = ['.txt'];
export const ALLOWED_EXCEL_ONLY = ['.xlsx', '.xls'];

/** 國泰整批付款轉檔：Commeet 網銀 .txt 或 Payment_*.xlsx */
export const ALLOWED_BANK_CONVERT_EXTENSIONS = ['.txt', '.xlsx', '.xls'];

export const TOAST_DELAY_MS = 300;
export const TOAST_DURATION_MS = 6000;
export const TOAST_LONG_DURATION_MS = 10000;

export const FILE_SIZE_UNITS = ['Bytes', 'KB', 'MB', 'GB'];
export const FILE_SIZE_BASE = 1024;

export const ALLOWED_EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
];

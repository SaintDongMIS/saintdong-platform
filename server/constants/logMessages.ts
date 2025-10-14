/**
 * 日誌訊息範本
 */
export const LogMessages = {
  // 檔案上傳
  fileUploadSuccess: (fileName: string) => `檔案上傳成功: ${fileName}`,

  // 資料庫
  testingDatabaseConnection: '測試資料庫連接',
  databaseConnectionOk: '資料庫連接正常',

  // Excel 處理
  startParsingExcel: '開始解析 Excel 檔案',
  excelParseComplete: 'Excel 解析完成',
  excelValidationPassed: 'Excel 資料格式驗證通過',

  // 資料處理
  startDataEnrichment: '開始資料預處理與擴充',
  dataEnrichmentComplete: '資料擴充完成',

  // 資料表結構
  checkingTableStructure: '檢查資料表結構',
  tableStructureCheckComplete: '資料表結構檢查完成',

  // 資料庫操作
  startBatchInsert: '開始批次插入資料到資料庫',
  databaseOperationComplete: '資料庫操作完成',

  // 錯誤
  fileProcessingError: '檔案處理錯誤',
} as const;

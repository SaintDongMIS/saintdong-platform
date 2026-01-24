import { ExcelService } from '../../services/ExcelService';
import { DatabaseService } from '../../services/DatabaseService';
import { TableMigrationService } from '../../services/TableMigrationService';
import { UploadConfig } from '../../constants/uploadConfig';
import { LogMessages } from '../../constants/logMessages';
import { uploadLogger } from '../../services/LoggerService';

/**
 * 檔案上傳處理狀態 (預覽模式)
 */
interface PreviewUploadState {
  uploadedFile: Express.Multer.File;
  excelData?: any;
  previewResult?: any;
}

/**
 * 預覽模式的處理管道 - 執行所有處理步驟但不寫入資料庫
 */
export async function processUploadPipelinePreview(
  uploadedFile: Express.Multer.File
): Promise<any> {
  const state: PreviewUploadState = { uploadedFile };

  uploadLogger.info('========================================');
  uploadLogger.info('開始預覽模式處理 (不寫入資料庫)');
  uploadLogger.info('========================================');

  await validateDatabaseConnection();
  state.excelData = await parseAndValidateExcel(state.uploadedFile);
  await enrichExcelData(state.excelData);
  await ensureTableStructure();
  state.previewResult = await previewDatabaseOperation(state.excelData);

  uploadLogger.info('========================================');
  uploadLogger.info('預覽模式處理完成');
  uploadLogger.info('========================================');

  return buildPreviewResponse(state);
}

/**
 * 驗證資料庫連接
 */
async function validateDatabaseConnection(): Promise<void> {
  uploadLogger.info(LogMessages.testingDatabaseConnection);

  const dbConnected = await DatabaseService.testConnection();
  if (!dbConnected) {
    throw new Error('資料庫連接失敗');
  }

  uploadLogger.info(LogMessages.databaseConnectionOk);
}

/**
 * 解析並驗證 Excel
 */
async function parseAndValidateExcel(
  uploadedFile: Express.Multer.File
): Promise<any> {
  uploadLogger.info(LogMessages.startParsingExcel);

  const excelData = await ExcelService.parseExcel(uploadedFile.path);

  uploadLogger.info(LogMessages.excelParseComplete, {
    totalRows: excelData.totalRows,
    validRows: excelData.validRows,
    skippedRows: excelData.skippedRows,
  });

  ExcelService.validateExcelData(excelData, UploadConfig.REQUIRED_FIELDS);
  uploadLogger.info(LogMessages.excelValidationPassed);

  return excelData;
}

/**
 * 擴充 Excel 資料
 */
async function enrichExcelData(excelData: any): Promise<void> {
  uploadLogger.info(LogMessages.startDataEnrichment);
  ExcelService.enrichBankData(excelData.rows);
  uploadLogger.info(LogMessages.dataEnrichmentComplete);
}

/**
 * 確保資料表結構
 */
async function ensureTableStructure(): Promise<void> {
  uploadLogger.info(LogMessages.checkingTableStructure);
  await TableMigrationService.ensureTableStructure(UploadConfig.TABLE_NAME);
  uploadLogger.info(LogMessages.tableStructureCheckComplete);
}

/**
 * 預覽資料庫操作 (檢查但不寫入)
 */
async function previewDatabaseOperation(excelData: any): Promise<any> {
  uploadLogger.info('========================================');
  uploadLogger.info('開始預覽模式：檢查資料但不寫入資料庫');
  uploadLogger.info('========================================');

  const previewResult = await DatabaseService.previewBatchInsert(
    excelData.rows,
    UploadConfig.TABLE_NAME
  );

  uploadLogger.info('預覽檢查完成', {
    wouldInsertCount: previewResult.wouldInsertCount,
    wouldSkipCount: previewResult.wouldSkipCount,
    totalChecked: excelData.rows.length,
  });

  return previewResult;
}

/**
 * 建立預覽回應
 */
function buildPreviewResponse(state: PreviewUploadState): any {
  return {
    success: true,
    message: '✅ Excel 檔案預覽完成 (未寫入資料庫)',
    isPreview: true, // 標記這是預覽模式
    data: {
      fileName: state.uploadedFile.originalname,
      fileSize: state.uploadedFile.size,
      uploadTime: new Date().toISOString(),
      excelStats: {
        totalRows: state.excelData.totalRows,
        validRows: state.excelData.validRows,
        skippedRows: state.excelData.skippedRows,
        headers: state.excelData.headers,
      },
      previewStats: {
        wouldInsertCount: state.previewResult.wouldInsertCount,
        wouldSkipCount: state.previewResult.wouldSkipCount,
        duplicateCount: state.previewResult.duplicateKeys?.length || 0,
        duplicateKeys: state.previewResult.duplicateKeys || [],
      },
      // 提供前幾筆資料供預覽
      sampleData: state.excelData.rows.slice(0, 5).map((row: any) => ({
        表單編號: row['表單編號'],
        申請人姓名: row['申請人姓名'],
        費用項目: row['費用項目'],
        交易日期: row['交易日期'],
        項目原幣金額: row['項目原幣金額'],
        分攤參與部門: row['分攤參與部門'],
      })),
      // 提供完整處理後的資料供前端生成 Excel
      processedRows: state.excelData.rows,
    },
  };
}

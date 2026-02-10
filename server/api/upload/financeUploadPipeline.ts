import { ExcelService } from '../../services/ExcelService';
import { DatabaseService } from '../../services/DatabaseService';
import { TableMigrationService } from '../../services/TableMigrationService';
import { UploadConfig } from '../../constants/uploadConfig';
import { LogMessages } from '../../constants/logMessages';
import { uploadLogger } from '../../services/LoggerService';

/**
 * 檔案上傳處理狀態
 */
interface UploadState {
  uploadedFile: Express.Multer.File;
  excelData?: any;
  dbResult?: any;
}

/**
 * 處理管道 - 依序執行所有處理步驟
 */
export async function processUploadPipeline(
  uploadedFile: Express.Multer.File
): Promise<any> {
  const state: UploadState = { uploadedFile };

  await validateDatabaseConnection();
  state.excelData = await parseAndValidateExcel(state.uploadedFile);
  await enrichExcelData(state.excelData);
  await ensureTableStructure();
  state.dbResult = await insertToDatabase(state.excelData);

  return buildSuccessResponse(state);
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
 * 插入資料到資料庫
 */
async function insertToDatabase(excelData: any): Promise<any> {
  uploadLogger.info(LogMessages.startBatchInsert);

  const dbResult = await DatabaseService.batchInsertData(
    excelData.rows,
    UploadConfig.TABLE_NAME,
    {
      trackChanges: true,
      trackedFields: ['付款狀態', '實際付款日期'],
      changedBy: 'FINANCE_UPLOAD',
    }
  );

  if (!dbResult.success) {
    throw new Error(`資料庫操作失敗: ${dbResult.errors.join(', ')}`);
  }

  uploadLogger.info(LogMessages.databaseOperationComplete, {
    insertedCount: dbResult.insertedCount,
    skippedCount: dbResult.skippedCount,
    errorCount: dbResult.errors.length,
  });

  return dbResult;
}

/**
 * 建立成功回應
 */
function buildSuccessResponse(state: UploadState): any {
  return {
    success: true,
    message: 'Excel 檔案處理完成',
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
      databaseStats: {
        insertedCount: state.dbResult.insertedCount,
        skippedCount: state.dbResult.skippedCount,
        errorCount: state.dbResult.errors.length,
      },
      errors: state.dbResult.errors,
    },
  };
}

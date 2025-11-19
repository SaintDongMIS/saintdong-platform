import { defineEventHandler } from 'h3';
import { ExcelService } from '../../services/ExcelService';
import { DatabaseService } from '../../services/DatabaseService';
import { TableMigrationService } from '../../services/TableMigrationService';
import { FileUploadHandler } from '../../utils/fileUploadHandler';
import { ErrorHandler } from '../../utils/errorHandler';
import { UploadConfig } from '../../constants/uploadConfig';
import { LogMessages } from '../../constants/logMessages';
import { uploadLogger } from '../../services/LoggerService';
import { EmailService } from '../../services/EmailService';

/**
 * 檔案上傳處理狀態
 */
interface UploadState {
  uploadedFile: Express.Multer.File;
  excelData?: any;
  dbResult?: any;
}

/**
 * 財務部檔案上傳 API
 *
 * POST /api/upload/finance
 *
 * 保持現有邏輯不變，確保財務部功能完全不受影響
 */
export default defineEventHandler(async (event) => {
  let uploadedFile: Express.Multer.File | null = null;

  try {
    // 驗證請求方法
    if (event.node.req.method !== 'POST') {
      ErrorHandler.methodNotAllowed();
    }

    // 處理檔案上傳
    uploadedFile = await handleFileUpload(event);

    // 執行處理管道
    const result = await processUploadPipeline(uploadedFile);

    // 發送 Email 通知（非阻塞，不影響回應）
    EmailService.sendUploadNotification({
      ...result,
      department: '財務部門',
    }).catch((error) => {
      uploadLogger.warn('Email 通知發送失敗（不影響上傳流程）', error);
    });

    // 清理暫存檔案
    await ExcelService.cleanupFile(uploadedFile.path);

    return result;
  } catch (error: any) {
    uploadLogger.error(LogMessages.fileProcessingError, error);

    // 清理暫存檔案
    if (uploadedFile) {
      await ExcelService.cleanupFile(uploadedFile.path);
    }

    // 統一錯誤處理
    ErrorHandler.handleUploadError(error);
  }
});

/**
 * 處理檔案上傳
 */
async function handleFileUpload(event: any): Promise<Express.Multer.File> {
  try {
    const file = await FileUploadHandler.handleUpload(
      event.node.req,
      event.node.res
    );

    uploadLogger.info(LogMessages.fileUploadSuccess(file.originalname), {
      fileName: file.originalname,
      fileSize: file.size,
    });

    return file;
  } catch (error: any) {
    if (error.message === 'NO_FILE') {
      ErrorHandler.noFileSelected();
    }
    throw error;
  }
}

/**
 * 處理管道 - 依序執行所有處理步驟
 */
async function processUploadPipeline(
  uploadedFile: Express.Multer.File
): Promise<any> {
  // 建立初始狀態
  const state: UploadState = { uploadedFile };

  // 執行處理管道
  await validateDatabaseConnection();
  state.excelData = await parseAndValidateExcel(state.uploadedFile);
  await enrichExcelData(state.excelData);
  await ensureTableStructure();
  state.dbResult = await insertToDatabase(state.excelData);

  // 建立回應
  return buildSuccessResponse(state);
}

/**
 * 驗證資料庫連接
 */
async function validateDatabaseConnection(): Promise<void> {
  uploadLogger.info(LogMessages.testingDatabaseConnection);

  const dbConnected = await DatabaseService.testConnection();
  if (!dbConnected) {
    ErrorHandler.databaseConnectionFailed();
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
    UploadConfig.TABLE_NAME
  );

  if (!dbResult.success) {
    ErrorHandler.databaseOperationFailed(dbResult.errors);
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

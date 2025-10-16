import { defineEventHandler } from 'h3';
import { ExcelGeneratorService } from '../services/ExcelGeneratorService';
import { FileUploadHandler } from '../utils/fileUploadHandler';
import { ErrorHandler } from '../utils/errorHandler';
import { uploadLogger } from '../services/LoggerService';

export default defineEventHandler(async (event) => {
  let uploadedFile: Express.Multer.File | null = null;

  try {
    // 驗證請求方法
    if (event.node.req.method !== 'POST') {
      ErrorHandler.methodNotAllowed();
    }

    uploadLogger.info('開始處理 Excel 檔案 (jim測試用)');

    // 處理檔案上傳
    uploadedFile = await handleFileUpload(event);

    // 處理 Excel 檔案
    const processedExcelBuffer = await ExcelGeneratorService.processExcelFile(
      uploadedFile.path
    );

    // 生成檔案名稱
    const fileName = ExcelGeneratorService.generateFileName(
      uploadedFile.originalname
    );

    // 設定回應標頭
    setHeader(
      event,
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    setHeader(
      event,
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileName)}"`
    );
    setHeader(event, 'Content-Length', processedExcelBuffer.length.toString());

    uploadLogger.info('Excel 檔案處理完成 (jim測試用)', {
      originalName: uploadedFile.originalname,
      processedName: fileName,
      fileSize: processedExcelBuffer.length,
    });

    // 清理暫存檔案
    await ExcelGeneratorService.cleanupFile(uploadedFile.path);

    // 返回處理後的 Excel 檔案
    return processedExcelBuffer;
  } catch (error: any) {
    uploadLogger.error('Excel 檔案處理失敗 (jim測試用)', error);

    // 清理暫存檔案
    if (uploadedFile) {
      await ExcelGeneratorService.cleanupFile(uploadedFile.path);
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

    uploadLogger.info('檔案上傳成功 (jim測試用)', {
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

import { defineEventHandler } from 'h3';
import { FileUploadHandler } from '../../utils/fileUploadHandler';
import { ErrorHandler } from '../../utils/errorHandler';
import { UploadProcessor } from '../../utils/uploadProcessor';
import { RoadConstructionDepartmentConfig } from '../../config/departmentConfig';
import { ExcelService } from '../../services/ExcelService';
import { uploadLogger } from '../../services/LoggerService';
import { EmailService } from '../../services/EmailService';

/**
 * 道路施工部檔案上傳 API
 *
 * POST /api/upload/road-construction
 *
 * 使用通用處理器 + 道路施工部配置
 * 完全獨立於財務部邏輯
 */
export default defineEventHandler(async (event) => {
  let uploadedFile: Express.Multer.File | null = null;

  try {
    // 驗證請求方法
    if (event.node.req.method !== 'POST') {
      ErrorHandler.methodNotAllowed();
    }

    // 處理檔案上傳
    uploadedFile = await FileUploadHandler.handleUpload(
      event.node.req,
      event.node.res
    );

    uploadLogger.info('道路施工部檔案上傳成功', {
      fileName: uploadedFile.originalname,
      fileSize: uploadedFile.size,
    });

    // 使用通用處理器 + 道路施工部配置
    const result = await UploadProcessor.processUpload(
      uploadedFile,
      RoadConstructionDepartmentConfig
    );

    // 發送 Email 通知（非阻塞，不影響回應）
    EmailService.sendUploadNotification(result).catch((error) => {
      uploadLogger.warn('Email 通知發送失敗（不影響上傳流程）', error);
    });

    // 清理暫存檔案
    await ExcelService.cleanupFile(uploadedFile.path);

    return result;
  } catch (error: any) {
    uploadLogger.error('道路施工部檔案處理失敗', error);

    // 清理暫存檔案
    if (uploadedFile) {
      try {
        await ExcelService.cleanupFile(uploadedFile.path);
      } catch (cleanupError: any) {
        uploadLogger.warn('清理暫存檔案失敗', cleanupError as Error);
      }
    }

    // 統一錯誤處理
    ErrorHandler.handleUploadError(error);
  }
});

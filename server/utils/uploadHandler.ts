import { FileUploadHandler } from './fileUploadHandler';
import { ErrorHandler } from './errorHandler';
import { ExcelService } from '../services/ExcelService';
import { EmailService } from '../services/EmailService';
import { uploadLogger } from '../services/LoggerService';

/**
 * 上傳處理選項
 */
export interface UploadHandlerOptions {
  department: string;
  processUpload: (file: Express.Multer.File) => Promise<any>;
  onSuccess?: (result: any, file: Express.Multer.File) => void;
  onError?: (error: any, file: Express.Multer.File | null) => void;
}

/**
 * 通用上傳處理器
 * 統一處理檔案上傳、郵件通知、檔案清理等邏輯
 */
export class UploadHandler {
  /**
   * 處理上傳請求（包含錯誤處理、郵件通知、檔案清理）
   */
  static async handleUploadRequest(
    event: any,
    options: UploadHandlerOptions
  ): Promise<any> {
    let uploadedFile: Express.Multer.File | null = null;

    try {
      this.validateMethod(event);
      uploadedFile = await this.handleFileUpload(event);
      const result = await options.processUpload(uploadedFile);

      this.sendSuccessNotification(result, options.department);
      this.cleanupFile(uploadedFile.path);

      if (options.onSuccess) {
        options.onSuccess(result, uploadedFile);
      }

      return result;
    } catch (error: any) {
      this.handleError(error, uploadedFile, options);
      if (options.onError) {
        options.onError(error, uploadedFile);
      }
      ErrorHandler.handleUploadError(error);
    }
  }

  /**
   * 驗證 HTTP 方法
   */
  private static validateMethod(event: any): void {
    if (event.node.req.method !== 'POST') {
      ErrorHandler.methodNotAllowed();
    }
  }

  /**
   * 處理檔案上傳
   */
  private static async handleFileUpload(
    event: any
  ): Promise<Express.Multer.File> {
    try {
      const file = await FileUploadHandler.handleUpload(
        event.node.req,
        event.node.res
      );
      return file;
    } catch (error: any) {
      if (error.message === 'NO_FILE') {
        ErrorHandler.noFileSelected();
      }
      throw error;
    }
  }

  /**
   * 發送成功通知郵件
   */
  private static sendSuccessNotification(
    result: any,
    department: string
  ): void {
    EmailService.sendUploadNotification({
      ...result,
      department,
    }).catch((error) => {
      uploadLogger.warn('Email 通知發送失敗（不影響上傳流程）', error);
    });
  }

  /**
   * 處理錯誤（發送失敗通知、清理檔案）
   */
  private static handleError(
    error: any,
    uploadedFile: Express.Multer.File | null,
    options: UploadHandlerOptions
  ): void {
    uploadLogger.error('檔案處理失敗', error, {
      department: options.department,
    });

    if (uploadedFile) {
      this.sendFailureNotification(error, uploadedFile, options.department);
      this.cleanupFile(uploadedFile.path);
    }
  }

  /**
   * 發送失敗通知郵件
   */
  private static sendFailureNotification(
    error: any,
    uploadedFile: Express.Multer.File,
    department: string
  ): void {
    EmailService.sendUploadNotification({
      success: false,
      message: error.message || 'Excel 檔案處理失敗',
      department,
      data: {
        fileName: uploadedFile.originalname,
        fileSize: uploadedFile.size,
        uploadTime: new Date().toISOString(),
        errors: [error.message || String(error)],
      },
    }).catch((emailError) => {
      uploadLogger.warn('失敗通知郵件發送失敗', emailError);
    });
  }

  /**
   * 清理暫存檔案
   */
  private static cleanupFile(filePath: string): void {
    ExcelService.cleanupFile(filePath).catch((error) => {
      uploadLogger.warn('清理暫存檔案失敗', error);
    });
  }
}

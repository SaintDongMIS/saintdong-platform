import { createError } from 'h3';
import { ErrorMessages, HttpStatus } from '../constants/errorMessages';

/**
 * 統一的錯誤處理工具
 */
export class ErrorHandler {
  /**
   * 處理上傳相關錯誤
   */
  static handleUploadError(error: any): never {
    // 檔案大小超過限制
    if (error.code === 'LIMIT_FILE_SIZE') {
      throw createError({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        statusMessage: ErrorMessages.FILE_SIZE_EXCEEDED,
      });
    }

    // 檔案類型錯誤
    if (error.message?.includes('只允許上傳 Excel 檔案')) {
      throw createError({
        statusCode: HttpStatus.BAD_REQUEST,
        statusMessage: ErrorMessages.INVALID_FILE_TYPE,
      });
    }

    // Excel 解析錯誤
    if (error.message?.includes('Excel 檔案解析失敗')) {
      throw createError({
        statusCode: HttpStatus.BAD_REQUEST,
        statusMessage: error.message,
      });
    }

    // 資料庫錯誤
    if (error.message?.includes('資料庫')) {
      throw createError({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusMessage: error.message,
      });
    }

    // 預設錯誤
    throw createError({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      statusMessage: error.message || ErrorMessages.FILE_PROCESSING_FAILED,
    });
  }

  /**
   * 建立方法不允許錯誤
   */
  static methodNotAllowed(): never {
    throw createError({
      statusCode: HttpStatus.METHOD_NOT_ALLOWED,
      statusMessage: ErrorMessages.METHOD_NOT_ALLOWED,
    });
  }

  /**
   * 建立沒有檔案錯誤
   */
  static noFileSelected(): never {
    throw createError({
      statusCode: HttpStatus.BAD_REQUEST,
      statusMessage: ErrorMessages.NO_FILE_SELECTED,
    });
  }

  /**
   * 建立資料庫連接失敗錯誤
   */
  static databaseConnectionFailed(): never {
    throw new Error(ErrorMessages.DATABASE_CONNECTION_FAILED);
  }

  /**
   * 建立資料庫操作失敗錯誤
   */
  static databaseOperationFailed(errors: string[]): never {
    throw new Error(
      `${ErrorMessages.DATABASE_OPERATION_FAILED}: ${errors.join(', ')}`
    );
  }
}

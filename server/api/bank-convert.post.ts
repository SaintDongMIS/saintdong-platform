import { defineEventHandler, setHeader } from 'h3';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import multer from 'multer';
import { BankConverterService } from '../services/BankConverterService';
import { ErrorHandler } from '../utils/errorHandler';
import { apiLogger } from '../services/LoggerService';

/**
 * 國泰網銀付款檔案轉換 API
 *
 * POST /api/bank-convert
 * Content-Type: multipart/form-data
 * Body: file (網銀付款匯出檔案)
 *
 * Response: 轉換後的檔案（Binary，Big5 編碼）
 */
export default defineEventHandler(async (event) => {
  let uploadedFile: Express.Multer.File | null = null;

  try {
    // 驗證方法
    if (event.node.req.method !== 'POST') {
      ErrorHandler.methodNotAllowed();
    }

    // 處理檔案上傳（使用 multer，自訂 fileFilter 來允許 .txt）
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        const tempPath = path.join(os.tmpdir(), 'saintdong-uploads');
        try {
          await fs.access(tempPath);
        } catch {
          await fs.mkdir(tempPath, { recursive: true });
        }
        cb(null, tempPath);
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.originalname}`;
        cb(null, fileName);
      },
    });

    const upload = multer({
      storage,
      fileFilter: (req: any, file, cb: any) => {
        const fileExtension = file.originalname
          .toLowerCase()
          .substring(file.originalname.lastIndexOf('.'));
        if (fileExtension === '.txt') {
          cb(null, true);
        } else {
          cb(new Error('只允許上傳 .txt 檔案'), false);
        }
      },
    });

    uploadedFile = await new Promise<Express.Multer.File>((resolve, reject) => {
      upload.single('file')(
        event.node.req as any,
        event.node.res as any,
        (err: any) => {
          if (err) {
            reject(err);
          } else if (!(event.node.req as any).file) {
            reject(new Error('NO_FILE'));
          } else {
            resolve((event.node.req as any).file);
          }
        }
      );
    });

    // 讀取檔案 Buffer
    apiLogger.info('開始處理銀行轉換請求', {
      filename: uploadedFile.originalname,
      size: uploadedFile.size,
    });

    const inputBuffer = await fs.readFile(uploadedFile.path);

    // 驗證檔案不為空
    if (inputBuffer.length === 0) {
      apiLogger.error('上傳的檔案是空檔案', {
        filename: uploadedFile.originalname,
      });
      throw new Error('上傳的檔案是空檔案');
    }

    // 轉換檔案
    const converter = new BankConverterService();
    let outputBuffer: Buffer;
    try {
      outputBuffer = converter.convertFileBuffer(inputBuffer);
    } catch (convertError: any) {
      apiLogger.error('檔案轉換失敗', convertError, {
        filename: uploadedFile.originalname,
        inputSize: inputBuffer.length,
      });
      throw new Error(`檔案轉換失敗：${convertError.message || '未知錯誤'}`);
    }

    // 驗證轉換結果不為空
    if (!outputBuffer || outputBuffer.length === 0) {
      apiLogger.error('轉換後的檔案為空', {
        filename: uploadedFile.originalname,
        inputSize: inputBuffer.length,
      });
      throw new Error('轉換後的檔案為空，請檢查輸入檔案格式是否正確');
    }

    apiLogger.info('銀行轉換成功', {
      filename: uploadedFile.originalname,
      inputSize: inputBuffer.length,
      outputSize: outputBuffer.length,
    });

    // 生成檔名（台灣時間戳格式：MMDDHHRR，其中 RR 是分鐘）
    // 使用 Intl.DateTimeFormat 取得台灣時間
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const month = parts.find((p) => p.type === 'month')?.value || '01';
    const day = parts.find((p) => p.type === 'day')?.value || '01';
    const hour = parts.find((p) => p.type === 'hour')?.value || '00';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';
    const timestamp = `${month}${day}${hour}${minute}`;
    const filename = `commeet整批付款_${timestamp}.txt`;

    // 設定回應標頭（下載檔案）
    setHeader(event, 'Content-Type', 'text/plain; charset=big5');
    setHeader(
      event,
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`
    );
    setHeader(event, 'Content-Length', outputBuffer.length);

    // 清理暫存檔案
    await fs.unlink(uploadedFile.path).catch(() => {
      // 忽略清理錯誤
    });

    return outputBuffer;
  } catch (error: any) {
    // 清理暫存檔案
    if (uploadedFile) {
      await fs.unlink(uploadedFile.path).catch(() => {
        // 忽略清理錯誤
      });
    }
    ErrorHandler.handleUploadError(error);
  }
});

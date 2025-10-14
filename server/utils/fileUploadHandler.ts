import multer from 'multer';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { UploadConfig } from '../constants/uploadConfig';

/**
 * 檔案上傳處理工具
 */
export class FileUploadHandler {
  private static upload: multer.Multer;

  /**
   * 取得 multer 實例
   */
  static getUploader(): multer.Multer {
    if (!this.upload) {
      this.upload = this.createUploader();
    }
    return this.upload;
  }

  /**
   * 建立 multer 上傳器
   */
  private static createUploader(): multer.Multer {
    return multer({
      storage: this.createStorage(),
      fileFilter: this.fileFilter,
      limits: {
        fileSize: UploadConfig.MAX_FILE_SIZE,
      },
    });
  }

  /**
   * 建立儲存配置
   */
  private static createStorage(): multer.StorageEngine {
    return multer.diskStorage({
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
  }

  /**
   * 檔案過濾器
   */
  private static fileFilter(
    req: any,
    file: Express.Multer.File,
    cb: any
  ): void {
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf('.'));

    const isValidMimeType = UploadConfig.ALLOWED_MIME_TYPES.includes(
      file.mimetype
    );
    const isValidExtension =
      UploadConfig.ALLOWED_EXTENSIONS.includes(fileExtension);

    if (isValidMimeType || isValidExtension) {
      cb(null, true);
    } else {
      cb(
        new Error('只允許上傳 Excel 檔案 (.xlsx, .xls) 或 CSV 檔案 (.csv)'),
        false
      );
    }
  }

  /**
   * 處理檔案上傳
   */
  static async handleUpload(req: any, res: any): Promise<Express.Multer.File> {
    return new Promise((resolve, reject) => {
      this.getUploader().single('file')(req, res, (err) => {
        if (err) {
          reject(err);
        } else if (!req.file) {
          reject(new Error('NO_FILE'));
        } else {
          resolve(req.file);
        }
      });
    });
  }
}

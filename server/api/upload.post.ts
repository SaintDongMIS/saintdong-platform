import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// 設定 multer 儲存配置
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // 儲存到桌面
    const desktopPath = path.join(os.homedir(), 'Desktop');
    try {
      await fs.access(desktopPath);
    } catch {
      // 如果桌面目錄不存在，建立它
      await fs.mkdir(desktopPath, { recursive: true });
    }
    cb(null, desktopPath);
  },
  filename: (req, file, cb) => {
    // 生成唯一檔名：時間戳_原始檔名
    const timestamp = Date.now();
    const originalName = file.originalname;
    const fileName = `${timestamp}_${originalName}`;
    cb(null, fileName);
  },
});

// 檔案過濾器
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // 只允許 Excel 檔案
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只允許上傳 Excel 檔案 (.xlsx 或 .xls)'), false);
  }
};

// 建立 multer 實例
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 限制檔案大小為 10MB
  },
});

export default defineEventHandler(async (event) => {
  try {
    // 檢查請求方法
    if (event.node.req.method !== 'POST') {
      throw createError({
        statusCode: 405,
        statusMessage: 'Method Not Allowed',
      });
    }

    // 使用 multer 處理檔案上傳
    await new Promise((resolve, reject) => {
      upload.single('file')(event.node.req, event.node.res, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });

    // 檢查是否有檔案上傳
    if (!event.node.req.file) {
      throw createError({
        statusCode: 400,
        statusMessage: '沒有選擇檔案',
      });
    }

    const file = event.node.req.file;

    // 回傳成功訊息和檔案路徑
    return {
      success: true,
      message: '檔案上傳成功',
      filePath: file.path,
      fileName: file.filename,
      originalName: file.originalname,
      size: file.size,
      uploadTime: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('檔案上傳錯誤:', error);

    // 根據錯誤類型回傳適當的錯誤訊息
    if (error.code === 'LIMIT_FILE_SIZE') {
      throw createError({
        statusCode: 413,
        statusMessage: '檔案大小超過限制 (10MB)',
      });
    }

    if (error.message.includes('只允許上傳 Excel 檔案')) {
      throw createError({
        statusCode: 400,
        statusMessage: '只允許上傳 Excel 檔案 (.xlsx 或 .xls)',
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || '檔案上傳失敗',
    });
  }
});

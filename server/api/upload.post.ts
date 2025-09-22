import multer from 'multer';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { defineEventHandler, createError } from 'h3';
import { ExcelService } from '../services/ExcelService';
import { DatabaseService } from '../services/DatabaseService';

// 設定 multer 儲存配置
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // 儲存到暫存目錄
    const tempPath = path.join(os.tmpdir(), 'saintdong-uploads');
    try {
      await fs.access(tempPath);
    } catch {
      // 如果暫存目錄不存在，建立它
      await fs.mkdir(tempPath, { recursive: true });
    }
    cb(null, tempPath);
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
  // 允許 Excel 和 CSV 檔案
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv', // .csv
    'application/csv', // .csv
  ];

  // 也檢查檔案副檔名
  const allowedExtensions = ['.xlsx', '.xls', '.csv'];
  const fileExtension = file.originalname
    .toLowerCase()
    .substring(file.originalname.lastIndexOf('.'));

  if (
    allowedTypes.includes(file.mimetype) ||
    allowedExtensions.includes(fileExtension)
  ) {
    cb(null, true);
  } else {
    cb(
      new Error('只允許上傳 Excel 檔案 (.xlsx, .xls) 或 CSV 檔案 (.csv)'),
      false
    );
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
  let uploadedFile: Express.Multer.File | null = null;

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
      upload.single('file')(
        event.node.req as any,
        event.node.res as any,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(true);
          }
        }
      );
    });

    // 檢查是否有檔案上傳
    if (!(event.node.req as any).file) {
      throw createError({
        statusCode: 400,
        statusMessage: '沒有選擇檔案',
      });
    }

    uploadedFile = (event.node.req as any).file;
    console.log(`📁 檔案上傳成功: ${uploadedFile!.originalname}`);

    // 1. 解析 Excel 檔案
    console.log('📊 開始解析 Excel 檔案...');
    const excelData = await ExcelService.parseExcel(uploadedFile!.path);
    console.log(
      `✅ Excel 解析完成: 總行數 ${excelData.totalRows}, 有效行數 ${excelData.validRows}, 跳過空行 ${excelData.skippedRows}`
    );

    // 2. 驗證 Excel 資料格式
    const requiredFields = ['表單編號', '申請人姓名', '表單本幣總計']; // 必要欄位
    ExcelService.validateExcelData(excelData, requiredFields);
    console.log('✅ Excel 資料格式驗證通過');

    // 2.5. 資料預處理與擴充 (例如：填補銀行名稱)
    console.log('✨ 開始資料預處理與擴充...');
    ExcelService.enrichBankData(excelData.rows);
    console.log('✅ 資料擴充完成');

    // 3. 測試資料庫連接
    console.log('🔗 測試資料庫連接...');
    const dbConnected = await DatabaseService.testConnection();
    if (!dbConnected) {
      throw new Error('資料庫連接失敗');
    }
    console.log('✅ 資料庫連接正常');

    // 4. 批次插入資料到資料庫
    console.log('💾 開始批次插入資料到資料庫...');
    const tableName = '費用報銷單'; // 使用費用報銷單資料表
    const dbResult = await DatabaseService.batchInsertData(
      excelData.rows,
      tableName
    );

    if (!dbResult.success) {
      throw new Error(`資料庫操作失敗: ${dbResult.errors.join(', ')}`);
    }

    console.log(
      `✅ 資料庫操作完成: 成功插入 ${dbResult.insertedCount} 筆, 跳過 ${dbResult.skippedCount} 筆`
    );

    // 5. 清理暫存檔案
    await ExcelService.cleanupFile(uploadedFile!.path);

    // 回傳處理結果
    return {
      success: true,
      message: 'Excel 檔案處理完成',
      data: {
        fileName: uploadedFile!.originalname,
        fileSize: uploadedFile!.size,
        uploadTime: new Date().toISOString(),
        excelStats: {
          totalRows: excelData.totalRows,
          validRows: excelData.validRows,
          skippedRows: excelData.skippedRows,
          headers: excelData.headers,
        },
        databaseStats: {
          insertedCount: dbResult.insertedCount,
          skippedCount: dbResult.skippedCount,
          errorCount: dbResult.errors.length,
        },
        errors: dbResult.errors,
      },
    };
  } catch (error: any) {
    console.error('❌ 檔案處理錯誤:', error);

    // 清理暫存檔案
    if (uploadedFile) {
      await ExcelService.cleanupFile(uploadedFile.path);
    }

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

    if (error.message.includes('Excel 檔案解析失敗')) {
      throw createError({
        statusCode: 400,
        statusMessage: error.message,
      });
    }

    if (error.message.includes('資料庫')) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message,
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || '檔案處理失敗',
    });
  }
});

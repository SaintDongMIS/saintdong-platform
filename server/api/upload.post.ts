import multer from 'multer';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { defineEventHandler, createError } from 'h3';
import { ExcelService } from '../services/ExcelService';
import { DatabaseService } from '../services/DatabaseService';
import { getConnectionPool } from '../config/database';
import { reimbursementTableSchema } from '../services/TableDefinitionService';
import { uploadLogger } from '../services/LoggerService';

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
    uploadLogger.info(`檔案上傳成功: ${uploadedFile!.originalname}`, {
      fileName: uploadedFile!.originalname,
      fileSize: uploadedFile!.size,
    });

    // 1. 解析 Excel 檔案
    uploadLogger.info('開始解析 Excel 檔案');
    const excelData = await ExcelService.parseExcel(uploadedFile!.path);
    uploadLogger.info('Excel 解析完成', {
      totalRows: excelData.totalRows,
      validRows: excelData.validRows,
      skippedRows: excelData.skippedRows,
    });

    // 2. 驗證 Excel 資料格式
    const requiredFields = ['表單編號', '申請人姓名', '表單本幣總計']; // 必要欄位
    ExcelService.validateExcelData(excelData, requiredFields);
    uploadLogger.info('Excel 資料格式驗證通過');

    // 2.5. 資料預處理與擴充 (例如：填補銀行名稱)
    uploadLogger.info('開始資料預處理與擴充');
    ExcelService.enrichBankData(excelData.rows);
    uploadLogger.info('資料擴充完成');

    // 3. 測試資料庫連接
    uploadLogger.info('測試資料庫連接');
    const dbConnected = await DatabaseService.testConnection();
    if (!dbConnected) {
      throw new Error('資料庫連接失敗');
    }
    uploadLogger.info('資料庫連接正常');

    // 4. 檢查並確保資料表結構是最新的
    uploadLogger.info('檢查資料表結構');
    await ensureTableStructure();
    uploadLogger.info('資料表結構檢查完成');

    // 5. 批次插入資料到資料庫
    uploadLogger.info('開始批次插入資料到資料庫');
    const tableName = 'ExpendForm'; // 使用ExpendForm資料表
    const dbResult = await DatabaseService.batchInsertData(
      excelData.rows,
      tableName
    );

    if (!dbResult.success) {
      throw new Error(`資料庫操作失敗: ${dbResult.errors.join(', ')}`);
    }

    uploadLogger.info('資料庫操作完成', {
      insertedCount: dbResult.insertedCount,
      skippedCount: dbResult.skippedCount,
      errorCount: dbResult.errors.length,
    });

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
    uploadLogger.error('檔案處理錯誤', error);

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

/**
 * 確保資料表結構是最新的
 * 檢查資料表是否存在，如果不存在則建立，如果存在則檢查是否需要新增欄位
 */
async function ensureTableStructure() {
  const pool = await getConnectionPool();

  // 檢查資料表是否存在
  const tableExistsQuery = `
    SELECT COUNT(*) as count 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME = 'ExpendForm'
  `;

  const tableExists = await pool.request().query(tableExistsQuery);
  const exists = tableExists.recordset[0].count > 0;

  if (!exists) {
    // 如果資料表不存在，直接建立
    uploadLogger.info('資料表不存在，建立新資料表');
    const createTableQuery = `
      CREATE TABLE ExpendForm (
        ${reimbursementTableSchema}
      )
    `;
    await pool.request().query(createTableQuery);
    uploadLogger.info('新資料表建立成功');
  } else {
    // 如果資料表存在，檢查是否需要新增欄位
    uploadLogger.info('資料表已存在，檢查結構是否需要更新');
    await migrateTableStructure(pool);
  }
}

/**
 * 遷移資料表結構 - 只新增缺少的欄位
 */
async function migrateTableStructure(pool: any) {
  // 定義期望的欄位結構
  const expectedColumns = parseSchemaColumns(reimbursementTableSchema);

  // 取得現有欄位
  const existingColumnsQuery = `
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'ExpendForm'
  `;

  const existingColumns = await pool.request().query(existingColumnsQuery);
  const existingColumnNames = new Set(
    existingColumns.recordset.map((col: any) => col.COLUMN_NAME)
  );

  // 找出需要新增的欄位
  const columnsToAdd = expectedColumns.filter(
    (col: any) => !existingColumnNames.has(col.name)
  );

  if (columnsToAdd.length === 0) {
    uploadLogger.info('資料表結構已是最新版本，無需更新');
    return;
  }

  uploadLogger.info(`發現 ${columnsToAdd.length} 個新欄位需要新增`, {
    newColumns: columnsToAdd.map((col) => col.name),
  });

  // 逐個新增欄位
  for (const column of columnsToAdd) {
    try {
      const alterQuery = `ALTER TABLE ExpendForm ADD ${column.definition}`;
      await pool.request().query(alterQuery);
      uploadLogger.info(`成功新增欄位: ${column.name}`);
    } catch (error) {
      uploadLogger.error(`新增欄位失敗: ${column.name}`, error);
      throw error;
    }
  }

  uploadLogger.info('資料表結構遷移完成');
}

/**
 * 解析 schema 字串，提取欄位定義
 */
function parseSchemaColumns(
  schema: string
): Array<{ name: string; definition: string }> {
  // 移除換行和額外空格，分割成行
  const lines = schema
    .replace(/\n/g, ' ')
    .split(',')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines
    .map((line) => {
      // 提取欄位名稱 (方括號內的部分)
      const nameMatch = line.match(/\[([^\]]+)\]/);
      const name = nameMatch ? nameMatch[1] : '';

      return {
        name,
        definition: line.trim(),
      };
    })
    .filter((col) => {
      // 過濾掉主鍵欄位，因為主鍵不能透過 ALTER TABLE ADD 新增
      return (
        !col.definition.includes('PRIMARY KEY') &&
        !col.definition.includes('IDENTITY')
      );
    });
}

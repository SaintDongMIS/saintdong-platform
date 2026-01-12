import { defineEventHandler } from 'h3';
import { getConnectionPool } from '../config/database';
import { reimbursementTableSchema } from '../services/TableDefinitionService';
import { apiLogger } from '../services/LoggerService';

export default defineEventHandler(async (event) => {
  try {
    apiLogger.info('更新 ExpendForm 資料表結構');

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
      apiLogger.info('資料表不存在，建立新資料表');
      const createTableQuery = `
        CREATE TABLE ExpendForm (
          ${reimbursementTableSchema}
        )
      `;
      await pool.request().query(createTableQuery);
      apiLogger.info('新資料表建立成功');
    } else {
      // 如果資料表存在，進行結構遷移
      apiLogger.info('資料表已存在，開始結構遷移');
      await migrateTableStructure(pool);
    }

    return {
      success: true,
      message: 'ExpendForm 資料表結構更新成功',
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    apiLogger.error('更新資料表失敗', error);

    return {
      success: false,
      message: error.message || '更新資料表失敗',
      timestamp: new Date().toISOString(),
    };
  }
});

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
    apiLogger.info('資料表結構已是最新版本，無需更新');
    return;
  }

  apiLogger.info(`發現 ${columnsToAdd.length} 個新欄位需要新增`, {
    newColumns: columnsToAdd.map((col) => col.name),
  });

  // 逐個新增欄位
  for (const column of columnsToAdd) {
    try {
      const alterQuery = `ALTER TABLE ExpendForm ADD ${column.definition}`;
      await pool.request().query(alterQuery);
      apiLogger.info(`成功新增欄位: ${column.name}`);
    } catch (error) {
      apiLogger.error(`新增欄位失敗: ${column.name}`, error);
      throw error;
    }
  }

  apiLogger.info('資料表結構遷移完成');
}

/**
 * 解析 schema 字串，提取欄位定義
 * 使用智能分割，正確處理括號內的逗號（如 DECIMAL(18,2)）
 */
function parseSchemaColumns(
  schema: string
): Array<{ name: string; definition: string }> {
  // 移除換行，轉換為單行字串
  const normalizedSchema = schema.replace(/\n/g, ' ').trim();

  const columns: string[] = [];
  let currentColumn = '';
  let depth = 0; // 追蹤括號深度
  let inBrackets = false; // 追蹤是否在方括號內（欄位名稱）

  for (let i = 0; i < normalizedSchema.length; i++) {
    const char = normalizedSchema[i];

    if (char === '[') {
      inBrackets = true;
      currentColumn += char;
    } else if (char === ']') {
      inBrackets = false;
      currentColumn += char;
    } else if (char === '(') {
      depth++;
      currentColumn += char;
    } else if (char === ')') {
      depth--;
      currentColumn += char;
    } else if (char === ',' && depth === 0 && !inBrackets) {
      // 只有在括號深度為 0 且不在方括號內時，才視為欄位分隔符
      const trimmed = currentColumn.trim();
      if (trimmed.length > 0) {
        columns.push(trimmed);
      }
      currentColumn = '';
    } else {
      currentColumn += char;
    }
  }

  // 處理最後一個欄位
  const trimmed = currentColumn.trim();
  if (trimmed.length > 0) {
    columns.push(trimmed);
  }

  return columns
    .map((definition) => {
      // 提取欄位名稱 (方括號內的部分)
      const nameMatch = definition.match(/\[([^\]]+)\]/);
      const name = nameMatch ? nameMatch[1] : '';

      return {
        name,
        definition: definition.trim(),
      };
    })
    .filter((col): col is { name: string; definition: string } => {
      // 過濾掉主鍵欄位和約束，因為這些不能透過 ALTER TABLE ADD 新增
      // 同時確保 name 不為空
      return (
        !!col.name &&
        col.name.length > 0 &&
        !col.definition.includes('PRIMARY KEY') &&
        !col.definition.includes('IDENTITY') &&
        !col.definition.includes('CONSTRAINT') &&
        !col.definition.includes('UNIQUE')
      );
    });
}

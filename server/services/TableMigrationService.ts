import { getConnectionPool } from '../config/database';
import { reimbursementTableSchema } from './TableDefinitionService';
import { uploadLogger } from './LoggerService';

/**
 * 資料表遷移服務
 * 負責確保資料表結構是最新的
 */
export class TableMigrationService {
  /**
   * 確保資料表結構是最新的
   */
  static async ensureTableStructure(tableName: string): Promise<void> {
    const pool = await getConnectionPool();
    const exists = await this.checkTableExists(pool, tableName);

    if (!exists) {
      await this.createTable(pool, tableName);
    } else {
      await this.migrateTableStructure(pool, tableName);
    }
  }

  /**
   * 檢查資料表是否存在
   */
  private static async checkTableExists(
    pool: any,
    tableName: string
  ): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = @tableName
    `;

    const result = await pool
      .request()
      .input('tableName', tableName)
      .query(query);

    return result.recordset[0].count > 0;
  }

  /**
   * 建立資料表
   */
  private static async createTable(
    pool: any,
    tableName: string
  ): Promise<void> {
    uploadLogger.info('資料表不存在，建立新資料表');

    const createTableQuery = `
      CREATE TABLE ${tableName} (
        ${reimbursementTableSchema}
      )
    `;

    await pool.request().query(createTableQuery);
    uploadLogger.info('新資料表建立成功');
  }

  /**
   * 遷移資料表結構 - 只新增缺少的欄位
   */
  private static async migrateTableStructure(
    pool: any,
    tableName: string
  ): Promise<void> {
    uploadLogger.info('資料表已存在，檢查結構是否需要更新');

    const expectedColumns = this.parseSchemaColumns(reimbursementTableSchema);
    const existingColumns = await this.getExistingColumns(pool, tableName);
    const columnsToAdd = this.findMissingColumns(
      expectedColumns,
      existingColumns
    );

    if (columnsToAdd.length === 0) {
      uploadLogger.info('資料表結構已是最新版本，無需更新');
      return;
    }

    await this.addColumns(pool, tableName, columnsToAdd);
    uploadLogger.info('資料表結構遷移完成');
  }

  /**
   * 取得現有欄位
   */
  private static async getExistingColumns(
    pool: any,
    tableName: string
  ): Promise<Set<string>> {
    const query = `
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = @tableName
    `;

    const result = await pool
      .request()
      .input('tableName', tableName)
      .query(query);

    return new Set(result.recordset.map((col: any) => col.COLUMN_NAME));
  }

  /**
   * 找出缺少的欄位
   */
  private static findMissingColumns(
    expectedColumns: Array<{ name: string; definition: string }>,
    existingColumns: Set<string>
  ): Array<{ name: string; definition: string }> {
    return expectedColumns.filter((col) => !existingColumns.has(col.name));
  }

  /**
   * 新增欄位到資料表
   */
  private static async addColumns(
    pool: any,
    tableName: string,
    columns: Array<{ name: string; definition: string }>
  ): Promise<void> {
    uploadLogger.info(`發現 ${columns.length} 個新欄位需要新增`, {
      newColumns: columns.map((col) => col.name),
    });

    const validColumns = this.validateColumns(columns);

    if (validColumns.length === 0) {
      uploadLogger.info('沒有有效的欄位需要新增');
      return;
    }

    uploadLogger.info(`將新增 ${validColumns.length} 個有效欄位`, {
      validColumns: validColumns.map((col) => col.name),
    });

    for (const column of validColumns) {
      await this.addColumn(pool, tableName, column);
    }
  }

  /**
   * 驗證欄位定義
   */
  private static validateColumns(
    columns: Array<{ name: string; definition: string }>
  ): Array<{ name: string; definition: string }> {
    return columns.filter((col) => {
      const isValid =
        col.name &&
        col.name.length > 0 &&
        col.definition &&
        col.definition.length > 0;

      if (!isValid) {
        uploadLogger.warn(`跳過無效欄位定義: ${JSON.stringify(col)}`);
      }

      return isValid;
    });
  }

  /**
   * 新增單一欄位
   */
  private static async addColumn(
    pool: any,
    tableName: string,
    column: { name: string; definition: string }
  ): Promise<void> {
    try {
      const alterQuery = `ALTER TABLE ${tableName} ADD ${column.definition}`;

      uploadLogger.info(`嘗試新增欄位: ${column.name}`, {
        definition: column.definition,
      });

      await pool.request().query(alterQuery);
      uploadLogger.info(`成功新增欄位: ${column.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      uploadLogger.error(`新增欄位失敗: ${column.name}`, {
        error: errorMessage,
        definition: column.definition,
      });
      throw error;
    }
  }

  /**
   * 解析 schema 字串，提取欄位定義
   */
  private static parseSchemaColumns(
    schema: string
  ): Array<{ name: string; definition: string }> {
    const lines = schema
      .replace(/\n/g, ' ')
      .split(',')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const columns = lines.map((line) => {
      const nameMatch = line.match(/\[([^\]]+)\]/);
      const name: string = nameMatch?.[1] || '';

      return { name, definition: line.trim() };
    });

    return columns.filter((col): col is { name: string; definition: string } =>
      this.isValidColumnDefinition(col)
    );
  }

  /**
   * 檢查欄位定義是否有效（類型守衛）
   */
  private static isValidColumnDefinition(col: {
    name: string;
    definition: string;
  }): col is { name: string; definition: string } {
    return (
      !!col.name &&
      col.name.length > 0 &&
      !!col.definition &&
      col.definition.length > 0 &&
      !col.definition.includes('PRIMARY KEY') &&
      !col.definition.includes('IDENTITY') &&
      !col.definition.includes('DEFAULT')
    );
  }
}

import sql from 'mssql';
import { getConnectionPool } from '../config/database';
import type { ExcelRow } from './ExcelService';
import { dbLogger } from './LoggerService';

export interface DatabaseResult {
  success: boolean;
  insertedCount: number;
  skippedCount: number;
  errors: string[];
}

export class DatabaseService {
  /**
   * 檢查表單編號是否已存在
   */
  static async checkFormExists(
    formNumber: string,
    tableName: string
  ): Promise<boolean> {
    const pool = await getConnectionPool();

    try {
      const result = await pool
        .request()
        .input('formNumber', sql.NVarChar, formNumber)
        .query(
          `SELECT COUNT(*) as count FROM ${tableName} WHERE 表單編號 = @formNumber`
        );

      return result.recordset[0].count > 0;
    } catch (error) {
      dbLogger.error('檢查表單編號失敗', error);
      throw error;
    }
  }

  /**
   * 批次插入資料到資料庫 - 移除檔案內部重複檢查，只保留資料庫重複檢查
   */
  static async batchInsertData(
    data: ExcelRow[],
    tableName: string,
    formNumberField: string = '表單編號'
  ): Promise<DatabaseResult> {
    return this.executeBatchInsert(
      data,
      tableName,
      (row) => {
        const formNumber = row[formNumberField];
        if (!formNumber) {
          return null;
        }

        const trimmedFormNumber = formNumber.toString().trim();
        const expenseItem = row['費用項目'] || '';
        const invoiceNumber = row['發票號碼'] || '';
        const transactionDate = row['交易日期'] || '';
        const itemAmount = parseFloat(row['項目原幣金額'] || '0').toFixed(2);

        return `${trimmedFormNumber}-${expenseItem}-${invoiceNumber}-${transactionDate}-${itemAmount}`;
      },
      (row) => {
        const formNumber = row[formNumberField];
        if (!formNumber) {
          return `資料行缺少表單編號: ${JSON.stringify(row)}`;
        }
        return null;
      },
      this.batchCheckExistingData.bind(this)
    );
  }

  /**
   * 批次檢查已存在的資料 - 單次查詢，O(1) 效能
   */
  private static async batchCheckExistingData(
    transaction: any,
    data: ExcelRow[],
    tableName: string
  ): Promise<Set<string>> {
    if (data.length === 0) return new Set();

    // 建立所有可能的複合鍵
    const compositeKeys = data
      .map((row) => {
        const formNumber = row['表單編號']?.toString().trim() || '';
        const expenseItem = row['費用項目'] || '';
        const invoiceNumber = row['發票號碼'] || '';
        const transactionDate = row['交易日期'] || '';
        const itemAmount = parseFloat(row['項目原幣金額'] || '0').toFixed(2);
        return `${formNumber}-${expenseItem}-${invoiceNumber}-${transactionDate}-${itemAmount}`;
      })
      .filter((key) => key !== '----'); // 過濾空鍵

    if (compositeKeys.length === 0) return new Set();

    // 使用 IN 子查詢，效能最佳
    const request = new sql.Request(transaction);
    const query = `
      SELECT DISTINCT 
        [表單編號] + '-' + ISNULL([費用項目], '') + '-' + ISNULL([發票號碼], '') + '-' + 
        CONVERT(VARCHAR(10), [交易日期], 120) + '-' + CAST([項目原幣金額] AS VARCHAR(20)) as composite_key
      FROM ${tableName}
      WHERE [表單編號] + '-' + ISNULL([費用項目], '') + '-' + ISNULL([發票號碼], '') + '-' + 
            CONVERT(VARCHAR(10), [交易日期], 120) + '-' + CAST([項目原幣金額] AS VARCHAR(20)) 
            IN (${compositeKeys.map((_, i) => `@key${i}`).join(', ')})
    `;

    // 設定參數
    compositeKeys.forEach((key, i) => {
      request.input(`key${i}`, sql.NVarChar, key);
    });

    const result = await request.query(query);
    return new Set(result.recordset.map((row) => row.composite_key));
  }

  /**
   * 道路施工部批次插入資料
   *
   * 使用派工單號 + 廠商名稱 + 項目名稱 + 日期作為複合鍵檢查重複
   */
  static async batchInsertRoadConstructionData(
    data: ExcelRow[],
    tableName: string = 'RoadConstructionForm'
  ): Promise<DatabaseResult> {
    return this.executeBatchInsert(
      data,
      tableName,
      (row) => {
        const workOrderNumber = row['派工單號']?.toString().trim() || '';
        const vendorName = row['廠商名稱']?.toString().trim() || '';
        const itemName = row['項目名稱']?.toString().trim() || '';
        const date = row['日期']?.toString().trim() || '';

        if (!workOrderNumber || !itemName || !date) {
          return null;
        }

        return `${workOrderNumber}-${vendorName}-${itemName}-${date}`;
      },
      () => null, // 道路施工部不需要額外驗證
      this.batchCheckExistingDataRoadConstruction.bind(this),
      (error) => {
        // 處理 UNIQUE CONSTRAINT 違反
        return (
          error instanceof Error &&
          (error.message.includes('UNIQUE') ||
            error.message.includes('違反唯一約束'))
        );
      }
    );
  }

  /**
   * 通用的批次插入執行邏輯
   * 提取共同邏輯，減少重複代碼
   */
  private static async executeBatchInsert(
    data: ExcelRow[],
    tableName: string,
    buildCompositeKey: (row: ExcelRow) => string | null,
    validateRow: (row: ExcelRow) => string | null,
    checkExistingData: (
      transaction: any,
      data: ExcelRow[],
      tableName: string
    ) => Promise<Set<string>>,
    shouldSkipOnError?: (error: unknown) => boolean
  ): Promise<DatabaseResult> {
    const pool = await getConnectionPool();
    const transaction = new sql.Transaction(pool);

    const result: DatabaseResult = {
      success: false,
      insertedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    try {
      await transaction.begin();

      // 批次檢查已存在的資料
      const existingData = await checkExistingData(
        transaction,
        data,
        tableName
      );

      // 處理每一筆資料
      for (const row of data) {
        try {
          // 驗證資料行
          const validationError = validateRow(row);
          if (validationError) {
            result.errors.push(validationError);
            continue;
          }

          // 建立複合鍵
          const compositeKey = buildCompositeKey(row);
          if (!compositeKey) {
            continue;
          }

          // 檢查是否已存在
          if (existingData.has(compositeKey)) {
            result.skippedCount++;
            continue;
          }

          // 插入新資料
          await this.insertRowInTransaction(transaction, row, tableName);
          result.insertedCount++;
        } catch (rowError) {
          // 處理特定錯誤（如 UNIQUE CONSTRAINT 違反）
          if (shouldSkipOnError && shouldSkipOnError(rowError)) {
            result.skippedCount++;
            continue;
          }

          const errorMsg = `插入資料行失敗: ${JSON.stringify(row)} - ${
            rowError instanceof Error ? rowError.message : '未知錯誤'
          }`;
          result.errors.push(errorMsg);
          dbLogger.error(errorMsg);
        }
      }

      await transaction.commit();
      result.success = true;

      dbLogger.info('批次插入完成', {
        tableName,
        insertedCount: result.insertedCount,
        skippedCount: result.skippedCount,
        errorCount: result.errors.length,
      });
    } catch (error) {
      await transaction.rollback();
      result.success = false;
      result.errors.push(
        `交易失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
      dbLogger.error('資料庫交易失敗', error);
    }

    return result;
  }

  /**
   * 道路施工部：批次檢查已存在的資料
   */
  private static async batchCheckExistingDataRoadConstruction(
    transaction: any,
    data: ExcelRow[],
    tableName: string
  ): Promise<Set<string>> {
    if (data.length === 0) return new Set();

    const compositeKeys = data
      .map((row) => {
        const workOrderNumber = row['派工單號']?.toString().trim() || '';
        const vendorName = row['廠商名稱']?.toString().trim() || '';
        const itemName = row['項目名稱']?.toString().trim() || '';
        const date = row['日期']?.toString().trim() || '';
        return `${workOrderNumber}-${vendorName}-${itemName}-${date}`;
      })
      .filter((key) => {
        const parts = key.split('-');
        return parts.length === 4 && parts.every((part) => part !== '');
      });

    if (compositeKeys.length === 0) return new Set();

    const request = new sql.Request(transaction);
    const query = `
      SELECT DISTINCT 
        [派工單號] + '-' + ISNULL([廠商名稱], '') + '-' + [項目名稱] + '-' + CONVERT(VARCHAR(10), [日期], 120) as composite_key
      FROM ${tableName}
      WHERE [派工單號] + '-' + ISNULL([廠商名稱], '') + '-' + [項目名稱] + '-' + CONVERT(VARCHAR(10), [日期], 120)
            IN (${compositeKeys.map((_, i) => `@key${i}`).join(', ')})
    `;

    compositeKeys.forEach((key, i) => {
      request.input(`key${i}`, sql.NVarChar, key);
    });

    const result = await request.query(query);
    return new Set(result.recordset.map((row) => row.composite_key));
  }

  /**
   * 在交易中批次檢查表單編號是否存在（分批處理）
   */
  private static async batchCheckFormExistsInTransaction(
    transaction: any,
    formNumbers: string[],
    tableName: string
  ): Promise<string[]> {
    if (formNumbers.length === 0) {
      return [];
    }

    const existingForms: string[] = [];
    const chunkSize = 1000; // 設置每個批次的查詢大小，避免超過 SQL Server 參數限制

    for (let i = 0; i < formNumbers.length; i += chunkSize) {
      const chunk = formNumbers.slice(i, i + chunkSize);
      const request = new sql.Request(transaction);

      const placeholders: string[] = [];
      chunk.forEach((formNumber, index) => {
        const paramName = `formNumber${i + index}`; // 確保 paramName 在所有批次中是唯一的
        request.input(paramName, sql.NVarChar, formNumber);
        placeholders.push(`@${paramName}`);
      });

      if (placeholders.length > 0) {
        const query = `SELECT 表單編號 FROM ${tableName} WHERE 表單編號 IN (${placeholders.join(
          ', '
        )})`;
        const result = await request.query(query);
        const foundForms = result.recordset.map((row: any) => row['表單編號']);
        existingForms.push(...foundForms);
      }
    }

    return existingForms;
  }

  /**
   * 在交易中檢查表單編號是否存在（保留原有方法以備用）
   */
  private static async checkFormExistsInTransaction(
    transaction: any,
    formNumber: string,
    tableName: string
  ): Promise<boolean> {
    const request = new sql.Request(transaction);
    const result = await request
      .input('formNumber', sql.NVarChar, formNumber)
      .query(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE 表單編號 = @formNumber`
      );

    return result.recordset[0].count > 0;
  }

  /**
   * 在交易中插入單筆資料
   */
  private static async insertRowInTransaction(
    transaction: any,
    row: ExcelRow,
    tableName: string
  ): Promise<void> {
    const request = new sql.Request(transaction);
    const columns = Object.keys(row);
    const values = Object.values(row);

    // 建立 SQL 語句
    const columnNames = columns.map((col) => `[${col}]`).join(', ');
    const parameterNames = columns
      .map((_, index) => `@param${index}`)
      .join(', ');

    // 設定參數
    columns.forEach((col, index) => {
      const { sqlType, convertedValue } = this.convertValueForInsert(
        col,
        values[index]
      );
      request.input(`param${index}`, sqlType, convertedValue);
    });

    const insertQuery = `INSERT INTO ${tableName} (${columnNames}) VALUES (${parameterNames})`;
    await request.query(insertQuery);
  }

  /**
   * 轉換值為適合插入資料庫的格式
   * @returns { sqlType, convertedValue }
   */
  private static convertValueForInsert(
    columnName: string,
    value: any
  ): { sqlType: any; convertedValue: any } {
    // 空字串轉換為 null
    if (value === '') {
      value = null;
    }

    const sqlType = this.getSqlTypeForColumn(columnName, value);

    // Boolean 類型轉換
    if (sqlType === sql.Bit) {
      return {
        sqlType,
        convertedValue: this.convertBooleanValue(value),
      };
    }

    // 日期類型轉換
    if (sqlType === sql.Date) {
      return {
        sqlType,
        convertedValue: this.convertDateValue(value),
      };
    }

    return { sqlType, convertedValue: value };
  }

  /**
   * 轉換 boolean 值為 BIT (0 或 1)
   */
  private static convertBooleanValue(value: any): number {
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    if (value === null || value === undefined) {
      return 0; // 預設為 false
    }
    return value ? 1 : 0;
  }

  /**
   * 轉換日期字串為 Date 物件
   */
  private static convertDateValue(value: any): Date | null {
    if (value === null || value === undefined) {
      return null;
    }

    // 已經是 Date 物件
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    // 字串格式處理
    if (typeof value === 'string') {
      // YYYY-MM-DD 格式
      const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3]) {
        const year = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10);
        const day = parseInt(dateMatch[3], 10);
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }

      // 嘗試解析其他格式
      const parsedDate = new Date(value);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }

    return null;
  }

  /**
   * 根據欄位名稱判斷 SQL 資料類型
   * 使用映射表優化性能，減少條件判斷
   */
  private static getSqlTypeForColumn(columnName: string, value: any): any {
    // Boolean 類型檢查（優先）
    if (columnName === '已更新' || typeof value === 'boolean') {
      return sql.Bit;
    }

    // 精確匹配的欄位名稱（使用 Map 查找，O(1)）
    const exactMatchTypes: Record<string, any> = {
      匯率: sql.Decimal(18, 6),
      數量: typeof value === 'number' ? sql.Decimal(18, 2) : sql.NVarChar,
    };

    if (exactMatchTypes[columnName]) {
      return exactMatchTypes[columnName];
    }

    // 關鍵字匹配（使用陣列，順序重要）
    const keywordPatterns = [
      { keywords: ['日期', '時間'], type: sql.Date },
      {
        keywords: ['金額', '總計', '稅額', '單價'],
        type: sql.Decimal(18, 2),
      },
    ];

    for (const pattern of keywordPatterns) {
      if (pattern.keywords.some((keyword) => columnName.includes(keyword))) {
        return pattern.type;
      }
    }

    // 預設為字串
    return sql.NVarChar;
  }

  /**
   * 取得資料表結構資訊
   */
  static async getTableInfo(tableName: string): Promise<any[]> {
    const pool = await getConnectionPool();

    try {
      const result = await pool.request().query(`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = '${tableName}'
        ORDER BY ORDINAL_POSITION
      `);

      return result.recordset;
    } catch (error) {
      dbLogger.error('取得資料表資訊失敗', error);
      throw error;
    }
  }

  /**
   * 測試資料庫連接
   */
  static async testConnection(): Promise<boolean> {
    try {
      dbLogger.info('嘗試連接資料庫');
      const pool = await getConnectionPool();

      // 檢查連線池狀態
      if (!pool || !pool.connected) {
        dbLogger.error('資料庫連線池未連接');
        return false;
      }

      // 執行簡單查詢測試
      const result = await pool
        .request()
        .query('SELECT GETDATE() as current_datetime');

      dbLogger.info('SQL Server 連接成功');
      dbLogger.info('資料庫連接測試成功', { result: result.recordset[0] });
      return true;
    } catch (error) {
      dbLogger.error('資料庫連接測試失敗', error);
      return false;
    }
  }

  /**
   * 檢查資料庫連線狀態
   */
  static async checkConnectionStatus(): Promise<{
    connected: boolean;
    message: string;
    details?: any;
  }> {
    try {
      const pool = await getConnectionPool();

      if (!pool) {
        return {
          connected: false,
          message: '連線池未初始化',
        };
      }

      if (!pool.connected) {
        return {
          connected: false,
          message: '連線池未連接',
        };
      }

      // 執行測試查詢
      const result = await pool
        .request()
        .query('SELECT GETDATE() as current_datetime, @@VERSION as version');

      return {
        connected: true,
        message: '資料庫連接正常',
        details: result.recordset[0],
      };
    } catch (error) {
      return {
        connected: false,
        message: `資料庫連接失敗: ${
          error instanceof Error ? error.message : '未知錯誤'
        }`,
        details: error,
      };
    }
  }
}

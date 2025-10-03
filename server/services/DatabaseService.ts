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
   * 批次插入資料到資料庫
   */
  static async batchInsertData(
    data: ExcelRow[],
    tableName: string,
    formNumberField: string = '表單編號'
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
      // 開始交易
      await transaction.begin();

      // 批次查詢重複檢查：一次查詢所有表單編號
      dbLogger.info('批次查詢重複檢查');
      const formNumbers = data
        .map((row) => row[formNumberField])
        .filter(
          (formNumber) => formNumber && formNumber.toString().trim() !== ''
        );

      const existingForms = await this.batchCheckFormExistsInTransaction(
        transaction,
        formNumbers,
        tableName
      );

      // 建立 Set 以便快速查找
      const existingFormSet = new Set(existingForms);
      dbLogger.info('批次查詢完成', {
        totalForms: formNumbers.length,
        existingForms: existingFormSet.size,
      });

      // 建立一個 Set 來追蹤此批次中已處理的表單編號，以處理檔案內的重複
      const processedInThisBatch = new Set<string>();

      for (const row of data) {
        try {
          const formNumber = row[formNumberField];

          if (!formNumber) {
            result.errors.push(`資料行缺少表單編號: ${JSON.stringify(row)}`);
            continue;
          }

          const trimmedFormNumber = formNumber.toString().trim();

          // 檢查是否已存在於資料庫
          if (existingFormSet.has(trimmedFormNumber)) {
            result.skippedCount++;
            dbLogger.debug(`跳過已存在於資料庫的表單編號: ${formNumber}`);
            continue;
          }

          // 建立複合鍵來判斷檔案內部重複
          const expenseItem = row['費用項目'] || '';
          const invoiceNumber = row['發票號碼'] || '';
          const transactionDate = row['交易日期'] || '';
          const itemAmount = row['項目原幣金額'] || '';

          const compositeKey = `${trimmedFormNumber}-${expenseItem}-${invoiceNumber}-${transactionDate}-${itemAmount}`;

          // 檢查是否在此次上傳中已處理過 (檔案內部重複)
          if (processedInThisBatch.has(compositeKey)) {
            result.skippedCount++;
            dbLogger.debug(`跳過檔案內重複的費用項目: ${compositeKey}`);
            continue;
          }

          // 插入新資料
          await this.insertRowInTransaction(transaction, row, tableName);
          result.insertedCount++;
          // 將成功插入的複合鍵加入到追蹤 Set 中
          processedInThisBatch.add(compositeKey);
        } catch (rowError) {
          const errorMsg = `插入資料行失敗: ${JSON.stringify(
            row
          )} - ${rowError}`;
          result.errors.push(errorMsg);
          dbLogger.error(errorMsg);
        }
      }

      // 提交交易
      await transaction.commit();
      result.success = true;

      dbLogger.info('批次插入完成', {
        insertedCount: result.insertedCount,
        skippedCount: result.skippedCount,
        errorCount: result.errors.length,
      });
    } catch (error) {
      // 回滾交易
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

    // 動態建立 INSERT 語句，排除 EFid 主鍵欄位
    const columns = Object.keys(row);
    const values = Object.values(row);

    // 用方括號包圍欄位名稱，避免 SQL 語法錯誤
    const columnNames = columns.map((col) => `[${col}]`).join(', ');
    const parameterNames = columns
      .map((col, index) => `@param${index}`)
      .join(', ');

    // 設定參數，並根據欄位類型選擇適當的 SQL 類型
    columns.forEach((col, index) => {
      let value = values[index];

      // 空字串轉換為 null
      if (value === '') {
        value = null;
      }

      // 根據欄位名稱判斷資料類型
      const sqlType = this.getSqlTypeForColumn(col, value);
      request.input(`param${index}`, sqlType, value);
    });

    const insertQuery = `INSERT INTO ${tableName} (${columnNames}) VALUES (${parameterNames})`;

    await request.query(insertQuery);
  }

  /**
   * 根據欄位名稱判斷 SQL 資料類型
   */
  private static getSqlTypeForColumn(columnName: string, value: any): any {
    // 日期欄位
    if (columnName.includes('日期') || columnName.includes('時間')) {
      return sql.Date;
    }

    // 金額欄位
    if (
      columnName.includes('金額') ||
      columnName.includes('總計') ||
      columnName.includes('稅額') ||
      columnName.includes('匯率')
    ) {
      return sql.Decimal(18, 2);
    }

    // 匯率欄位 (特殊處理)
    if (columnName === '匯率') {
      return sql.Decimal(18, 6);
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

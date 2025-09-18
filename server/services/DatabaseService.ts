import sql from 'mssql';
import { getConnectionPool } from '../config/database';
import { ExcelRow } from './ExcelService';

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
      console.error('檢查表單編號失敗:', error);
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
      console.log('🔍 批次查詢重複檢查...');
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
      console.log(
        `📊 批次查詢完成: 總共 ${formNumbers.length} 個表單編號, 其中 ${existingFormSet.size} 個已存在`
      );

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
            console.log(`⏭️ 跳過已存在於資料庫的表單編號: ${formNumber}`);
            continue;
          }

          // 檢查是否在此次上傳中已處理過 (檔案內部重複)
          if (processedInThisBatch.has(trimmedFormNumber)) {
            result.skippedCount++;
            console.log(`⏭️ 跳過檔案內重複的表單編號: ${formNumber}`);
            continue;
          }

          // 插入新資料
          await this.insertRowInTransaction(transaction, row, tableName);
          result.insertedCount++;
          // 將成功插入的表單編號加入到追蹤 Set 中
          processedInThisBatch.add(trimmedFormNumber);
        } catch (rowError) {
          const errorMsg = `插入資料行失敗: ${JSON.stringify(
            row
          )} - ${rowError}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // 提交交易
      await transaction.commit();
      result.success = true;

      console.log(
        `✅ 批次插入完成: 成功 ${result.insertedCount} 筆, 跳過 ${result.skippedCount} 筆, 錯誤 ${result.errors.length} 筆`
      );
    } catch (error) {
      // 回滾交易
      await transaction.rollback();
      result.success = false;
      result.errors.push(
        `交易失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
      console.error('❌ 資料庫交易失敗:', error);
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
        const foundForms = result.recordset.map((row) => row['表單編號']);
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

    // 動態建立 INSERT 語句
    const columns = Object.keys(row);
    const values = Object.values(row);

    // 用方括號包圍欄位名稱，避免 SQL 語法錯誤
    const columnNames = columns.map((col) => `[${col}]`).join(', ');
    const parameterNames = columns
      .map((col, index) => `@param${index}`)
      .join(', ');

    // 設定參數，並將空字串轉換為 null
    columns.forEach((col, index) => {
      let value = values[index];
      // 對於可能為數字的欄位，如果值是空字串，則將其設定為 null
      // 這樣可以避免 "Error converting data type nvarchar to numeric" 錯誤
      if (value === '') {
        value = null;
      }
      request.input(`param${index}`, sql.NVarChar, value);
    });

    const insertQuery = `INSERT INTO ${tableName} (${columnNames}) VALUES (${parameterNames})`;

    await request.query(insertQuery);
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
      console.error('取得資料表資訊失敗:', error);
      throw error;
    }
  }

  /**
   * 測試資料庫連接
   */
  static async testConnection(): Promise<boolean> {
    try {
      const pool = await getConnectionPool();
      const result = await pool
        .request()
        .query('SELECT GETDATE() as current_datetime');
      console.log('✅ 資料庫連接測試成功:', result.recordset[0]);
      return true;
    } catch (error) {
      console.error('❌ 資料庫連接測試失敗:', error);
      return false;
    }
  }
}

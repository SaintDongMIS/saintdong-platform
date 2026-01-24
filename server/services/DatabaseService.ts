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
  private static async getExistingColumnsSet(
    tableName: string
  ): Promise<Set<string>> {
    const columns = await this.getTableInfo(tableName);
    return new Set(columns.map((col: any) => col.COLUMN_NAME));
  }

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
   * [重構] 標準化欄位值以進行比較或插入
   * @param value 任意值
   * @param type 'string' | 'date' | 'decimal'
   * @returns 標準化後的值
   */
  private static normalizeValue(
    value: any,
    type: 'string' | 'date' | 'decimal'
  ): string {
    if (value === null || value === undefined || value === '') {
      if (type === 'decimal') return '0.00';
      return '';
    }

    switch (type) {
      case 'string':
        return value.toString().trim();

      case 'date':
        if (value instanceof Date) {
          // 加上 '|| ''' 確保類型安全，滿足 TypeScript 編譯器
          return value.toISOString().split('T')[0] || '';
        }
        const dateStr = value.toString();
        const dateMatch = dateStr.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})/);
        return dateMatch
          ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
          : dateStr.trim();

      case 'decimal':
        return parseFloat(String(value)).toFixed(2);

      default:
        return value.toString().trim();
    }
  }

  /**
   * [重構] 為費用報銷單建立複合鍵
   * 複合鍵：表單編號-發票號碼-交易日期-項目原幣金額-[費用項目]
   * - 費用項目為可選，為空時不加入鍵中
   */
  private static buildExpendFormCompositeKey(row: ExcelRow): string | null {
    const formNumber = this.normalizeValue(row['表單編號'], 'string');
    if (!formNumber) return null;

    const invoiceNumber = this.normalizeValue(row['發票號碼'], 'string');
    const transactionDate = this.normalizeValue(row['交易日期'], 'date');
    const itemAmount = this.normalizeValue(row['項目原幣金額'], 'decimal');
    const expenseItem = this.normalizeValue(row['費用項目'], 'string');

    // 核心邏輯：如果費用項目存在，則將其包含在鍵中
    const keyParts = [formNumber, invoiceNumber, transactionDate, itemAmount];
    if (expenseItem) {
      keyParts.push(expenseItem);
    }

    return keyParts.join('-');
  }

  /**
   * [重構] 批次插入費用報銷單資料
   */
  static async batchInsertData(
    data: ExcelRow[],
    tableName: string
  ): Promise<DatabaseResult> {
    return this.executeBatchInsert(
      data,
      tableName,
      DatabaseService.buildExpendFormCompositeKey.bind(DatabaseService),
      (row) =>
        !row['表單編號'] ? `資料行缺少表單編號: ${JSON.stringify(row)}` : null,
      DatabaseService.batchCheckExistingData.bind(DatabaseService)
    );
  }

  /**
   * [新增] 預覽批次插入 - 檢查資料但不實際寫入資料庫
   * 用於「jim測試用」功能
   */
  static async previewBatchInsert(
    data: ExcelRow[],
    tableName: string
  ): Promise<{
    wouldInsertCount: number;
    wouldSkipCount: number;
    duplicateKeys: string[];
  }> {
    const pool = await getConnectionPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      dbLogger.info('開始預覽模式：檢查資料但不寫入', {
        totalRows: data.length,
        tableName,
      });

      // 使用與正常插入相同的邏輯檢查已存在的資料
      const existingKeys = await this.batchCheckExistingData(
        transaction,
        data,
        tableName
      );

      // 計算哪些資料會被插入、哪些會被跳過
      const validRows: ExcelRow[] = [];
      const skippedRows: ExcelRow[] = [];

      data.forEach((row) => {
        // 驗證表單編號
        if (!row['表單編號']) {
          skippedRows.push(row);
          return;
        }

        // 建立複合鍵
        const compositeKey = this.buildExpendFormCompositeKey(row);
        if (!compositeKey) {
          skippedRows.push(row);
          return;
        }

        // 檢查是否已存在
        if (existingKeys.has(compositeKey)) {
          skippedRows.push(row);
        } else {
          validRows.push(row);
        }
      });

      const wouldInsertCount = validRows.length;
      const wouldSkipCount = skippedRows.length;

      // 回滾交易 - 不實際寫入資料庫
      await transaction.rollback();

      dbLogger.info('預覽模式完成 (未寫入資料庫)', {
        totalRows: data.length,
        wouldInsert: wouldInsertCount,
        wouldSkip: wouldSkipCount,
        duplicateKeys: existingKeys.size,
      });

      return {
        wouldInsertCount,
        wouldSkipCount,
        duplicateKeys: Array.from(existingKeys),
      };
    } catch (error) {
      dbLogger.error('預覽模式失敗', error);
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * [重構] 批次檢查已存在的資料 - 使用標準化的複合鍵
   */
  private static async batchCheckExistingData(
    transaction: any,
    data: ExcelRow[],
    tableName: string
  ): Promise<Set<string>> {
    if (data.length === 0) return new Set();

    // 1. 從上傳資料中生成所有可能的複合鍵
    const compositeKeysFromUpload = new Set<string>();
    data.forEach((row) => {
      // 為了處理「費用項目從無到有」的更新情況，我們為每一行產生兩種可能的鍵：
      // a. 包含費用項目的精確鍵
      // b. 不含費用項目的寬鬆鍵
      const formNumber = this.normalizeValue(row['表單編號'], 'string');
      if (!formNumber) return;

      const invoiceNumber = this.normalizeValue(row['發票號碼'], 'string');
      const transactionDate = this.normalizeValue(row['交易日期'], 'date');
      const itemAmount = this.normalizeValue(row['項目原幣金額'], 'decimal');
      const expenseItem = this.normalizeValue(row['費用項目'], 'string');

      // 產生寬鬆鍵 (一定有)
      compositeKeysFromUpload.add(
        [formNumber, invoiceNumber, transactionDate, itemAmount].join('-')
      );
      // 如果有費用項目，額外產生精確鍵
      if (expenseItem) {
        compositeKeysFromUpload.add(
          [
            formNumber,
            invoiceNumber,
            transactionDate,
            itemAmount,
            expenseItem,
          ].join('-')
        );
      }
    });

    const keysToQuery = Array.from(compositeKeysFromUpload).filter(Boolean);
    if (keysToQuery.length === 0) return new Set();

    // 2. 在資料庫中一次性查詢所有匹配的鍵
    const request = new sql.Request(transaction);
    const placeholders = keysToQuery.map((_, i) => `@key${i}`).join(', ');
    keysToQuery.forEach((key, i) => {
      request.input(`key${i}`, sql.NVarChar, key);
    });

    // SQL 查詢邏輯：
    // - 同時生成兩種複合鍵 (有/無費用項目)，並與傳入的鍵比對
    // - 這樣無論資料庫中的費用項目是 NULL 還是有值，都能被正確匹配
    const query = `
      SELECT DISTINCT composite_key FROM (
        -- 情況1: 費用項目為 NULL 或空字串
        SELECT 
          [表單編號] + '-' + 
          ISNULL(NULLIF([發票號碼], ''), '') + '-' + 
          CONVERT(VARCHAR(10), [交易日期], 120) + '-' + 
          FORMAT([項目原幣金額], 'F2') as composite_key
        FROM ${tableName}
        WHERE ISNULL([費用項目], '') = ''

        UNION ALL

        -- 情況2: 費用項目有值
        SELECT 
          [表單編號] + '-' + 
          ISNULL(NULLIF([發票號碼], ''), '') + '-' + 
          CONVERT(VARCHAR(10), [交易日期], 120) + '-' + 
          FORMAT([項目原幣金額], 'F2') + '-' +
          [費用項目] as composite_key
        FROM ${tableName}
        WHERE ISNULL([費用項目], '') <> ''
      ) AS existing_keys
      WHERE composite_key IN (${placeholders})
    `;

    const result = await request.query(query);
    return new Set(result.recordset.map((row) => row.composite_key));
  }

  /**
   * [新增] 為道路施工部表單建立複合鍵
   * 複合鍵：派工單號-廠商名稱-項目名稱-日期
   */
  private static buildRoadConstructionCompositeKey(
    row: ExcelRow
  ): string | null {
    const workOrderNumber = this.normalizeValue(row['派工單號'], 'string');
    const vendorName = this.normalizeValue(row['廠商名稱'], 'string');
    const itemName = this.normalizeValue(row['項目名稱'], 'string');
    const date = this.normalizeValue(row['日期'], 'date');

    if (!workOrderNumber || !itemName || !date) {
      return null;
    }

    return [workOrderNumber, vendorName, itemName, date].join('-');
  }

  /**
   * [重構] 道路施工部批次插入資料
   * - 應用策略模式，使用 buildRoadConstructionCompositeKey
   */
  static async batchInsertRoadConstructionData(
    data: ExcelRow[],
    tableName: string = 'RoadConstructionForm'
  ): Promise<DatabaseResult> {
    return this.executeBatchInsert(
      data,
      tableName,
      DatabaseService.buildRoadConstructionCompositeKey.bind(DatabaseService),
      () => null, // 道路施工部不需要額外驗證
      DatabaseService.batchCheckExistingDataRoadConstruction.bind(
        DatabaseService
      ),
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

      const existingColumns = await this.getExistingColumnsSet(tableName);
      const unknownColumns = new Set<string>();

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

          const filteredRow = Object.fromEntries(
            Object.entries(row).filter(([columnName]) => {
              const exists = existingColumns.has(columnName);
              if (!exists) {
                unknownColumns.add(columnName);
              }
              return exists;
            })
          );

          if (Object.keys(filteredRow).length === 0) {
            const errorMsg = `插入資料行失敗: 無任何可用欄位（資料表不存在對應欄位） - ${JSON.stringify(
              row
            )}`;
            result.errors.push(errorMsg);
            dbLogger.error(errorMsg);
            continue;
          }

          // 插入新資料
          await this.insertRowInTransaction(
            transaction,
            filteredRow,
            tableName
          );
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

      if (unknownColumns.size > 0) {
        dbLogger.warn('忽略未在資料表中定義的欄位', {
          tableName,
          columns: Array.from(unknownColumns),
        });
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
   * [重構] 道路施工部：批次檢查已存在的資料
   * - 使用標準化的複合鍵生成邏輯
   */
  private static async batchCheckExistingDataRoadConstruction(
    transaction: any,
    data: ExcelRow[],
    tableName: string
  ): Promise<Set<string>> {
    if (data.length === 0) return new Set();

    const compositeKeys = data
      .map(
        DatabaseService.buildRoadConstructionCompositeKey.bind(DatabaseService)
      )
      .filter((key): key is string => !!key);

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
    const columns = Object.keys(row);
    const values = Object.values(row);

    // 建立 SQL 語句
    // 過濾掉 [建立時間] 與 [更新時間] 欄位，讓資料庫使用預設值
    // 同時過濾掉不在資料表欄位定義中的多餘欄位 (這在 filteredRow 已經處理過了，但為了保險再確認一次)

    const columnsToInsert = columns.filter(
      (col) => col !== '建立時間' && col !== '更新時間'
    );

    if (columnsToInsert.length === 0) {
      // 理論上不應該發生，除非整行只有時間欄位
      return;
    }

    const columnNames = columnsToInsert.map((col) => `[${col}]`).join(', ');
    const parameterNames = columnsToInsert
      .map((_, index) => `@param${index}`) // 注意這裡的 index 對應的是 columnsToInsert 的索引
      .join(', ');

    const request = new sql.Request(transaction);

    // 設定參數
    columnsToInsert.forEach((col, index) => {
      // 找出原始 values 中對應的值
      const originalIndex = columns.indexOf(col);
      const value = values[originalIndex];

      const { sqlType, convertedValue } = this.convertValueForInsert(
        col,
        value
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
      { keywords: ['日期', '時間', '期限'], type: sql.Date },
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
   * 根據表單編號批量查詢費用報銷單的「請款原因-表單下方選項」
   */
  static async getReimbursementReasons(
    formNumbers: string[]
  ): Promise<ExcelRow[]> {
    if (formNumbers.length === 0) {
      return [];
    }

    const pool = await getConnectionPool();
    const request = pool.request();
    const placeholders: string[] = [];

    // 創建動態參數
    formNumbers.forEach((num, index) => {
      const paramName = `formNumber${index}`;
      request.input(paramName, sql.NVarChar, num);
      placeholders.push(`@${paramName}`);
    });

    try {
      dbLogger.info('開始從資料庫查詢請款原因', { formNumbers });
      const query = `
        SELECT
          [表單編號],
          [請款原因-表單下方選項]
        FROM ExpendForm
        WHERE [表單編號] IN (${placeholders.join(', ')})
      `;
      const result = await request.query(query);
      dbLogger.info(`查詢到 ${result.recordset.length} 筆請款原因`);
      return result.recordset as ExcelRow[];
    } catch (error) {
      dbLogger.error('查詢請款原因失敗', error);
      throw new Error(
        `資料庫查詢請款原因失敗: ${
          error instanceof Error ? error.message : '未知錯誤'
        }`
      );
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

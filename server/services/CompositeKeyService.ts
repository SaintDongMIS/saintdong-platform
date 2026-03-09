/**
 * 複合鍵服務
 *
 * 統一管理複合鍵的生成、解析、查詢邏輯
 *
 * 設計原則：
 * 1. 單一職責：只處理複合鍵相關邏輯
 * 2. 可測試性：所有方法都是純函數或明確的副作用
 * 3. 可讀性：業務邏輯清晰可見
 */

import sql from 'mssql';
import {
  COMPOSITE_KEY_SEPARATOR,
  EXPEND_FORM_KEY_SPEC,
  type CompositeKeyType,
  type ExpendFormParsed,
} from '~/server/constants/compositeKey';
import { dbLogger } from './LoggerService';
import { DateHelper } from '~/server/utils/dateHelper';

/**
 * Excel 資料行類型
 */
export type ExcelRow = Record<string, any>;

/** 複合鍵解析結果（ExpendForm 由 spec 衍生，道路施工部固定 4 欄） */
export interface ParsedCompositeKey extends ExpendFormParsed {
  派工單號?: string;
  廠商名稱?: string;
  項目名稱?: string;
  日期?: string;
}

/**
 * 複合鍵服務類
 */
export class CompositeKeyService {
  // ============================================================
  // 欄位標準化（與 DatabaseService 保持一致）
  // ============================================================

  /**
   * 標準化欄位值
   */
  private static normalizeValue(
    value: any,
    type: 'string' | 'date' | 'decimal',
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
          // 使用本地時區，避免 UTC 轉換問題
          return DateHelper.toLocalDate(value);
        }
        const dateStr = value.toString();
        const dateMatch = dateStr.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})/);
        return dateMatch
          ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
          : dateStr.trim();

      case 'decimal': {
        // Excel 常帶千分位 "10,737.00"，parseFloat 遇逗號會只取前面 → 先去掉逗號再算
        const num = parseFloat(String(value).replace(/,/g, ''));
        return Number.isFinite(num) ? num.toFixed(2) : '0.00';
      }

      default:
        return value.toString().trim();
    }
  }

  /**
   * 依 EXPEND_FORM_KEY_SPEC 綁定參數並回傳 WHERE 條件（單一鍵）
   * 分攤行：Excel key 的 項目原幣金額=0，DB 存 10737，查詢時略過 項目原幣金額 條件才查得到
   */
  private static buildExpendFormKeyCondition(
    parsed: ExpendFormParsed,
    paramPrefix: string,
    request: sql.Request,
  ): string {
    const allocationDept = (parsed['分攤參與部門'] ?? '').toString().trim();
    const expenseItem = (parsed['費用項目'] ?? '').toString().trim();
    const isAllocationRow = !!allocationDept && !expenseItem;

    const conditions: string[] = [];
    EXPEND_FORM_KEY_SPEC.forEach((s, i) => {
      const paramName = `${paramPrefix}_f${i}`;
      const value = (parsed[s.name] ?? '') as string;
      request.input(paramName, sql.NVarChar, value);
      const col = `[${s.name}]`;

      if (s.name === '項目原幣金額' && isAllocationRow) {
        conditions.push('(1=1)');
        return;
      }
      if (s.type === 'string') {
        conditions.push(`ISNULL(${col}, '') = @${paramName}`);
      } else if (s.type === 'date') {
        conditions.push(`ISNULL(CONVERT(VARCHAR(10), ${col}, 120), '') = @${paramName}`);
      } else {
        conditions.push(`CAST(ISNULL(${col}, 0) AS DECIMAL(18,2)) = CAST(@${paramName} AS DECIMAL(18,2))`);
      }
    });
    return `(${conditions.join(' AND ')})`;
  }

  // ============================================================
  // 費用報銷單複合鍵
  // ============================================================

  /**
   * 生成費用報銷單複合鍵（依 EXPEND_FORM_KEY_SPEC）
   * 分攤行：Excel 經 sanitizeInheritedData 後 項目原幣金額=0，DB 仍存 10737，組鍵時統一用 0.00 才能對到
   */
  static generateExpendFormKey(row: ExcelRow): string | null {
    const first = this.normalizeValue(row[EXPEND_FORM_KEY_SPEC[0].name], EXPEND_FORM_KEY_SPEC[0].type);
    if (!first) return null;

    const keyParts = EXPEND_FORM_KEY_SPEC.map((s) =>
      this.normalizeValue(row[s.name], s.type),
    );

    // 分攤行：分攤參與部門有值且費用項目為空時，項目原幣金額統一為 0.00（Excel 分攤行為 0、DB 為 10737，需一致才對得到）
    const allocationDept = (row['分攤參與部門'] ?? '').toString().trim();
    const expenseItem = (row['費用項目'] ?? '').toString().trim();
    if (allocationDept && !expenseItem) {
      const itemAmountIndex = EXPEND_FORM_KEY_SPEC.findIndex((s) => s.name === '項目原幣金額');
      if (itemAmountIndex >= 0) keyParts[itemAmountIndex] = '0.00';
    }

    return keyParts.join(COMPOSITE_KEY_SEPARATOR);
  }

  /**
   * 解析費用報銷單複合鍵（依 EXPEND_FORM_KEY_SPEC）
   */
  static parseExpendFormKey(key: string): ParsedCompositeKey {
    const parts = key.split(COMPOSITE_KEY_SEPARATOR);
    const out = {} as ParsedCompositeKey;
    EXPEND_FORM_KEY_SPEC.forEach((s, i) => {
      out[s.name] = parts[i] ?? '';
    });
    return out;
  }

  // ============================================================
  // 道路施工部複合鍵
  // ============================================================

  /**
   * 生成道路施工部複合鍵
   *
   * @param row Excel 資料行
   * @returns 複合鍵字串，格式：派工單號~~~廠商名稱~~~項目名稱~~~日期
   */
  static generateRoadConstructionKey(row: ExcelRow): string | null {
    const workOrderNumber = this.normalizeValue(row['派工單號'], 'string');
    const vendorName = this.normalizeValue(row['廠商名稱'], 'string');
    const itemName = this.normalizeValue(row['項目名稱'], 'string');
    const date = this.normalizeValue(row['日期'], 'date');

    if (!workOrderNumber || !itemName || !date) {
      return null;
    }

    const keyParts = [workOrderNumber, vendorName, itemName, date];

    return keyParts.join(COMPOSITE_KEY_SEPARATOR);
  }

  /**
   * 解析道路施工部複合鍵
   *
   * @param key 複合鍵字串
   * @returns 解析後的欄位物件
   */
  static parseRoadConstructionKey(key: string): ParsedCompositeKey {
    const parts = key.split(COMPOSITE_KEY_SEPARATOR);

    return {
      派工單號: parts[0] || '',
      廠商名稱: parts[1] || '',
      項目名稱: parts[2] || '',
      日期: parts[3] || '',
    };
  }

  // ============================================================
  // 統一的批次查詢（支援有無變更追蹤）
  // ============================================================

  /**
   * 批次查詢已存在的資料（返回 Set<key>，用於快速檢查）
   *
   * @param transaction 交易物件
   * @param compositeKeys 複合鍵陣列
   * @param tableName 資料表名稱
   * @param keyType 複合鍵類型
   * @returns Set<compositeKey>
   */
  static async batchQueryExistingKeys(
    transaction: any,
    compositeKeys: string[],
    tableName: string,
    keyType: CompositeKeyType = 'ExpendForm',
  ): Promise<Set<string>> {
    if (compositeKeys.length === 0) return new Set();

    const resultSet = new Set<string>();

    const MAX_PARAMS = 2000;
    const PARAMS_PER_KEY =
      keyType === 'ExpendForm'
        ? EXPEND_FORM_KEY_SPEC.length
        : 4;
    const BATCH_SIZE = Math.floor(MAX_PARAMS / PARAMS_PER_KEY);
    for (let i = 0; i < compositeKeys.length; i += BATCH_SIZE) {
      const batch = compositeKeys.slice(i, i + BATCH_SIZE);
      const batchResults = await this.queryKeysBatch(
        transaction,
        batch,
        tableName,
        keyType,
      );

      batchResults.forEach((key) => resultSet.add(key));
    }

    dbLogger.info('批次查詢完成（僅返回 keys）', {
      tableName,
      totalKeys: resultSet.size,
    });

    return resultSet;
  }

  /**
   * 批次查詢已存在的資料（返回 Map<key, row>，用於變更追蹤）
   *
   * @param transaction 交易物件
   * @param compositeKeys 複合鍵陣列
   * @param tableName 資料表名稱
   * @param keyType 複合鍵類型
   * @returns Map<compositeKey, 完整資料列>
   */
  static async batchQueryExistingData(
    transaction: any,
    compositeKeys: string[],
    tableName: string,
    keyType: CompositeKeyType = 'ExpendForm',
  ): Promise<Map<string, any>> {
    if (compositeKeys.length === 0) return new Map();

    // DEBUG: 記錄輸入的複合鍵
    dbLogger.debug('🔍 batchQueryExistingData 開始', {
      inputKeysCount: compositeKeys.length,
      inputKeysSample: compositeKeys.slice(0, 2),
    });

    const resultMap = new Map<string, any>();

    // SQL Server 單一請求最多 2100 個參數；留餘裕用 2000 計算
    const MAX_PARAMS = 2000;
    const PARAMS_PER_KEY =
      keyType === 'ExpendForm'
        ? EXPEND_FORM_KEY_SPEC.length
        : 4; /* RoadConstruction */
    const BATCH_SIZE = Math.floor(MAX_PARAMS / PARAMS_PER_KEY);
    for (let i = 0; i < compositeKeys.length; i += BATCH_SIZE) {
      const batch = compositeKeys.slice(i, i + BATCH_SIZE);
      
      dbLogger.debug('🔍 開始查詢批次', {
        batchIndex: i / BATCH_SIZE,
        batchSize: batch.length,
      });
      
      const batchResults = await this.queryDataBatch(
        transaction,
        batch,
        tableName,
        keyType,
      );

      dbLogger.debug('🔍 批次查詢返回', {
        batchIndex: i / BATCH_SIZE,
        returnedRows: batchResults.size,
        returnedKeysSample: Array.from(batchResults.keys()).slice(0, 2),
      });

      batchResults.forEach((row, key) => resultMap.set(key, row));
    }

    dbLogger.info('批次查詢完成（返回完整資料）', {
      tableName,
      totalRows: resultMap.size,
      actualKeys: Array.from(resultMap.keys()),
      actualSample: Array.from(resultMap.values()).slice(0, 1).map((v) =>
        EXPEND_FORM_KEY_SPEC.reduce(
          (acc, s) => ({ ...acc, [s.name]: v[s.name] }),
          { EFid: (v as any).EFid } as Record<string, unknown>,
        ),
      ),
    });

    return resultMap;
  }

  // ============================================================
  // 私有方法：單批次查詢邏輯
  // ============================================================

  /**
   * 查詢單批次的複合鍵（僅返回 keys）
   */
  private static async queryKeysBatch(
    transaction: any,
    compositeKeys: string[],
    tableName: string,
    keyType: CompositeKeyType,
  ): Promise<string[]> {
    const request = new sql.Request(transaction);
    const conditions: string[] = [];

    compositeKeys.forEach((key, index) => {
      const parsed =
        keyType === 'ExpendForm'
          ? this.parseExpendFormKey(key)
          : this.parseRoadConstructionKey(key);

      const paramPrefix = `p${index}`;

      if (keyType === 'ExpendForm') {
        conditions.push(
          this.buildExpendFormKeyCondition(parsed as ExpendFormParsed, paramPrefix, request),
        );
      } else {
        // 道路施工部查詢條件
        request.input(
          `${paramPrefix}_workOrder`,
          sql.NVarChar,
          parsed.派工單號,
        );
        request.input(`${paramPrefix}_vendor`, sql.NVarChar, parsed.廠商名稱);
        request.input(`${paramPrefix}_item`, sql.NVarChar, parsed.項目名稱);
        request.input(`${paramPrefix}_date`, sql.NVarChar, parsed.日期);

        const condition = `(
          [派工單號] = @${paramPrefix}_workOrder
          AND ISNULL([廠商名稱], '') = @${paramPrefix}_vendor
          AND [項目名稱] = @${paramPrefix}_item
          AND CONVERT(VARCHAR(10), [日期], 120) = @${paramPrefix}_date
        )`;

        conditions.push(condition);
      }
    });

    const query = `
      SELECT ${this.buildCompositeKeySelectClause(keyType)}
      FROM ${tableName}
      WHERE ${conditions.join(' OR ')}
    `;

    const result = await request.query(query);

    // 重建複合鍵字串
    return result.recordset
      .map((row) => {
        if (keyType === 'ExpendForm') {
          return this.generateExpendFormKey(row);
        } else {
          return this.generateRoadConstructionKey(row);
        }
      })
      .filter((key): key is string => !!key);
  }

  /**
   * 查詢單批次的完整資料（返回完整 row）
   */
  private static async queryDataBatch(
    transaction: any,
    compositeKeys: string[],
    tableName: string,
    keyType: CompositeKeyType,
  ): Promise<Map<string, any>> {
    const request = new sql.Request(transaction);
    const conditions: string[] = [];

    // DEBUG: 記錄解析後的複合鍵
    const parsedKeysDebug: any[] = [];

    compositeKeys.forEach((key, index) => {
      const parsed =
        keyType === 'ExpendForm'
          ? this.parseExpendFormKey(key)
          : this.parseRoadConstructionKey(key);

      // DEBUG: 收集解析結果
      if (index < 2) {
        parsedKeysDebug.push({
          originalKey: key,
          parsed: parsed,
        });
      }

      const paramPrefix = `p${index}`;

      if (keyType === 'ExpendForm') {
        conditions.push(
          this.buildExpendFormKeyCondition(parsed as ExpendFormParsed, paramPrefix, request),
        );
      } else {
        request.input(
          `${paramPrefix}_workOrder`,
          sql.NVarChar,
          parsed.派工單號,
        );
        request.input(`${paramPrefix}_vendor`, sql.NVarChar, parsed.廠商名稱);
        request.input(`${paramPrefix}_item`, sql.NVarChar, parsed.項目名稱);
        request.input(`${paramPrefix}_date`, sql.NVarChar, parsed.日期);

        const condition = `(
          [派工單號] = @${paramPrefix}_workOrder
          AND ISNULL([廠商名稱], '') = @${paramPrefix}_vendor
          AND [項目名稱] = @${paramPrefix}_item
          AND CONVERT(VARCHAR(10), [日期], 120) = @${paramPrefix}_date
        )`;

        conditions.push(condition);
      }
    });

    const query = `
      SELECT *
      FROM ${tableName}
      WHERE ${conditions.join(' OR ')}
    `;

    // DEBUG: 記錄 SQL 查詢
    dbLogger.debug('🔍 執行 SQL 查詢', {
      tableName,
      conditionsCount: conditions.length,
      parsedKeysSample: parsedKeysDebug,
      querySample: query.substring(0, 800),
    });

    const result = await request.query(query);

    // DEBUG: 記錄 SQL 查詢結果
    dbLogger.debug('🔍 SQL 查詢返回', {
      rowCount: result.recordset.length,
      firstRowSample: result.recordset[0] ? {
        EFid: result.recordset[0].EFid,
        表單編號: result.recordset[0]['表單編號'],
        發票號碼: result.recordset[0]['發票號碼'],
        交易日期: result.recordset[0]['交易日期'],
        項目原幣金額: result.recordset[0]['項目原幣金額'],
        費用項目: result.recordset[0]['費用項目'],
      } : null,
    });

    // 建立 Map<compositeKey, row>
    const resultMap = new Map<string, any>();
    result.recordset.forEach((row) => {
      const key =
        keyType === 'ExpendForm'
          ? this.generateExpendFormKey(row)
          : this.generateRoadConstructionKey(row);

      if (key) {
        resultMap.set(key, row);

        // DEBUG: 記錄生成的複合鍵
        dbLogger.debug('🔍 從資料庫 row 生成複合鍵', {
          efid: row.EFid,
          generatedKey: key,
          rawData: EXPEND_FORM_KEY_SPEC.reduce(
            (acc, s) => ({ ...acc, [s.name]: row[s.name] }),
            {} as Record<string, unknown>,
          ),
        });
      }
    });

    dbLogger.debug('queryDataBatch 完成', {
      queriedKeys: compositeKeys.length,
      foundRows: resultMap.size,
      sampleKeys: Array.from(resultMap.keys()).slice(0, 2),
    });

    return resultMap;
  }

  /**
   * 建立 SELECT 子句（用於只查詢複合鍵欄位）
   */
  private static buildCompositeKeySelectClause(
    keyType: CompositeKeyType,
  ): string {
    if (keyType === 'ExpendForm') {
      return EXPEND_FORM_KEY_SPEC.map((s) => `[${s.name}]`).join(', ');
    } else {
      return `
        [派工單號],
        [廠商名稱],
        [項目名稱],
        [日期]
      `;
    }
  }

  // ============================================================
  // 輔助方法
  // ============================================================

  /**
   * 批次生成複合鍵
   *
   * @param data Excel 資料陣列
   * @param keyType 複合鍵類型
   * @returns 複合鍵陣列
   */
  static batchGenerateKeys(
    data: ExcelRow[],
    keyType: CompositeKeyType = 'ExpendForm',
  ): string[] {
    const generator =
      keyType === 'ExpendForm'
        ? this.generateExpendFormKey
        : this.generateRoadConstructionKey;

    return data
      .map((row) => generator.call(this, row))
      .filter((key): key is string => !!key);
  }

  /**
   * 驗證複合鍵格式
   *
   * @param key 複合鍵字串
   * @param keyType 複合鍵類型
   * @returns 是否有效
   */
  static validateKey(
    key: string,
    keyType: CompositeKeyType = 'ExpendForm',
  ): boolean {
    if (!key || typeof key !== 'string') return false;

    const parts = key.split(COMPOSITE_KEY_SEPARATOR);

    if (keyType === 'ExpendForm') {
      return parts.length === EXPEND_FORM_KEY_SPEC.length && !!parts[0];
    } else {
      return parts.length === 4 && !!parts[0] && !!parts[2] && !!parts[3]; // 派工單號、項目名稱、日期必填
    }
  }
}

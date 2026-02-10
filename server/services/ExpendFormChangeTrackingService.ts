/**
 * 費用報銷單變更追蹤：UPSERT + 寫入 ExpendForm_ChangeLog
 * 僅負責「已存在則 UPDATE 並比對追蹤欄位寫 log，不存在則 INSERT」
 */
import sql from 'mssql';
import { getConnectionPool } from '../config/database';
import type { ExcelRow } from './ExcelService';
import type { DatabaseResult } from './DatabaseService';
import { DatabaseService } from './DatabaseService';
import { CompositeKeyService } from './CompositeKeyService';
import { DateHelper } from '../utils/dateHelper';
import { safeStringify } from '../utils/safeStringify';
import { dbLogger } from './LoggerService';

const DEFAULT_TRACKED_FIELDS = ['付款狀態', '實際付款日期'] as const;

export class ExpendFormChangeTrackingService {
  /**
   * 帶變更追蹤的 UPSERT：已存在則 UPDATE 並寫 ChangeLog，不存在則 INSERT
   */
  static async executeBatchUpsertWithTracking(
    data: ExcelRow[],
    tableName: string,
    trackedFields: string[] = [...DEFAULT_TRACKED_FIELDS],
    changedBy: string = 'COMMEET_SYNC'
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

      const tableInfo = await DatabaseService.getTableInfo(tableName);
      const existingColumns = new Set(
        tableInfo.map((col: any) => col.COLUMN_NAME)
      );
      const unknownColumns = new Set<string>();

      const compositeKeys = CompositeKeyService.batchGenerateKeys(
        data,
        'ExpendForm'
      );
      const existingData =
        compositeKeys.length > 0
          ? await CompositeKeyService.batchQueryExistingData(
              transaction,
              compositeKeys,
              tableName,
              'ExpendForm'
            )
          : new Map<string, any>();

      for (const row of data) {
        try {
          if (!row['表單編號']) {
            result.errors.push(
              `資料行缺少表單編號: ${safeStringify(row)}`
            );
            continue;
          }

          const compositeKey = CompositeKeyService.generateExpendFormKey(row);
          if (!compositeKey) continue;

          const filteredRow = Object.fromEntries(
            Object.entries(row).filter(([columnName]) => {
              const exists = existingColumns.has(columnName);
              if (!exists) unknownColumns.add(columnName);
              return exists;
            })
          );
          if (Object.keys(filteredRow).length === 0) {
            result.errors.push(
              `插入資料行失敗: 無任何可用欄位 - ${safeStringify(row)}`
            );
            continue;
          }

          const existingRow = existingData.get(compositeKey);

          if (existingRow != null) {
            const efid = existingRow.EFid as number;
            await this.updateRowInTransaction(
              transaction,
              efid,
              filteredRow,
              tableName
            );
            for (const fieldName of trackedFields) {
              const oldVal = existingRow[fieldName];
              const newVal = filteredRow[fieldName];
              const oldStr = this.formatValueForChangeLog(oldVal);
              const newStr = this.formatValueForChangeLog(newVal);
              if (oldStr !== newStr) {
                await this.insertChangeLogEntry(
                  transaction,
                  efid,
                  fieldName,
                  oldStr,
                  newStr,
                  changedBy
                );
              }
            }
            result.skippedCount++;
          } else {
            await DatabaseService.insertRowInTransaction(
              transaction,
              filteredRow,
              tableName
            );
            result.insertedCount++;
          }
        } catch (rowError) {
          result.errors.push(
            `資料行失敗: ${safeStringify(row)} - ${
              rowError instanceof Error ? rowError.message : '未知錯誤'
            }`
          );
          dbLogger.error('UPSERT 單筆失敗', rowError);
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
      dbLogger.info('批次 UPSERT（含變更追蹤）完成', {
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

  private static formatValueForChangeLog(value: any): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return DateHelper.toLocalDate(value);
    return String(value).trim();
  }

  private static async updateRowInTransaction(
    transaction: any,
    efid: number,
    row: ExcelRow,
    tableName: string
  ): Promise<void> {
    const columns = Object.keys(row).filter(
      (col) => col !== 'EFid' && col !== '建立時間' && col !== '更新時間'
    );
    if (columns.length === 0) return;

    const setClauses = columns
      .map((col, i) => `[${col}] = @param${i}`)
      .join(', ');
    const request = new sql.Request(transaction);
    request.input('efid', sql.Int, efid);
    columns.forEach((col, i) => {
      const { sqlType, convertedValue } =
        DatabaseService.convertValueForInsert(col, row[col]);
      request.input(`param${i}`, sqlType, convertedValue);
    });
    await request.query(
      `UPDATE ${tableName} SET ${setClauses} WHERE [EFid] = @efid`
    );
  }

  private static async insertChangeLogEntry(
    transaction: any,
    efid: number,
    fieldName: string,
    oldValue: string,
    newValue: string,
    changedBy: string
  ): Promise<void> {
    const request = new sql.Request(transaction);
    request.input('efid', sql.Int, efid);
    request.input('fieldName', sql.NVarChar, fieldName);
    request.input('oldValue', sql.NVarChar, oldValue || null);
    request.input('newValue', sql.NVarChar, newValue || null);
    request.input('changedBy', sql.NVarChar, changedBy);
    await request.query(`
      INSERT INTO ExpendForm_ChangeLog (EFid, FieldName, OldValue, NewValue, ChangedAt, ChangedBy, ChangeType)
      VALUES (@efid, @fieldName, @oldValue, @newValue, GETDATE(), @changedBy, 'UPDATE')
    `);
  }
}

/**
 * 費用報銷單變更追蹤：UPSERT + 寫入 ExpendForm_ChangeLog
 * 僅負責「已存在則 UPDATE 並比對追蹤欄位寫 log，不存在則 INSERT」
 *
 * 優化重點：
 * 1. 只在追蹤欄位有變更時才執行 UPDATE，減少無意義的資料庫往返
 * 2. ChangeLog 改為批次 INSERT，一次寫入所有變更記錄
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
    changedBy: string = 'COMMEET_SYNC',
  ): Promise<DatabaseResult> {
    const pool = await getConnectionPool();
    const transaction = new sql.Transaction(pool);
    const result: DatabaseResult = {
      success: false,
      insertedCount: 0,
      skippedCount: 0,
      errors: [],
    };
    /** 記錄第一筆失敗的錯誤，方便在交易 rollback 時一併輸出根因 */
    let firstRowError: { error: unknown; rowPreview: string } | null = null;

    try {
      await transaction.begin();

      const tableInfo = await DatabaseService.getTableInfo(tableName);
      const existingColumns = new Set(
        tableInfo.map((col: any) => col.COLUMN_NAME),
      );
      const unknownColumns = new Set<string>();

      const compositeKeys = CompositeKeyService.batchGenerateKeys(
        data,
        'ExpendForm',
      );
      const existingData =
        compositeKeys.length > 0
          ? await CompositeKeyService.batchQueryExistingData(
              transaction,
              compositeKeys,
              tableName,
              'ExpendForm',
            )
          : new Map<string, any>();

      for (const row of data) {
        try {
          if (!row['表單編號']) {
            result.errors.push(`資料行缺少表單編號: ${safeStringify(row)}`);
            continue;
          }

          const compositeKey = CompositeKeyService.generateExpendFormKey(row);
          if (!compositeKey) continue;

          const filteredRow = Object.fromEntries(
            Object.entries(row).filter(([columnName]) => {
              const exists = existingColumns.has(columnName);
              if (!exists) unknownColumns.add(columnName);
              return exists;
            }),
          );
          if (Object.keys(filteredRow).length === 0) {
            result.errors.push(
              `插入資料行失敗: 無任何可用欄位 - ${safeStringify(row)}`,
            );
            continue;
          }

          const existingRow = existingData.get(compositeKey);

          if (existingRow != null) {
            const efid = existingRow.EFid as number;

            // 檢查追蹤欄位是否有變更，並收集 ChangeLog 記錄
            const changeLogEntries: Array<{
              efid: number;
              fieldName: string;
              oldValue: string;
              newValue: string;
              changedBy: string;
            }> = [];

            let hasChanges = false;
            for (const fieldName of trackedFields) {
              const oldVal = existingRow[fieldName];
              const newVal = filteredRow[fieldName];
              const oldStr = this.formatValueForChangeLog(oldVal);
              const newStr = this.formatValueForChangeLog(newVal);
              if (oldStr !== newStr) {
                hasChanges = true;
                changeLogEntries.push({
                  efid,
                  fieldName,
                  oldValue: oldStr,
                  newValue: newStr,
                  changedBy,
                });
              }
            }

            // 只在有追蹤欄位變更時才執行 UPDATE，且只更新有變更的追蹤欄位
            // 避免覆寫其他欄位（如手動修正的備註、承辦人等）
            if (hasChanges) {
              const updateRow: ExcelRow = {};
              for (const fieldName of trackedFields) {
                updateRow[fieldName] = filteredRow[fieldName];
              }
              await this.updateRowInTransaction(
                transaction,
                efid,
                updateRow,
                tableName,
              );
            }

            // 批次 INSERT ChangeLog（一次寫入所有變更記錄，減少 round-trip）
            if (changeLogEntries.length > 0) {
              await this.batchInsertChangeLogEntries(
                transaction,
                changeLogEntries,
              );
            }

            result.skippedCount++;
          } else {
            await DatabaseService.insertRowInTransaction(
              transaction,
              filteredRow,
              tableName,
            );
            result.insertedCount++;
          }
        } catch (rowError) {
          const message =
            rowError instanceof Error ? rowError.message : '未知錯誤';
          result.errors.push(`資料行失敗: ${safeStringify(row)} - ${message}`);
          if (!firstRowError) {
            firstRowError = {
              error: rowError,
              rowPreview: safeStringify(
                { 表單編號: row['表單編號'], 申請人姓名: row['申請人姓名'] },
                100,
              ),
            };
          }
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
      result.success = false;
      result.errors.push(
        `交易失敗: ${error instanceof Error ? error.message : '未知錯誤'}`,
      );
      // 先記錄根因再 rollback，避免 rollback() 拋錯時蓋掉日誌
      dbLogger.error('[ExpendForm UPSERT] 交易失敗', error);
      if (firstRowError) {
        const msg =
          firstRowError.error instanceof Error
            ? firstRowError.error.message
            : String(firstRowError.error);
        const stack =
          firstRowError.error instanceof Error
            ? firstRowError.error.stack
            : undefined;
        dbLogger.error(
          '[ExpendForm UPSERT] 可能根因（第一筆失敗）: ' + msg,
          firstRowError.error,
          {
            rowPreview: firstRowError.rowPreview,
            ...(stack ? { stack } : {}),
          },
        );
      } else {
        dbLogger.error(
          '[ExpendForm UPSERT] 無單筆錯誤記錄，失敗可能發生在交易內第一筆操作（如 getTableInfo / 批次查詢現有資料）',
          undefined,
          {
            caughtMessage:
              error instanceof Error ? error.message : String(error),
          },
        );
      }
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        dbLogger.error(
          '[ExpendForm UPSERT] rollback 時拋錯（可忽略）',
          rollbackErr,
        );
      }
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
    tableName: string,
  ): Promise<void> {
    const columns = Object.keys(row).filter(
      (col) => col !== 'EFid' && col !== '建立時間' && col !== '更新時間',
    );
    if (columns.length === 0) return;

    const setClauses = columns
      .map((col, i) => `[${col}] = @param${i}`)
      .join(', ');
    // 每次 UPDATE 都刷新 更新時間，與 ChangeLog 的 ChangedAt 一致
    const setWithUpdatedAt = `${setClauses}, [更新時間] = GETDATE()`;
    const request = new sql.Request(transaction);
    request.input('efid', sql.Int, efid);
    columns.forEach((col, i) => {
      const { sqlType, convertedValue } = DatabaseService.convertValueForInsert(
        col,
        row[col],
      );
      request.input(`param${i}`, sqlType, convertedValue);
    });
    await request.query(
      `UPDATE ${tableName} SET ${setWithUpdatedAt} WHERE [EFid] = @efid`,
    );
  }

  /**
   * 批次 INSERT ChangeLog：一次寫入多筆變更記錄，減少資料庫往返
   */
  private static async batchInsertChangeLogEntries(
    transaction: any,
    entries: Array<{
      efid: number;
      fieldName: string;
      oldValue: string;
      newValue: string;
      changedBy: string;
    }>,
  ): Promise<void> {
    if (entries.length === 0) return;

    const request = new sql.Request(transaction);
    const valueRows: string[] = [];

    entries.forEach((entry, index) => {
      const idx = index.toString();
      request.input(`efid${idx}`, sql.Int, entry.efid);
      request.input(`fieldName${idx}`, sql.NVarChar, entry.fieldName);
      request.input(`oldValue${idx}`, sql.NVarChar, entry.oldValue || null);
      request.input(`newValue${idx}`, sql.NVarChar, entry.newValue || null);
      request.input(`changedBy${idx}`, sql.NVarChar, entry.changedBy);
      valueRows.push(
        `(@efid${idx}, @fieldName${idx}, @oldValue${idx}, @newValue${idx}, GETDATE(), @changedBy${idx}, 'UPDATE')`,
      );
    });

    await request.query(`
      INSERT INTO ExpendForm_ChangeLog (EFid, FieldName, OldValue, NewValue, ChangedAt, ChangedBy, ChangeType)
      VALUES ${valueRows.join(',\n')}
    `);
  }

  private static async insertChangeLogEntry(
    transaction: any,
    efid: number,
    fieldName: string,
    oldValue: string,
    newValue: string,
    changedBy: string,
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

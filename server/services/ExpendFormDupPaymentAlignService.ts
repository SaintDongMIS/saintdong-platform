/**
 * 複合鍵 dup 群組：將群內已付款列的付款狀態／日期，同步到同群未對齊列。
 * 分群規則與手動止血 SQL 一致（6 欄正規化，HAVING COUNT(*) > 1）。
 */
import sql from 'mssql';
import type { ExcelRow } from './ExcelService';
import { DatabaseService } from './DatabaseService';
import { DateHelper } from '../utils/dateHelper';

export const DUP_PAYMENT_ALIGN_CHANGED_BY = 'COMMEET_SYNC_DUP_PAYMENT_ALIGN';
const SUGGESTED_PAYMENT_STATUS = '已付款';
const PAYMENT_STATUS_FIELD = '付款狀態';
const PAYMENT_DATE_FIELD = '實際付款日期';

interface DupPaymentAlignCandidate {
  EFid: number;
  current_payment_status: string | null;
  current_payment_date_ymd: string | null;
  suggested_payment_date_ymd: string;
}

export interface DupPaymentAlignResult {
  alignedRowCount: number;
  changeLogEntryCount: number;
}

export class ExpendFormDupPaymentAlignService {
  /**
   * 於既有 transaction 內執行 dup 群組付款對齊（僅 ExpendForm）。
   */
  static async alignWithinDupGroups(
    transaction: sql.Transaction,
    tableName: string,
  ): Promise<DupPaymentAlignResult> {
    if (tableName !== 'ExpendForm') {
      return { alignedRowCount: 0, changeLogEntryCount: 0 };
    }

    const candidates = await this.findAlignCandidates(transaction, tableName);
    if (candidates.length === 0) {
      return { alignedRowCount: 0, changeLogEntryCount: 0 };
    }

    const changeLogEntries: Array<{
      efid: number;
      fieldName: string;
      oldValue: string;
      newValue: string;
      changedBy: string;
    }> = [];
    let alignedRowCount = 0;

    for (const row of candidates) {
      const efid = row.EFid;
      const suggestedDate = (row.suggested_payment_date_ymd ?? '').trim();
      if (!suggestedDate) continue;

      const oldStatus = this.formatValueForChangeLog(row.current_payment_status);
      const oldDate = this.formatValueForChangeLog(row.current_payment_date_ymd);
      const newStatus = SUGGESTED_PAYMENT_STATUS;
      const newDate = suggestedDate;

      const statusChanged = oldStatus !== newStatus;
      const dateChanged = oldDate !== newDate;
      if (!statusChanged && !dateChanged) continue;

      const updateRow: ExcelRow = {};
      if (statusChanged) updateRow[PAYMENT_STATUS_FIELD] = newStatus;
      if (dateChanged) updateRow[PAYMENT_DATE_FIELD] = newDate;

      await this.updateRowInTransaction(
        transaction,
        efid,
        updateRow,
        tableName,
      );

      if (statusChanged) {
        changeLogEntries.push({
          efid,
          fieldName: PAYMENT_STATUS_FIELD,
          oldValue: oldStatus,
          newValue: newStatus,
          changedBy: DUP_PAYMENT_ALIGN_CHANGED_BY,
        });
      }
      if (dateChanged) {
        changeLogEntries.push({
          efid,
          fieldName: PAYMENT_DATE_FIELD,
          oldValue: oldDate,
          newValue: newDate,
          changedBy: DUP_PAYMENT_ALIGN_CHANGED_BY,
        });
      }
      alignedRowCount++;
    }

    await this.batchInsertChangeLogEntries(transaction, changeLogEntries);

    return {
      alignedRowCount,
      changeLogEntryCount: changeLogEntries.length,
    };
  }

  private static async findAlignCandidates(
    transaction: sql.Transaction,
    tableName: string,
  ): Promise<DupPaymentAlignCandidate[]> {
    const request = new sql.Request(transaction);
    const result = await request.query(`
      WITH dup_keys AS (
        SELECT
          [表單編號],
          ISNULL([發票號碼], '') AS inv,
          CONVERT(VARCHAR(10), [交易日期], 120) AS tx,
          CAST(ISNULL([項目原幣金額], 0) AS DECIMAL(18,2)) AS amt,
          ISNULL([費用項目], '') AS item,
          ISNULL([分攤參與部門], '') AS dept
        FROM ${tableName}
        GROUP BY
          [表單編號],
          ISNULL([發票號碼], ''),
          CONVERT(VARCHAR(10), [交易日期], 120),
          CAST(ISNULL([項目原幣金額], 0) AS DECIMAL(18,2)),
          ISNULL([費用項目], ''),
          ISNULL([分攤參與部門], '')
        HAVING COUNT(*) > 1
      ),
      grp AS (
        SELECT
          e.[表單編號],
          ISNULL(e.[發票號碼], '') AS inv,
          CONVERT(VARCHAR(10), e.[交易日期], 120) AS tx,
          CAST(ISNULL(e.[項目原幣金額], 0) AS DECIMAL(18,2)) AS amt,
          ISNULL(e.[費用項目], '') AS item,
          ISNULL(e.[分攤參與部門], '') AS dept,
          MAX(CASE WHEN e.[付款狀態] = N'已付款' THEN 1 ELSE 0 END) AS has_paid,
          MAX(CASE
                WHEN e.[付款狀態] = N'已付款'
                THEN CONVERT(VARCHAR(10), e.[實際付款日期], 120)
                ELSE NULL
              END) AS paid_date_ymd
        FROM ${tableName} e
        INNER JOIN dup_keys d
          ON  e.[表單編號] = d.[表單編號]
          AND ISNULL(e.[發票號碼], '') = d.inv
          AND CONVERT(VARCHAR(10), e.[交易日期], 120) = d.tx
          AND CAST(ISNULL(e.[項目原幣金額], 0) AS DECIMAL(18,2)) = d.amt
          AND ISNULL(e.[費用項目], '') = d.item
          AND ISNULL(e.[分攤參與部門], '') = d.dept
        GROUP BY
          e.[表單編號],
          ISNULL(e.[發票號碼], ''),
          CONVERT(VARCHAR(10), e.[交易日期], 120),
          CAST(ISNULL(e.[項目原幣金額], 0) AS DECIMAL(18,2)),
          ISNULL(e.[費用項目], ''),
          ISNULL(e.[分攤參與部門], '')
      )
      SELECT
        e.[EFid],
        e.[付款狀態] AS current_payment_status,
        CONVERT(VARCHAR(10), e.[實際付款日期], 120) AS current_payment_date_ymd,
        g.paid_date_ymd AS suggested_payment_date_ymd
      FROM ${tableName} e
      INNER JOIN grp g
        ON  e.[表單編號] = g.[表單編號]
        AND ISNULL(e.[發票號碼], '') = g.inv
        AND CONVERT(VARCHAR(10), e.[交易日期], 120) = g.tx
        AND CAST(ISNULL(e.[項目原幣金額], 0) AS DECIMAL(18,2)) = g.amt
        AND ISNULL(e.[費用項目], '') = g.item
        AND ISNULL(e.[分攤參與部門], '') = g.dept
      WHERE
        g.has_paid = 1
        AND g.paid_date_ymd IS NOT NULL
        AND (
          e.[付款狀態] IS NULL OR e.[付款狀態] <> N'已付款'
          OR e.[實際付款日期] IS NULL
        )
      ORDER BY g.paid_date_ymd, e.[表單編號], e.[EFid]
    `);

    return result.recordset as DupPaymentAlignCandidate[];
  }

  private static formatValueForChangeLog(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return DateHelper.toLocalDate(value);
    return String(value).trim();
  }

  private static async updateRowInTransaction(
    transaction: sql.Transaction,
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

  private static async batchInsertChangeLogEntries(
    transaction: sql.Transaction,
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
}

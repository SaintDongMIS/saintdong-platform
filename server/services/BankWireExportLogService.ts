import sql from 'mssql';
import crypto from 'crypto';
import { getConnectionPool } from '../config/database';
import { dbLogger } from './LoggerService';
import { getTaipeiDateTimeParts } from '../../utils/bankWireScheduledTransDate';

export const BANK_WIRE_EXPORT_LOG_TABLE = 'BankWireExport_Log';

export type BankWireBatchType = 'commeet' | 'adhoc' | 'manual_backfill';

export interface BankWireLedgerRow {
  mergedLineIndex: number;
  payeeName: string;
  payeeAccountDigits: string;
  bankCodeDigits: string;
  branchCode?: string | null;
  payeeBankCode7?: string | null;
  payeeAccountId?: number | null;
  lineNote?: string | null;
  formNo: string;
  amountCents: number;
}

export interface BankWireLedgerBatchMeta {
  batchType: BankWireBatchType;
  scheduledTxDateYmd: string;
  alreadyUploaded?: boolean;
  /** 事後登錄可指定實際匯出／匯款登錄時間；未指定則用 DB 預設 */
  exportedAt?: Date;
}

export interface BankWireExportLogDto {
  id: string;
  batchId: string;
  exportedAt: string;
  sourceFilename: string;
  mergedLineIndex: number;
  payeeName: string;
  payeeAccountDigits: string | null;
  bankCodeDigits: string | null;
  branchCode: string | null;
  payeeBankCode7: string | null;
  payeeAccountId: string | null;
  scheduledTxDate: string | null;
  batchType: string | null;
  lineNote: string | null;
  alreadyUploaded: boolean;
  formNo: string;
  amountCents: string;
}

function buildInsertLedgerSql(includeExportedAt: boolean): string {
  const cols = `[batch_id],[source_filename],[merged_line_index],[payee_name],[payee_account_digits],
   [bank_code_digits],[branch_code],[payee_bank_code7],[payee_account_id],
   [scheduled_tx_date],[batch_type],[line_note],[already_uploaded],[form_no],[amount_cents]`;
  const vals = `@batch_id,@source_filename,@merged_line_index,@payee_name,@payee_account_digits,
   @bank_code_digits,@branch_code,@payee_bank_code7,@payee_account_id,
   @scheduled_tx_date,@batch_type,@line_note,@already_uploaded,@form_no,@amount_cents`;
  if (includeExportedAt) {
    return `
      INSERT INTO [dbo].[${BANK_WIRE_EXPORT_LOG_TABLE}]
      (${cols},[exported_at])
      VALUES (${vals},@exported_at)
    `;
  }
  return `
    INSERT INTO [dbo].[${BANK_WIRE_EXPORT_LOG_TABLE}]
    (${cols})
    VALUES (${vals})
  `;
}

function normalizeBranch4(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  return digits.padStart(4, '0').slice(-4);
}

function normalizeBankCode7(
  bank3: string | null | undefined,
  branch4: string | null | undefined,
  payeeBankCode7: string | null | undefined
): string | null {
  if (payeeBankCode7 != null && String(payeeBankCode7).trim() !== '') {
    const d = String(payeeBankCode7).replace(/\D/g, '');
    if (d.length >= 7) return d.padStart(7, '0').slice(0, 7);
  }
  const b3 = String(bank3 ?? '')
    .replace(/\D/g, '')
    .padStart(3, '0')
    .slice(-3);
  const br = normalizeBranch4(branch4);
  if (!b3) return null;
  return (b3 + (br ?? '0000')).slice(0, 7);
}

function resolveFormNo(formNo: string, batchId: string, seq: number): string {
  const trimmed = String(formNo ?? '').trim();
  if (trimmed) return trimmed;
  return `ADHOC-${batchId}-${String(seq).padStart(3, '0')}`;
}

export function createManualBackfillBatchId(now: Date = new Date()): string {
  const { year, month, day, hour, minute, second } =
    getTaipeiDateTimeParts(now);
  const ts = `${year}${month}${day}-${hour}${minute}${second}`;
  const suffix = crypto
    .randomBytes(3)
    .toString('base64url')
    .toUpperCase()
    .slice(0, 4);
  return `BF-MANUAL-${ts}-${suffix}`;
}

async function insertLedgerRows(
  batchId: string,
  sourceFilename: string,
  rows: BankWireLedgerRow[],
  meta: BankWireLedgerBatchMeta
): Promise<void> {
  if (rows.length === 0) return;

  const pool = await getConnectionPool();
  const transaction = new sql.Transaction(pool);
  const includeExportedAt = meta.exportedAt != null;
  const insertSql = buildInsertLedgerSql(includeExportedAt);

  await transaction.begin();
  try {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      const branchCode = normalizeBranch4(r.branchCode ?? null);
      const payeeBankCode7 = normalizeBankCode7(
        r.bankCodeDigits,
        branchCode,
        r.payeeBankCode7
      );
      const req = new sql.Request(transaction)
        .input('batch_id', sql.NVarChar(64), batchId)
        .input('source_filename', sql.NVarChar(500), sourceFilename)
        .input('merged_line_index', sql.Int, r.mergedLineIndex)
        .input('payee_name', sql.NVarChar(200), r.payeeName)
        .input(
          'payee_account_digits',
          sql.NVarChar(32),
          r.payeeAccountDigits || null
        )
        .input('bank_code_digits', sql.NVarChar(16), r.bankCodeDigits || null)
        .input('branch_code', sql.Char(4), branchCode)
        .input('payee_bank_code7', sql.Char(7), payeeBankCode7)
        .input(
          'payee_account_id',
          sql.BigInt,
          r.payeeAccountId != null ? r.payeeAccountId : null
        )
        .input(
          'scheduled_tx_date',
          sql.Char(8),
          meta.scheduledTxDateYmd || null
        )
        .input('batch_type', sql.NVarChar(32), meta.batchType)
        .input('line_note', sql.NVarChar(500), r.lineNote?.trim() || null)
        .input('already_uploaded', sql.Bit, meta.alreadyUploaded ? 1 : 0)
        .input('form_no', sql.NVarChar(64), resolveFormNo(r.formNo, batchId, i + 1))
        .input('amount_cents', sql.BigInt, r.amountCents);

      if (includeExportedAt) {
        req.input('exported_at', sql.DateTime2(3), meta.exportedAt!);
      }

      await req.query(insertSql);
    }
    await transaction.commit();
    dbLogger.info('BankWireExport_Log 寫入完成', {
      batchId,
      batchType: meta.batchType,
      rowCount: rows.length,
    });
  } catch (err) {
    await transaction.rollback();
    dbLogger.error('BankWireExport_Log 寫入失敗', err, { batchId });
    throw err;
  }
}

/**
 * 同一請求產生之 TXT 對應的多筆明細（具 transaction）
 */
export async function insertBankWireExportLedger(
  batchId: string,
  sourceFilename: string,
  rows: BankWireLedgerRow[],
  meta: BankWireLedgerBatchMeta
): Promise<void> {
  return insertLedgerRows(batchId, sourceFilename, rows, meta);
}

/**
 * 事後登錄：國泰已匯完，僅補寫 BankWireExport_Log（不產 TXT）
 */
export async function insertBankWireExportBackfill(
  batchId: string,
  sourceFilename: string,
  rows: BankWireLedgerRow[],
  meta: Omit<BankWireLedgerBatchMeta, 'batchType' | 'alreadyUploaded'> & {
    exportedAt?: Date;
  }
): Promise<void> {
  return insertLedgerRows(batchId, sourceFilename, rows, {
    ...meta,
    batchType: 'manual_backfill',
    alreadyUploaded: true,
  });
}

export async function getDistinctExportedFormNos(): Promise<string[]> {
  const pool = await getConnectionPool();
  const result = await pool
    .request()
    .query(
      `SELECT DISTINCT [form_no] AS formNo FROM [dbo].[${BANK_WIRE_EXPORT_LOG_TABLE}] WHERE [form_no] IS NOT NULL AND LTRIM(RTRIM([form_no])) <> '' AND [form_no] NOT LIKE 'ADHOC-%'`
    );
  return (result.recordset as { formNo: string }[]).map((x) =>
    String(x.formNo).trim()
  );
}

export async function listBankWireExportLog(
  limit: number,
  options?: {
    batchType?: BankWireBatchType | null;
    search?: string;
  }
): Promise<BankWireExportLogDto[]> {
  const pool = await getConnectionPool();
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const batchType = options?.batchType?.trim() || null;
  const search = String(options?.search ?? '').trim();

  const req = pool.request().input('limit', sql.Int, safeLimit);

  const where: string[] = [];
  if (batchType) {
    req.input('batch_type', sql.NVarChar(32), batchType);
    if (batchType === 'commeet') {
      where.push(`([batch_type] = @batch_type OR [batch_type] IS NULL)`);
    } else {
      where.push(`[batch_type] = @batch_type`);
    }
  }
  if (search) {
    req.input('search', sql.NVarChar(200), `%${search}%`);
    where.push(`(
      [payee_name] LIKE @search
      OR [form_no] LIKE @search
      OR [source_filename] LIKE @search
      OR [batch_id] LIKE @search
      OR [payee_account_digits] LIKE @search
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sqlText = `
    SELECT TOP (@limit)
      CAST([id] AS NVARCHAR(32)) AS id,
      [batch_id] AS batchId,
      CONVERT(NVARCHAR(33), [exported_at], 126) AS exportedAt,
      [source_filename] AS sourceFilename,
      [merged_line_index] AS mergedLineIndex,
      [payee_name] AS payeeName,
      [payee_account_digits] AS payeeAccountDigits,
      [bank_code_digits] AS bankCodeDigits,
      [branch_code] AS branchCode,
      [payee_bank_code7] AS payeeBankCode7,
      CAST([payee_account_id] AS NVARCHAR(32)) AS payeeAccountId,
      [scheduled_tx_date] AS scheduledTxDate,
      [batch_type] AS batchType,
      [line_note] AS lineNote,
      CAST([already_uploaded] AS BIT) AS alreadyUploaded,
      [form_no] AS formNo,
      CAST([amount_cents] AS NVARCHAR(32)) AS amountCents
    FROM [dbo].[${BANK_WIRE_EXPORT_LOG_TABLE}]
    ${whereSql}
    ORDER BY [exported_at] DESC, [id] DESC
  `;
  const result = await req.query(sqlText);
  return result.recordset as BankWireExportLogDto[];
}

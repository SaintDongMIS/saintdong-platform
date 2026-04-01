import sql from 'mssql';
import { getConnectionPool } from '../config/database';
import { dbLogger } from './LoggerService';

export const BANK_WIRE_EXPORT_LOG_TABLE = 'BankWireExport_Log';

export interface BankWireLedgerRow {
  mergedLineIndex: number;
  payeeName: string;
  payeeAccountDigits: string;
  bankCodeDigits: string;
  formNo: string;
  amountCents: number;
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
  formNo: string;
  amountCents: string;
}

const INSERT_LEDGER_SQL = `
  INSERT INTO [dbo].[${BANK_WIRE_EXPORT_LOG_TABLE}]
  ([batch_id],[source_filename],[merged_line_index],[payee_name],[payee_account_digits],[bank_code_digits],[form_no],[amount_cents])
  VALUES (@batch_id,@source_filename,@merged_line_index,@payee_name,@payee_account_digits,@bank_code_digits,@form_no,@amount_cents)
`;

/**
 * 同一請求產生之 TXT 對應的多筆明細（具 transaction）
 */
export async function insertBankWireExportLedger(
  batchId: string,
  sourceFilename: string,
  rows: BankWireLedgerRow[]
): Promise<void> {
  if (rows.length === 0) return;

  const pool = await getConnectionPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();
  try {
    for (const r of rows) {
      await new sql.Request(transaction)
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
        .input('form_no', sql.NVarChar(64), r.formNo)
        .input('amount_cents', sql.BigInt, r.amountCents)
        .query(INSERT_LEDGER_SQL);
    }
    await transaction.commit();
    dbLogger.info('BankWireExport_Log 寫入完成', {
      batchId,
      rowCount: rows.length,
    });
  } catch (err) {
    await transaction.rollback();
    dbLogger.error('BankWireExport_Log 寫入失敗', err, { batchId });
    throw err;
  }
}

export async function getDistinctExportedFormNos(): Promise<string[]> {
  const pool = await getConnectionPool();
  const result = await pool
    .request()
    .query(
      `SELECT DISTINCT [form_no] AS formNo FROM [dbo].[${BANK_WIRE_EXPORT_LOG_TABLE}] WHERE [form_no] IS NOT NULL AND LTRIM(RTRIM([form_no])) <> ''`
    );
  return (result.recordset as { formNo: string }[]).map((x) =>
    String(x.formNo).trim()
  );
}

export async function listBankWireExportLog(
  limit: number
): Promise<BankWireExportLogDto[]> {
  const pool = await getConnectionPool();
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const sqlText = `
    SELECT TOP ${safeLimit}
      CAST([id] AS NVARCHAR(32)) AS id,
      [batch_id] AS batchId,
      CONVERT(NVARCHAR(33), [exported_at], 126) AS exportedAt,
      [source_filename] AS sourceFilename,
      [merged_line_index] AS mergedLineIndex,
      [payee_name] AS payeeName,
      [payee_account_digits] AS payeeAccountDigits,
      [bank_code_digits] AS bankCodeDigits,
      [form_no] AS formNo,
      CAST([amount_cents] AS NVARCHAR(32)) AS amountCents
    FROM [dbo].[${BANK_WIRE_EXPORT_LOG_TABLE}]
    ORDER BY [exported_at] DESC, [id] DESC
  `;
  const result = await pool.request().query(sqlText);
  return result.recordset as BankWireExportLogDto[];
}

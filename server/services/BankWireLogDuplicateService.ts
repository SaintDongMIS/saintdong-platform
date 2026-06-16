import { BANK_WIRE_EXPORT_LOG_TABLE } from './BankWireExportLogService';
import { getConnectionPool } from '../config/database';
import {
  matchWireRowsAgainstLog,
  type BankWireDuplicateMatch,
  type BankWireLogDuplicateEntry,
  type BankWireWireRowForDuplicateCheck,
} from '../../utils/bankWireLogDuplicateMatch';

export type BankWireDuplicateMatchDto = BankWireDuplicateMatch & {
  tierLabel: string;
};

function tierLabel(tier: BankWireDuplicateMatch['tier']): string {
  return tier === 'strong' ? '與紀錄重複（同日/近七日）' : '疑似與紀錄重複';
}

export async function fetchAllLogEntriesForDuplicateCheck(): Promise<
  BankWireLogDuplicateEntry[]
> {
  const pool = await getConnectionPool();
  const result = await pool.request().query(`
    SELECT
      CAST([id] AS NVARCHAR(32)) AS id,
      [batch_id] AS batchId,
      [batch_type] AS batchType,
      [scheduled_tx_date] AS scheduledTxDate,
      CONVERT(NVARCHAR(33), [exported_at], 126) AS exportedAt,
      [payee_name] AS payeeName,
      [payee_account_digits] AS payeeAccountDigits,
      CAST([amount_cents] AS BIGINT) AS amountCents
    FROM [dbo].[${BANK_WIRE_EXPORT_LOG_TABLE}]
    WHERE [payee_account_digits] IS NOT NULL
      AND LTRIM(RTRIM([payee_account_digits])) <> ''
      AND [amount_cents] IS NOT NULL
  `);

  return (result.recordset as BankWireLogDuplicateEntry[]).map((r) => ({
    ...r,
    amountCents: Number(r.amountCents),
    payeeAccountDigits: String(r.payeeAccountDigits ?? '').replace(/\D/g, ''),
    payeeName: String(r.payeeName ?? '').trim(),
  }));
}

export async function findDuplicateMatchesForWireRows(
  wireRows: BankWireWireRowForDuplicateCheck[],
  scheduledTxDateYmd: string
): Promise<BankWireDuplicateMatchDto[]> {
  const logEntries = await fetchAllLogEntriesForDuplicateCheck();
  const matches = matchWireRowsAgainstLog(
    wireRows,
    logEntries,
    scheduledTxDateYmd
  );
  return matches.map((m) => ({
    ...m,
    tierLabel: tierLabel(m.tier),
  }));
}

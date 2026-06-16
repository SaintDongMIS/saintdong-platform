import { createError, defineEventHandler, readBody } from 'h3';
import {
  assertScheduledTxDateYmd,
  buildBackfillLedgerRows,
  type BankWireBackfillInputRow,
} from '../../../services/BankWireBackfillService';
import { findDuplicateMatchesForWireRows } from '../../../services/BankWireLogDuplicateService';
import { apiLogger } from '../../../services/LoggerService';
import { formatAmountCentsDisplay } from '../../../../utils/bankWireExportLogDisplay';

type PreviewRequestBody = {
  scheduledTxDateYmd?: string;
  rows?: BankWireBackfillInputRow[];
};

/**
 * POST /api/bank-wire-export-log/backfill/preview
 * 事後登錄預覽：組裝 ledger 列 + log 重複比對（不寫入 DB）
 */
export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    });
  }

  try {
    const body = (await readBody(event)) as PreviewRequestBody;
    const scheduledTxDateYmd = assertScheduledTxDateYmd(
      String(body?.scheduledTxDateYmd ?? '')
    );
    const inputs = body?.rows;
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'rows 須為非空陣列',
      });
    }

    const ledgerRows = await buildBackfillLedgerRows(inputs);
    const duplicateMatches = await findDuplicateMatchesForWireRows(
      ledgerRows.map((r, rowIndex) => ({
        rowIndex,
        payeeName: r.payeeName,
        payeeAccountDigits: r.payeeAccountDigits,
        amountCents: r.amountCents,
      })),
      scheduledTxDateYmd
    );

    apiLogger.info('事後登錄預覽', {
      rowCount: ledgerRows.length,
      duplicateCount: duplicateMatches.length,
    });

    return {
      ok: true as const,
      scheduledTxDateYmd,
      rowCount: ledgerRows.length,
      rows: ledgerRows.map((r, i) => ({
        rowIndex: i,
        mergedLineIndex: r.mergedLineIndex,
        payeeName: r.payeeName,
        payeeAccountDigits: r.payeeAccountDigits,
        payeeBankCode7: r.payeeBankCode7,
        branchCode: r.branchCode,
        bankCodeDigits: r.bankCodeDigits,
        lineNote: r.lineNote,
        formNo: r.formNo,
        payeeAccountId: r.payeeAccountId,
        amountCents: r.amountCents,
        amountDisplay: formatAmountCentsDisplay(r.amountCents),
      })),
      duplicateMatches,
      duplicateMatchCount: duplicateMatches.length,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '預覽失敗';
    apiLogger.error('backfill preview 失敗', err);
    if (err && typeof err === 'object' && 'statusCode' in err) {
      throw err;
    }
    throw createError({
      statusCode: 400,
      statusMessage: msg,
    });
  }
});

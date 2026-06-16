import { createError, defineEventHandler, readBody } from 'h3';
import {
  assertScheduledTxDateYmd,
  buildBackfillLedgerRows,
  parseOptionalExportedAt,
  type BankWireBackfillInputRow,
} from '../../services/BankWireBackfillService';
import {
  createManualBackfillBatchId,
  insertBankWireExportBackfill,
} from '../../services/BankWireExportLogService';
import { apiLogger } from '../../services/LoggerService';

type BackfillRequestBody = {
  sourceFilename?: string;
  scheduledTxDateYmd?: string;
  exportedAt?: string;
  rows?: BankWireBackfillInputRow[];
};

/**
 * POST /api/bank-wire-export-log/backfill
 * 事後登錄：國泰已匯完，僅補寫 BankWireExport_Log（不產 TXT）
 */
export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    });
  }

  try {
    const body = (await readBody(event)) as BackfillRequestBody;
    const sourceFilename = String(body?.sourceFilename ?? '').trim();
    if (!sourceFilename) {
      throw createError({
        statusCode: 400,
        statusMessage: 'sourceFilename 為必填',
      });
    }

    const scheduledTxDateYmd = assertScheduledTxDateYmd(
      String(body?.scheduledTxDateYmd ?? '')
    );
    const exportedAt = parseOptionalExportedAt(body?.exportedAt);
    const inputs = body?.rows;
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'rows 須為非空陣列',
      });
    }

    const ledgerRows = await buildBackfillLedgerRows(inputs);
    const batchId = createManualBackfillBatchId(exportedAt ?? new Date());

    await insertBankWireExportBackfill(batchId, sourceFilename, ledgerRows, {
      scheduledTxDateYmd,
      exportedAt,
    });

    apiLogger.info('BankWireExport_Log 事後登錄完成', {
      batchId,
      rowCount: ledgerRows.length,
      sourceFilename,
    });

    return {
      ok: true as const,
      batchId,
      rowCount: ledgerRows.length,
      scheduledTxDateYmd,
      batchType: 'manual_backfill' as const,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '事後登錄失敗';
    apiLogger.error('bank-wire-export-log backfill 失敗', err);
    if (err && typeof err === 'object' && 'statusCode' in err) {
      throw err;
    }
    throw createError({
      statusCode: 400,
      statusMessage: msg,
    });
  }
});

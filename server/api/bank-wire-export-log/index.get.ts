import { createError, defineEventHandler, getQuery } from 'h3';
import {
  listBankWireExportLog,
  type BankWireBatchType,
} from '../../services/BankWireExportLogService';
import { apiLogger } from '../../services/LoggerService';

const ALLOWED_BATCH_TYPES = new Set<BankWireBatchType>([
  'commeet',
  'adhoc',
  'manual_backfill',
]);

/**
 * GET /api/bank-wire-export-log
 * Query: limit（預設 200，上限 500）、batchType、q（戶名／表單／檔名／批次搜尋）
 */
export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'GET') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    });
  }

  const query = getQuery(event);
  const raw = query.limit != null ? parseInt(String(query.limit), 10) : 200;
  const limit = Number.isFinite(raw) ? raw : 200;

  const batchTypeRaw = String(query.batchType ?? '').trim();
  const batchType = ALLOWED_BATCH_TYPES.has(batchTypeRaw as BankWireBatchType)
    ? (batchTypeRaw as BankWireBatchType)
    : undefined;
  const search = String(query.q ?? '').trim();

  try {
    const rows = await listBankWireExportLog(limit, {
      batchType,
      search: search || undefined,
    });
    return { ok: true as const, rows, count: rows.length };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : '讀取匯出紀錄失敗';
    apiLogger.error('bank-wire-export-log GET 失敗', err);
    throw createError({
      statusCode: 500,
      statusMessage: msg,
    });
  }
});

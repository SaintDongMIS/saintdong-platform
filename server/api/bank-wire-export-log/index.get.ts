import { createError, defineEventHandler, getQuery } from 'h3';
import { listBankWireExportLog } from '../../services/BankWireExportLogService';
import { apiLogger } from '../../services/LoggerService';

/**
 * GET /api/bank-wire-export-log
 * Query: limit（預設 120，上限 500）
 */
export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'GET') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    });
  }

  const query = getQuery(event);
  const raw = query.limit != null ? parseInt(String(query.limit), 10) : 120;
  const limit = Number.isFinite(raw) ? raw : 120;

  try {
    const rows = await listBankWireExportLog(limit);
    return { ok: true as const, rows };
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

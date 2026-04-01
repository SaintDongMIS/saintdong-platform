import { createError, defineEventHandler } from 'h3';
import { getDistinctExportedFormNos } from '../../services/BankWireExportLogService';
import { apiLogger } from '../../services/LoggerService';

/**
 * GET /api/bank-wire-export-log/exported-form-nos
 * 曾寫入 log 的表單編號（去重），供預覽預設排除
 */
export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'GET') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    });
  }

  try {
    const formNos = await getDistinctExportedFormNos();
    return { ok: true as const, formNos };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : '讀取已匯表單清單失敗';
    apiLogger.error('exported-form-nos GET 失敗', err);
    throw createError({
      statusCode: 500,
      statusMessage: msg,
    });
  }
});

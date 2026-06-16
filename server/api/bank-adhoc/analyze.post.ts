import { createError, defineEventHandler, readBody } from 'h3';
import { analyzeCommeetWireRowsForPayeeMaster } from '../../services/BankWirePayeeAnalysisService';
import { findDuplicateMatchesForWireRows } from '../../services/BankWireLogDuplicateService';
import { assertScheduledTxDateYmd } from '../../services/BankWireBackfillService';
import { apiLogger } from '../../services/LoggerService';
import {
  parseBankAdhocInputs,
  type BankAdhocAnalyzeRequestBody,
} from '../../utils/bankAdhocRequest';

/**
 * POST /api/bank-adhoc/analyze
 * 臨時整批匯款：paste/CSV/Excel 列 → Payee_Accounts + log 重複比對（JSON）
 */
export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    });
  }

  try {
    const body = (await readBody(event)) as BankAdhocAnalyzeRequestBody;
    const parsed = parseBankAdhocInputs(body);
    if (!parsed.ok) {
      throw createError({ statusCode: 400, statusMessage: parsed.error });
    }

    const { sourceLabel, mergeMode, data } = parsed;
    const scheduledTxDateYmd = body.scheduledTxDateYmd
      ? assertScheduledTxDateYmd(String(body.scheduledTxDateYmd))
      : '';

    apiLogger.info('臨時整批匯款分析', {
      sourceLabel,
      wireRows: data.rows.length,
      mergeMode,
    });

    const rows =
      data.rows.length === 0
        ? []
        : await analyzeCommeetWireRowsForPayeeMaster(data.rows);

    const duplicateMatches =
      data.rows.length > 0 && scheduledTxDateYmd
        ? await findDuplicateMatchesForWireRows(
            data.rows.map((r, rowIndex) => ({
              rowIndex,
              payeeName: r.payeeName,
              payeeAccountDigits: r.accountDigits,
              amountCents: parseInt(r.amount14, 10) || 0,
            })),
            scheduledTxDateYmd
          )
        : [];

    return {
      ok: true as const,
      sourceLabel,
      mergeMode,
      scheduledTxDateYmd: scheduledTxDateYmd || null,
      skippedInvalid: data.skippedInvalid,
      totalInputRows: data.totalInputRows,
      wireRowCount: data.rows.length,
      lineNotes: data.lineNotes,
      rows,
      duplicateMatches,
      duplicateMatchCount: duplicateMatches.length,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '臨時整批匯款分析失敗';
    apiLogger.error('bank-adhoc analyze 失敗', err);
    if (err && typeof err === 'object' && 'statusCode' in err) {
      throw err;
    }
    throw createError({ statusCode: 400, statusMessage: msg });
  }
});

import crypto from 'crypto';
import { createError, defineEventHandler, readBody, setHeader } from 'h3';
import { BankConverterService } from '../services/BankConverterService';
import {
  insertBankWireExportLedger,
  type BankWireLedgerRow,
} from '../services/BankWireExportLogService';
import { apiLogger } from '../services/LoggerService';
import { applyPayeeResolutionsToWireRows } from '../utils/applyBankWirePayeeResolutions';
import {
  buildLineNoteByRowIndex,
  parseBankAdhocInputs,
  parseExcludedRowIndexes,
  parseResolutions,
  parseScheduledTxDateYmdRequired,
  type BankAdhocConvertRequestBody,
} from '../utils/bankAdhocRequest';
import { assertWireGroupsSamePayeeBankCode7 } from '../../utils/bankWireMerge';
import { getTaipeiDateTimeParts } from '../../utils/bankWireScheduledTransDate';

function buildPayeeAccountIdMap(
  resolutions: { rowIndex: number; kind: string; payeeAccountId?: string }[]
): Map<number, number> | undefined {
  const map = new Map<number, number>();
  for (const r of resolutions) {
    if (r.kind === 'master' && r.payeeAccountId) {
      const id = parseInt(String(r.payeeAccountId), 10);
      if (Number.isFinite(id)) map.set(r.rowIndex, id);
    }
  }
  return map.size > 0 ? map : undefined;
}

function createAdhocBatchId(now: Date): string {
  const { year, month, day, hour, minute, second } =
    getTaipeiDateTimeParts(now);
  const ts = `${year}${month}${day}-${hour}${minute}${second}`;
  const suffix = crypto
    .randomBytes(3)
    .toString('base64url')
    .toUpperCase()
    .slice(0, 4);
  return `BW-ADHOC-${ts}-${suffix}`;
}

function createAdhocDownloadFilename(now: Date): string {
  const { month, day, hour, minute } = getTaipeiDateTimeParts(now);
  return `臨時整批匯款_${month}${day}${hour}${minute}.txt`;
}

/**
 * POST /api/bank-adhoc
 * 臨時整批匯款：產國泰 TXT + 寫 BankWireExport_Log（batch_type=adhoc）
 */
export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    });
  }

  try {
    const body = (await readBody(event)) as BankAdhocConvertRequestBody;
    const parsed = parseBankAdhocInputs(body);
    if (!parsed.ok) {
      throw createError({ statusCode: 400, statusMessage: parsed.error });
    }

    const scheduledTxDateYmd = parseScheduledTxDateYmdRequired(
      body.scheduledTxDateYmd
    );
    const resolutions = parseResolutions(body.resolutions);
    const { sourceLabel, mergeMode, data } = parsed;

    if (resolutions.length !== data.rows.length) {
      throw createError({
        statusCode: 400,
        statusMessage: `決議筆數（${resolutions.length}）須與匯款列（${data.rows.length}）相同`,
      });
    }

    const excludedRowIndexes = parseExcludedRowIndexes(body.excludedRowIndexes);
    const resolvedRows = await applyPayeeResolutionsToWireRows(
      data.rows,
      resolutions
    );
    assertWireGroupsSamePayeeBankCode7(resolvedRows, new Set(), {
      excludedRowIndexes,
      mergeMode,
    });

    const converter = new BankConverterService();
    const result = converter.convertFromExtractedWireRows(
      {
        rows: resolvedRows,
        skippedNonWire: 0,
        skippedInvalid: data.skippedInvalid,
        totalDataRows: data.totalInputRows,
      },
      {
        excludedRowIndexes,
        payeeAccountIdByRowIndex: buildPayeeAccountIdMap(resolutions),
        lineNoteByRowIndex: buildLineNoteByRowIndex(data),
        scheduledTxDateYmd,
        mergeMode,
      }
    );

    if (!result.outputBuffer?.length) {
      throw createError({
        statusCode: 400,
        statusMessage: '轉檔結果為空，請確認至少保留一筆匯款列',
      });
    }

    const now = new Date();
    const batchId = createAdhocBatchId(now);
    let ledgerRows: BankWireLedgerRow[] = result.ledgerRows;
    try {
      await insertBankWireExportLedger(
        batchId,
        sourceLabel,
        ledgerRows,
        {
          batchType: 'adhoc',
          scheduledTxDateYmd: result.scheduledTxDateYmd,
          alreadyUploaded: false,
        }
      );
    } catch (logErr: unknown) {
      const msg =
        logErr instanceof Error ? logErr.message : '資料庫錯誤';
      apiLogger.error('adhoc 匯出紀錄寫入失敗', logErr, { batchId });
      throw createError({
        statusCode: 500,
        statusMessage: `轉檔成功但紀錄寫入失敗，請勿重複匯款：${msg}`,
      });
    }

    apiLogger.info('臨時整批匯款轉檔成功', {
      batchId,
      sourceLabel,
      ledgerCount: ledgerRows.length,
      mergeMode,
    });

    const filename = createAdhocDownloadFilename(now);
    setHeader(event, 'Content-Type', 'text/plain; charset=big5');
    setHeader(
      event,
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`
    );
    setHeader(event, 'Content-Length', result.outputBuffer.length);

    return result.outputBuffer;
  } catch (err: unknown) {
    apiLogger.error('bank-adhoc convert 失敗', err);
    if (err && typeof err === 'object' && 'statusCode' in err) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : '臨時整批匯款轉檔失敗';
    throw createError({ statusCode: 400, statusMessage: msg });
  }
});

import type { WireMergeMode } from '../../utils/bankWireMerge';
import {
  adhocInputRowsToWireExtract,
  parseAdhocPasteText,
  type AdhocWireInputRow,
  type AdhocWireExtractResult,
} from '../../utils/adhocBankWireParse';
import { assertScheduledTxDateYmd } from '../services/BankWireBackfillService';
import type { BankWirePayeeResolutionInput } from './applyBankWirePayeeResolutions';

export type BankAdhocAnalyzeRequestBody = {
  sourceLabel?: string;
  mergeMode?: WireMergeMode;
  scheduledTxDateYmd?: string;
  pasteText?: string;
  rows?: AdhocWireInputRow[];
  /** 前端已解析之會計 Excel 匯款列（略過 paste/rows 再解析） */
  wireExtract?: AdhocWireExtractResult;
};

export type BankAdhocConvertRequestBody = BankAdhocAnalyzeRequestBody & {
  scheduledTxDateYmd: string;
  excludedRowIndexes?: number[];
  resolutions: BankWirePayeeResolutionInput[];
};

export function parseBankAdhocInputs(
  body: BankAdhocAnalyzeRequestBody
):
  | { ok: true; sourceLabel: string; mergeMode: WireMergeMode; data: AdhocWireExtractResult }
  | { ok: false; error: string } {
  const mergeMode: WireMergeMode =
    body?.mergeMode === 'none' ? 'none' : 'by_payee_name';
  const sourceLabel =
    String(body?.sourceLabel ?? '').trim() || '臨時整批匯款_paste.txt';

  const preParsed = body?.wireExtract;
  if (preParsed?.rows?.length) {
    return { ok: true, sourceLabel, mergeMode, data: preParsed };
  }

  const pasteText = String(body?.pasteText ?? '').trim();
  const rawRows = body?.rows;
  let inputs: AdhocWireInputRow[] = [];
  if (Array.isArray(rawRows) && rawRows.length > 0) {
    inputs = rawRows;
  } else if (pasteText) {
    inputs = parseAdhocPasteText(pasteText);
  } else {
    return { ok: false, error: '須提供 Excel 解析結果、pasteText 或 rows' };
  }

  const extracted = adhocInputRowsToWireExtract(inputs);
  if (!extracted.ok) {
    return { ok: false, error: extracted.error };
  }

  return {
    ok: true,
    sourceLabel,
    mergeMode,
    data: extracted.data,
  };
}

export function buildLineNoteByRowIndex(
  data: AdhocWireExtractResult
): Map<number, string> {
  const map = new Map<number, string>();
  for (let i = 0; i < data.lineNotes.length; i++) {
    const note = data.lineNotes[i]?.trim();
    if (note) map.set(i, note);
  }
  return map;
}

export function parseScheduledTxDateYmdRequired(value: unknown): string {
  return assertScheduledTxDateYmd(String(value ?? ''));
}

export function parseExcludedRowIndexes(value: unknown): Set<number> {
  const set = new Set<number>();
  if (!Array.isArray(value)) return set;
  for (const x of value) {
    const n = parseInt(String(x), 10);
    if (Number.isFinite(n) && n >= 0) set.add(n);
  }
  return set;
}

export function parseResolutions(value: unknown): BankWirePayeeResolutionInput[] {
  if (!Array.isArray(value)) {
    throw new Error('resolutions 須為陣列');
  }
  return value as BankWirePayeeResolutionInput[];
}

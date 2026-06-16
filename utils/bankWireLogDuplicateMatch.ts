/** 與 BankWireExport_Log 比對重複（B+C：帳號+金額+戶名；全 batch_type） */

export type BankWireDuplicateTier = 'strong' | 'weak';

export type BankWireLogDuplicateEntry = {
  id: string;
  batchId: string;
  batchType: string | null;
  scheduledTxDate: string | null;
  exportedAt: string;
  payeeName: string;
  payeeAccountDigits: string;
  amountCents: number;
};

export type BankWireDuplicateMatch = {
  rowIndex: number;
  tier: BankWireDuplicateTier;
  log: BankWireLogDuplicateEntry;
};

export type BankWireWireRowForDuplicateCheck = {
  rowIndex: number;
  payeeName: string;
  payeeAccountDigits: string;
  amountCents: number;
};

/** 強重複：交易日相差不超過此天數（含） */
export const BANK_WIRE_STRONG_DUPLICATE_MAX_DAYS = 7;

export function normalizePayeeNameForDuplicate(name: string): string {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, '');
}

export function normalizeAccountDigitsForDuplicate(account: string): string {
  return String(account ?? '').replace(/\D/g, '');
}

export function buildWireDuplicateKey(
  payeeName: string,
  payeeAccountDigits: string,
  amountCents: number
): string {
  return [
    normalizeAccountDigitsForDuplicate(payeeAccountDigits),
    String(amountCents),
    normalizePayeeNameForDuplicate(payeeName),
  ].join('|');
}

export function parseYmdToUtcDate(ymd: string): Date | null {
  const s = String(ymd ?? '').trim();
  if (!/^\d{8}$/.test(s)) return null;
  const y = parseInt(s.slice(0, 4), 10);
  const m = parseInt(s.slice(4, 6), 10) - 1;
  const d = parseInt(s.slice(6, 8), 10);
  const dt = new Date(Date.UTC(y, m, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function daysBetweenYmd(a: string, b: string): number | null {
  const da = parseYmdToUtcDate(a);
  const db = parseYmdToUtcDate(b);
  if (!da || !db) return null;
  const ms = Math.abs(da.getTime() - db.getTime());
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function duplicateTier(
  scheduledTxDateYmd: string,
  logScheduled: string | null
): BankWireDuplicateTier {
  if (!logScheduled?.trim()) return 'weak';
  const days = daysBetweenYmd(scheduledTxDateYmd, logScheduled.trim());
  if (days == null) return 'weak';
  return days <= BANK_WIRE_STRONG_DUPLICATE_MAX_DAYS ? 'strong' : 'weak';
}

/**
 * 每筆 wire 列找 log 中最佳匹配（同 key 取 exported_at 最新一筆）
 */
export function matchWireRowsAgainstLog(
  wireRows: BankWireWireRowForDuplicateCheck[],
  logEntries: BankWireLogDuplicateEntry[],
  scheduledTxDateYmd: string
): BankWireDuplicateMatch[] {
  const byKey = new Map<string, BankWireLogDuplicateEntry[]>();
  for (const log of logEntries) {
    const acct = normalizeAccountDigitsForDuplicate(log.payeeAccountDigits);
    if (!acct || !Number.isFinite(log.amountCents)) continue;
    const key = buildWireDuplicateKey(
      log.payeeName,
      log.payeeAccountDigits,
      log.amountCents
    );
    const list = byKey.get(key) ?? [];
    list.push(log);
    byKey.set(key, list);
  }

  const out: BankWireDuplicateMatch[] = [];
  for (const row of wireRows) {
    const acct = normalizeAccountDigitsForDuplicate(row.payeeAccountDigits);
    if (!acct || !Number.isFinite(row.amountCents)) continue;
    const key = buildWireDuplicateKey(
      row.payeeName,
      row.payeeAccountDigits,
      row.amountCents
    );
    const candidates = byKey.get(key);
    if (!candidates?.length) continue;

    const log = candidates.reduce((best, cur) =>
      String(cur.exportedAt) > String(best.exportedAt) ? cur : best
    );
    out.push({
      rowIndex: row.rowIndex,
      tier: duplicateTier(scheduledTxDateYmd, log.scheduledTxDate),
      log,
    });
  }
  return out;
}

export function duplicateTierLabel(tier: BankWireDuplicateTier): string {
  return tier === 'strong' ? '與紀錄重複（同日/近七日）' : '疑似與紀錄重複';
}

import type { CommeetWireExportRow } from '~/utils/commeetBankExcelParse';

/** 與網銀轉檔／預覽一致：收款人戶名 trim 後相同 → 同一合併群組 */
export function normalizePayeeName(name: string): string {
  return name.trim();
}

export function sumAmount14Strings(parts: string[]): string {
  let total = 0;
  for (const p of parts) {
    const n = parseInt(p, 10);
    if (Number.isFinite(n)) total += n;
  }
  const s = String(total);
  if (s.length > 14) return s;
  return s.padStart(14, '0');
}

/**
 * 依「收款人戶名」分組（先排除 excluded 表單）；群組順序＝該戶名在原始 rows 中首次出現順序。
 */
export function groupRowsByPayeeName<T extends { formNo: string; payeeName: string }>(
  rows: T[],
  excludedFormNos: Set<string>
): T[][] {
  const active = rows.filter((r) => !excludedFormNos.has(r.formNo));
  if (active.length === 0) return [];

  const keyOrder: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (excludedFormNos.has(r.formNo)) continue;
    const k = normalizePayeeName(r.payeeName);
    if (!seen.has(k)) {
      seen.add(k);
      keyOrder.push(k);
    }
  }

  const byKey = new Map<string, T[]>();
  for (const r of active) {
    const k = normalizePayeeName(r.payeeName);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(r);
  }

  return keyOrder.map((k) => byKey.get(k)!);
}

export function groupCommeetWireRowsByPayeeName(
  rows: CommeetWireExportRow[],
  excludedFormNos: Set<string>
): CommeetWireExportRow[][] {
  return groupRowsByPayeeName(rows, excludedFormNos);
}

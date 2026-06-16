import type { CommeetWireExportRow } from '~/utils/commeetBankExcelParse';

/** 與網銀轉檔／預覽一致：收款人戶名 trim 後相同 → 同一合併群組 */
export function normalizePayeeName(name: string): string {
  return name.trim();
}

export type WireMergeMode = 'by_payee_name' | 'none';

export type WireExportGroupOptions = {
  excludedFormNos?: Set<string>;
  excludedRowIndexes?: Set<number>;
  mergeMode?: WireMergeMode;
};

function isRowExcludedForExport(
  row: { formNo: string },
  index: number,
  excludedFormNos: Set<string>,
  excludedRowIndexes: Set<number>
): boolean {
  if (excludedRowIndexes.has(index)) return true;
  const fn = String(row.formNo ?? '').trim();
  if (fn && excludedFormNos.has(fn)) return true;
  return false;
}

/**
 * 匯出分組：可選依戶名合併或一筆一列；排除以 formNo 或列 index 表示
 */
export function groupWireRowsForExport(
  rows: CommeetWireExportRow[],
  opts?: WireExportGroupOptions
): CommeetWireExportRow[][] {
  const excludedFormNos = opts?.excludedFormNos ?? new Set<string>();
  const excludedRowIndexes = opts?.excludedRowIndexes ?? new Set<number>();
  const mergeMode = opts?.mergeMode ?? 'by_payee_name';

  const activeCount = rows.filter(
    (r, i) => !isRowExcludedForExport(r, i, excludedFormNos, excludedRowIndexes)
  ).length;
  if (activeCount === 0) return [];

  if (mergeMode === 'none') {
    return rows
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => !isRowExcludedForExport(r, i, excludedFormNos, excludedRowIndexes))
      .map(({ r }) => [r]);
  }

  const keyOrder: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (isRowExcludedForExport(r, i, excludedFormNos, excludedRowIndexes)) continue;
    const k = normalizePayeeName(r.payeeName);
    if (!seen.has(k)) {
      seen.add(k);
      keyOrder.push(k);
    }
  }

  const byKey = new Map<string, CommeetWireExportRow[]>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (isRowExcludedForExport(r, i, excludedFormNos, excludedRowIndexes)) continue;
    const k = normalizePayeeName(r.payeeName);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(r);
  }

  return keyOrder.map((k) => byKey.get(k)!);
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
  return groupWireRowsForExport(rows, {
    excludedFormNos,
    mergeMode: 'by_payee_name',
  });
}

/** 同戶名合併群組內收款清算七碼須一致，否則國泰檔無法唯一決定 */
export function assertWireGroupsSamePayeeBankCode7(
  rows: CommeetWireExportRow[],
  excludedFormNos: Set<string>,
  opts?: Pick<WireExportGroupOptions, 'excludedRowIndexes' | 'mergeMode'>
): void {
  if (opts?.mergeMode === 'none') return;
  const groups = groupWireRowsForExport(rows, {
    excludedFormNos,
    excludedRowIndexes: opts?.excludedRowIndexes,
    mergeMode: opts?.mergeMode ?? 'by_payee_name',
  });
  for (const group of groups) {
    if (group.length === 0) continue;
    const expect = group[0]!.payeeBankCode7.replace(/\D/g, '').padStart(7, '0').slice(0, 7);
    for (const r of group) {
      const got = r.payeeBankCode7.replace(/\D/g, '').padStart(7, '0').slice(0, 7);
      if (got !== expect) {
        throw new Error(
          `收款人戶名「${group[0]!.payeeName}」合併群組內收款清算七碼不一致（${expect} 與 ${got}），請統一後再轉檔。`
        );
      }
    }
  }
}

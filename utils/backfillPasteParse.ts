import type { BankWireBackfillInputRow } from '../server/services/BankWireBackfillService';

export type { BankWireBackfillInputRow };

export type BackfillPasteParseResult =
  | { ok: true; rows: BankWireBackfillInputRow[]; skipped: number }
  | { ok: false; error: string };

const HEADER_ALIASES: Record<string, keyof BankWireBackfillInputRow> = {
  戶名: 'payeeName',
  收款人: 'payeeName',
  收款人戶名: 'payeeName',
  payeename: 'payeeName',
  金額: 'amountYuan',
  amount: 'amountYuan',
  amountyuan: 'amountYuan',
  帳號: 'payeeAccountDigits',
  收款帳號: 'payeeAccountDigits',
  account: 'payeeAccountDigits',
  七碼: 'payeeBankCode7',
  銀行七碼: 'payeeBankCode7',
  bank7: 'payeeBankCode7',
  payeebankcode7: 'payeeBankCode7',
  銀行: 'bankCodeDigits',
  銀行代碼: 'bankCodeDigits',
  bank: 'bankCodeDigits',
  分行: 'branchCode',
  branch: 'branchCode',
  事由: 'lineNote',
  備註: 'lineNote',
  note: 'lineNote',
  表單: 'formNo',
  表單編號: 'formNo',
  formno: 'formNo',
  合併序號: 'mergedLineIndex',
  mergedlineindex: 'mergedLineIndex',
};

function splitLine(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map((c) => c.trim());
  }
  return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) =>
    c.trim().replace(/^"|"$/g, '')
  );
}

function normalizeHeader(cell: string): string {
  return String(cell ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
}

function detectHeaderMap(cells: string[]): Map<number, keyof BankWireBackfillInputRow> | null {
  const map = new Map<number, keyof BankWireBackfillInputRow>();
  let hits = 0;
  for (let i = 0; i < cells.length; i++) {
    const key = HEADER_ALIASES[normalizeHeader(cells[i]!)];
    if (key) {
      map.set(i, key);
      hits++;
    }
  }
  return hits >= 2 ? map : null;
}

function defaultColumnMap(): Map<number, keyof BankWireBackfillInputRow> {
  return new Map([
    [0, 'payeeName'],
    [1, 'amountYuan'],
    [2, 'payeeAccountDigits'],
    [3, 'payeeBankCode7'],
    [4, 'lineNote'],
    [5, 'formNo'],
  ]);
}

function rowFromCells(
  cells: string[],
  colMap: Map<number, keyof BankWireBackfillInputRow>
): BankWireBackfillInputRow | null {
  const row: BankWireBackfillInputRow = {
    payeeName: '',
    payeeAccountDigits: '',
    amountYuan: '',
  };

  for (const [idx, field] of colMap.entries()) {
    const val = String(cells[idx] ?? '').trim();
    if (!val) continue;
    if (field === 'mergedLineIndex') {
      const n = parseInt(val, 10);
      if (Number.isFinite(n)) row.mergedLineIndex = n;
      continue;
    }
    (row as Record<string, unknown>)[field] = val;
  }

  if (!row.payeeName?.trim() || !row.payeeAccountDigits?.trim()) return null;
  if (
    row.amountYuan == null ||
    String(row.amountYuan).trim() === ''
  ) {
    return null;
  }

  const bank7 = String(row.payeeBankCode7 ?? '').replace(/\D/g, '');
  if (bank7.length === 7) {
    row.payeeBankCode7 = bank7;
    row.bankCodeDigits = bank7.slice(0, 3);
    row.branchCode = bank7.slice(3, 7);
  }

  return row;
}

export const BACKFILL_PASTE_EXAMPLE = `戶名\t金額\t帳號\t七碼\t事由\t表單編號
上承人資管理顧問有限公司\t70350\t109001033581\t0041090\t上承5月服務費\t
大智人力顧問有限公司\t114188\t163540257276\t8220406\t大智5月服務費\t`;

/**
 * 解析事後登錄貼上文字（Tab 或逗號分隔；可含標題列）
 */
export function parseBackfillPasteText(text: string): BackfillPasteParseResult {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  if (lines.length === 0) {
    return { ok: false, error: '請貼上至少一筆明細' };
  }

  let colMap = detectHeaderMap(splitLine(lines[0]!));
  let startIdx = colMap ? 1 : 0;
  if (!colMap) colMap = defaultColumnMap();

  const rows: BankWireBackfillInputRow[] = [];
  let skipped = 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cells = splitLine(lines[i]!);
    const row = rowFromCells(cells, colMap);
    if (!row) {
      skipped++;
      continue;
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    return {
      ok: false,
      error: '無法解析有效列；請確認含戶名、金額、帳號（可選七碼、事由、表單編號）',
    };
  }

  return { ok: true, rows, skipped };
}

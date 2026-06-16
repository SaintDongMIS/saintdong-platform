import {
  accountDigitsPreserve,
  formatReceivingBankCode7,
  parseAmountToAmount14,
  type CommeetWireExportRow,
} from './commeetBankExcelParse';

export type AdhocWireInputRow = {
  payeeName: string;
  amount: string | number;
  bankCode?: string;
  branchCode?: string;
  accountNo: string;
  formNo?: string;
  lineNote?: string;
  payeeTaxId?: string;
};

export type AdhocWireExtractResult = {
  rows: CommeetWireExportRow[];
  lineNotes: string[];
  skippedInvalid: number;
  totalInputRows: number;
};

const HEADER_HINTS = ['戶名', '收款人', 'payee', 'name', '戶名名稱'];

function parseCsvFields(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((c === ',' || c === '\t') && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function isHeaderRow(fields: string[]): boolean {
  const first = (fields[0] ?? '').trim().toLowerCase();
  return HEADER_HINTS.some((h) => first.includes(h.toLowerCase()));
}

function parseBankAndBranch(
  bankCode?: string,
  branchCode?: string
): { bank3: string; branch4: string; bank7: string } {
  const raw = String(bankCode ?? '').replace(/\D/g, '');
  if (raw.length >= 7) {
    const bank3 = raw.slice(0, 3);
    const branch4 = raw.slice(3, 7);
    return { bank3, branch4, bank7: raw.slice(0, 7) };
  }
  const bank3 = raw.padStart(3, '0').slice(-3);
  const branch4 = String(branchCode ?? '0000')
    .replace(/\D/g, '')
    .padStart(4, '0')
    .slice(-4);
  return { bank3, branch4, bank7: (bank3 + branch4).slice(0, 7) };
}

function fieldsToInputRow(fields: string[]): AdhocWireInputRow | null {
  if (fields.length < 5) return null;
  if (fields.length >= 6) {
    const [payeeName, lineNote, bankCode, _bankName, accountNo, amount] = fields;
    return {
      payeeName: String(payeeName ?? '').trim(),
      lineNote: String(lineNote ?? '').trim(),
      bankCode: String(bankCode ?? '').trim(),
      accountNo: String(accountNo ?? '').trim(),
      amount: String(amount ?? '').trim(),
    };
  }
  const [payeeName, lineNote, bankCode, accountNo, amount] = fields;
  return {
    payeeName: String(payeeName ?? '').trim(),
    lineNote: String(lineNote ?? '').trim(),
    bankCode: String(bankCode ?? '').trim(),
    accountNo: String(accountNo ?? '').trim(),
    amount: String(amount ?? '').trim(),
  };
}

export function parseAdhocPasteText(text: string): AdhocWireInputRow[] {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: AdhocWireInputRow[] = [];
  for (const line of lines) {
    const fields = parseCsvFields(line);
    if (fields.length === 0) continue;
    if (out.length === 0 && isHeaderRow(fields)) continue;
    const row = fieldsToInputRow(fields);
    if (row?.payeeName) out.push(row);
  }
  return out;
}

export function adhocInputRowsToWireExtract(
  inputs: AdhocWireInputRow[]
): { ok: true; data: AdhocWireExtractResult } | { ok: false; error: string } {
  if (!inputs.length) {
    return {
      ok: false,
      error: '至少須有一筆匯款列。請上傳會計 Payment Excel，或貼上 6 欄 CSV。',
    };
  }

  const rows: CommeetWireExportRow[] = [];
  const lineNotes: string[] = [];
  let skippedInvalid = 0;

  for (const input of inputs) {
    const payeeName = String(input.payeeName ?? '').trim();
    const accountDigits = accountDigitsPreserve(input.accountNo);
    if (!payeeName || !accountDigits) {
      skippedInvalid++;
      continue;
    }
    try {
      const amount14 = parseAmountToAmount14(input.amount);
      const { bank3, branch4, bank7 } = parseBankAndBranch(
        input.bankCode,
        input.branchCode
      );
      rows.push({
        formNo: String(input.formNo ?? '').trim(),
        payeeName,
        payeeTaxId: String(input.payeeTaxId ?? '').trim(),
        bankDigits: bank3,
        branchDigits4: branch4,
        branchCellRaw: input.branchCode,
        bankNameLabel: '',
        receivingBankDisplay: bank7,
        accountDigits,
        amount14,
        payeeBank3: bank3,
        payeeBankCode7: bank7,
      });
      lineNotes.push(String(input.lineNote ?? '').trim());
    } catch {
      skippedInvalid++;
    }
  }

  if (rows.length === 0) {
    return {
      ok: false,
      error: `無有效匯款列（略過 ${skippedInvalid} 筆欄位或金額錯誤）`,
    };
  }

  return {
    ok: true,
    data: {
      rows,
      lineNotes,
      skippedInvalid,
      totalInputRows: inputs.length,
    },
  };
}

export function parseAdhocWireInputs(
  inputs: AdhocWireInputRow[]
): { ok: true; data: AdhocWireExtractResult } | { ok: false; error: string } {
  return adhocInputRowsToWireExtract(inputs);
}

/** 若僅有 bank3，可再依 branch 重算七碼（供決議後更新） */
export function recomputePayeeBankCode7(
  bankDigits: string,
  branchRaw?: unknown
): string {
  return formatReceivingBankCode7(bankDigits, branchRaw);
}

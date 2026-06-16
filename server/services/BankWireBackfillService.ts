import { normalizePayeeAccountDigits } from '../../utils/bankConvertPayeeResolve';
import { fetchPayeeAccountById } from '../utils/payeeFuseIndex';
import { analyzeWireRowAgainstPayeeMaster } from './PayeeAccountLookupService';
import type { CommeetWireExportRow } from '../../utils/commeetBankExcelParse';
import type { BankWireLedgerRow } from './BankWireExportLogService';

export type BankWireBackfillInputRow = {
  payeeName: string;
  payeeAccountDigits: string;
  /** 金額（分）；與 amountYuan 二擇一 */
  amountCents?: number;
  /** 金額（元，可含小數） */
  amountYuan?: number | string;
  formNo?: string;
  lineNote?: string;
  mergedLineIndex?: number;
  payeeAccountId?: number | string;
  bankCodeDigits?: string;
  branchCode?: string;
  payeeBankCode7?: string;
};

function hasExplicitBankRouting(row: BankWireBackfillInputRow): boolean {
  return (
    (row.payeeBankCode7 != null && String(row.payeeBankCode7).trim() !== '') ||
    (row.branchCode != null && String(row.branchCode).trim() !== '') ||
    (row.bankCodeDigits != null && String(row.bankCodeDigits).trim() !== '')
  );
}

type PayeeMasterRow = {
  id: string | number;
  name: string;
  bank_code: string;
  branch_code: string;
  account_no: string;
};

/** 比對 Payee_Accounts：預設補 id／戶名；銀行／分行僅在未明確指定時才覆寫 */
function mergePayeeMasterMatch(
  base: BankWireBackfillInputRow,
  master: PayeeMasterRow
): BankWireBackfillInputRow {
  const keepRouting = hasExplicitBankRouting(base);
  return {
    ...base,
    payeeAccountId: parseInt(String(master.id), 10),
    payeeName: base.payeeName?.trim() || master.name,
    payeeAccountDigits: master.account_no || base.payeeAccountDigits,
    ...(keepRouting
      ? {}
      : {
          bankCodeDigits: master.bank_code || base.bankCodeDigits,
          branchCode: master.branch_code || base.branchCode,
        }),
  };
}

function parseAmountCents(row: BankWireBackfillInputRow): number {
  if (row.amountCents != null && Number.isFinite(row.amountCents)) {
    const n = Math.round(row.amountCents);
    if (n < 0) throw new Error('金額不可為負');
    return n;
  }
  if (row.amountYuan != null && String(row.amountYuan).trim() !== '') {
    const s = String(row.amountYuan).trim().replace(/,/g, '');
    const yuan = Number(s);
    if (!Number.isFinite(yuan) || yuan < 0) {
      throw new Error(`無法解析金額：${row.amountYuan}`);
    }
    return Math.round(yuan * 100);
  }
  throw new Error('須提供 amountCents 或 amountYuan');
}

function wireRowFromBackfillInput(
  row: BankWireBackfillInputRow,
  rowIndex: number
): CommeetWireExportRow {
  const bankDigits = String(row.bankCodeDigits ?? '')
    .replace(/\D/g, '')
    .padStart(3, '0')
    .slice(-3);
  const branchDigits4 = String(row.branchCode ?? '0000')
    .replace(/\D/g, '')
    .padStart(4, '0')
    .slice(-4);
  const accountDigits = normalizePayeeAccountDigits(row.payeeAccountDigits);
  const payeeBankCode7 =
    row.payeeBankCode7 != null && String(row.payeeBankCode7).trim() !== ''
      ? String(row.payeeBankCode7).replace(/\D/g, '').padStart(7, '0').slice(0, 7)
      : (bankDigits + branchDigits4).slice(0, 7);
  const amountCents = parseAmountCents(row);
  return {
    formNo: String(row.formNo ?? '').trim(),
    payeeName: String(row.payeeName).trim(),
    payeeTaxId: '',
    bankDigits,
    branchDigits4,
    branchCellRaw: row.branchCode,
    bankNameLabel: '',
    receivingBankDisplay: payeeBankCode7,
    accountDigits,
    amount14: String(amountCents).padStart(14, '0'),
    payeeBank3: bankDigits,
    payeeBankCode7,
  };
}

async function enrichFromPayeeAccountId(
  base: BankWireBackfillInputRow,
  payeeAccountId: number
): Promise<BankWireBackfillInputRow> {
  const m = await fetchPayeeAccountById(String(payeeAccountId));
  if (!m) {
    throw new Error(`Payee_Accounts id ${payeeAccountId} 不存在`);
  }
  return mergePayeeMasterMatch({ ...base, payeeAccountId }, m);
}

/**
 * 事後登錄列：可帶 payeeAccountId 或依帳號查 Payee_Accounts 補齊分行
 */
export async function buildBackfillLedgerRows(
  inputs: BankWireBackfillInputRow[]
): Promise<BankWireLedgerRow[]> {
  if (!inputs.length) {
    throw new Error('至少須有一筆明細');
  }

  const out: BankWireLedgerRow[] = [];
  for (let i = 0; i < inputs.length; i++) {
    let row = inputs[i]!;
    const payeeName = String(row.payeeName ?? '').trim();
    const account = normalizePayeeAccountDigits(row.payeeAccountDigits ?? '');
    if (!payeeName) {
      throw new Error(`第 ${i + 1} 筆缺少收款人戶名`);
    }
    if (!account) {
      throw new Error(`第 ${i + 1} 筆缺少收款人帳號`);
    }

    if (row.payeeAccountId != null && String(row.payeeAccountId).trim() !== '') {
      row = await enrichFromPayeeAccountId(
        row,
        parseInt(String(row.payeeAccountId), 10)
      );
    } else {
      const wire = wireRowFromBackfillInput({ ...row, payeeAccountDigits: account }, i);
      const lookup = await analyzeWireRowAgainstPayeeMaster(i, wire);
      if (lookup.accountMatches.length === 1) {
        row = mergePayeeMasterMatch(row, lookup.accountMatches[0]!);
      }
    }

    const wire = wireRowFromBackfillInput(
      { ...row, payeeName, payeeAccountDigits: account },
      i
    );
    const amountCents = parseAmountCents(row);

    out.push({
      mergedLineIndex: row.mergedLineIndex ?? i + 1,
      payeeName: wire.payeeName,
      payeeAccountDigits: wire.accountDigits,
      bankCodeDigits: wire.bankDigits,
      branchCode: wire.branchDigits4,
      payeeBankCode7: wire.payeeBankCode7,
      payeeAccountId:
        row.payeeAccountId != null
          ? parseInt(String(row.payeeAccountId), 10)
          : null,
      lineNote: row.lineNote?.trim() || null,
      formNo: String(row.formNo ?? '').trim(),
      amountCents,
    });
  }

  return out;
}

export function assertScheduledTxDateYmd(value: string): string {
  const s = String(value ?? '').trim();
  if (!/^\d{8}$/.test(s)) {
    throw new Error('scheduledTxDateYmd 須為 YYYYMMDD');
  }
  return s;
}

export function parseOptionalExportedAt(value: unknown): Date | undefined {
  if (value == null || value === '') return undefined;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    throw new Error('exportedAt 無法解析為日期時間');
  }
  return d;
}

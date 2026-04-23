import { validateBranchForWireRow } from '../../utils/bankConvertPayeeValidation';
import type { CommeetWireExportRow } from '../../utils/commeetBankExcelParse';
import type { PayeeFuseRecord } from '../utils/payeeFuseIndex';
import { analyzeWireRowAgainstPayeeMaster } from './PayeeAccountLookupService';

export type BankWirePayeeLookupStatus =
  | 'branch_invalid'
  | 'excel_only'
  /** 清單無此帳號，僅有戶名模糊候選（參考用） */
  | 'name_hint_only'
  | 'suggest_master'
  | 'confirm_master'
  | 'choose_master';

export type BankWireAnalyzeRowDto = {
  rowIndex: number;
  formNo: string;
  validationError: string | null;
  lookupStatus: BankWirePayeeLookupStatus;
  /** Payee_Accounts 依帳號（及必要時銀行）命中筆數；0 表示僅戶名模糊候選 */
  accountMatchCount: number;
  excel: {
    payeeName: string;
    bankDigits: string;
    accountDigits: string;
    branchDigits4: string;
    receivingBankDisplay: string;
    payeeBankCode7: string;
  };
  suggestedMaster: PayeeFuseRecord | null;
  candidates: PayeeFuseRecord[];
  excelVsMasterMismatch: boolean;
};

function dedupeById(records: PayeeFuseRecord[]): PayeeFuseRecord[] {
  const seen = new Set<string>();
  const out: PayeeFuseRecord[] = [];
  for (const r of records) {
    const id = String(r.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  return out;
}

export async function analyzeCommeetWireRowsForPayeeMaster(
  rows: CommeetWireExportRow[]
): Promise<BankWireAnalyzeRowDto[]> {
  const out: BankWireAnalyzeRowDto[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const v = validateBranchForWireRow(row.bankDigits, row.branchCellRaw);
    const lookup = await analyzeWireRowAgainstPayeeMaster(i, row);

    const accountMatches = lookup.accountMatches;
    const extraName = lookup.nameCandidates.filter(
      (nc) => !accountMatches.some((am) => String(am.id) === String(nc.id))
    );
    const candidates = dedupeById([...accountMatches, ...extraName]);

    let lookupStatus: BankWirePayeeLookupStatus;
    let suggestedMaster: PayeeFuseRecord | null = null;

    if (!v.ok) {
      lookupStatus = 'branch_invalid';
      suggestedMaster =
        accountMatches.length === 1 ? accountMatches[0]! : null;
    } else if (accountMatches.length === 1) {
      suggestedMaster = accountMatches[0]!;
      lookupStatus = lookup.excelVsMasterMismatch
        ? 'confirm_master'
        : 'suggest_master';
    } else if (accountMatches.length > 1) {
      lookupStatus = 'choose_master';
    } else if (extraName.length > 0) {
      // 帳號未命中但戶名有模糊候選：僅供參考，避免誤導使用者「必須挑清單列」
      lookupStatus = 'name_hint_only';
    } else {
      lookupStatus = 'excel_only';
    }

    out.push({
      rowIndex: i,
      formNo: row.formNo,
      validationError: v.ok ? null : v.message,
      lookupStatus,
      accountMatchCount: accountMatches.length,
      excel: {
        payeeName: row.payeeName,
        bankDigits: row.bankDigits,
        accountDigits: row.accountDigits,
        branchDigits4: row.branchDigits4,
        receivingBankDisplay: row.receivingBankDisplay,
        payeeBankCode7: row.payeeBankCode7,
      },
      suggestedMaster,
      candidates,
      excelVsMasterMismatch: lookup.excelVsMasterMismatch,
    });
  }

  return out;
}

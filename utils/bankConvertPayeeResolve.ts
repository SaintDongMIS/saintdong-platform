import {
  buildReceivingBankDisplay,
  type CommeetWireExportRow,
} from './commeetBankExcelParse';
import { validateBranchForWireRow } from './bankConvertPayeeValidation';

export function normalizePayeeAccountDigits(s: string): string {
  return String(s).replace(/\D/g, '');
}

export interface PayeeAccountMasterFields {
  id: string;
  name: string;
  bank_code: string;
  branch_code: string;
  account_no: string;
}

export function applyPayeeMasterFieldsToWireRow(
  row: CommeetWireExportRow,
  master: PayeeAccountMasterFields
): CommeetWireExportRow {
  const bankDigits = normalizePayeeAccountDigits(String(master.bank_code))
    .padStart(3, '0')
    .slice(-3);
  const branchDigits4 = normalizePayeeAccountDigits(String(master.branch_code))
    .padStart(4, '0')
    .slice(-4);
  const accountDigits = normalizePayeeAccountDigits(String(master.account_no));
  const payeeBank3 = bankDigits;
  const payeeBankCode7 = (payeeBank3 + branchDigits4).slice(0, 7);
  return {
    ...row,
    payeeName: String(master.name).trim(),
    bankDigits,
    branchDigits4,
    branchCellRaw: branchDigits4,
    payeeBank3,
    payeeBankCode7,
    accountDigits,
    receivingBankDisplay: buildReceivingBankDisplay(
      bankDigits,
      branchDigits4,
      row.bankNameLabel
    ),
  };
}

/** 依目前 branchCellRaw／bankDigits 套用分行規則並更新七碼與顯示文字 */
export function finalizeExcelWireRow(row: CommeetWireExportRow): CommeetWireExportRow {
  const v = validateBranchForWireRow(row.bankDigits, row.branchCellRaw);
  if (!v.ok) {
    throw new Error(v.message);
  }
  const payeeBank3 = row.bankDigits.padStart(3, '0').slice(-3);
  const payeeBankCode7 = (payeeBank3 + v.branchDigits4).slice(0, 7);
  return {
    ...row,
    branchDigits4: v.branchDigits4,
    branchCellRaw: v.branchDigits4,
    payeeBank3,
    payeeBankCode7,
    receivingBankDisplay: buildReceivingBankDisplay(
      row.bankDigits,
      v.branchDigits4,
      row.bankNameLabel
    ),
  };
}

export function applyManualBranchToWireRow(
  row: CommeetWireExportRow,
  branchDigits4: string
): CommeetWireExportRow {
  const b4 = normalizePayeeAccountDigits(branchDigits4)
    .padStart(4, '0')
    .slice(-4);
  const payeeBank3 = row.bankDigits.padStart(3, '0').slice(-3);
  const payeeBankCode7 = (payeeBank3 + b4).slice(0, 7);
  return {
    ...row,
    branchDigits4: b4,
    branchCellRaw: b4,
    payeeBank3,
    payeeBankCode7,
    receivingBankDisplay: buildReceivingBankDisplay(
      row.bankDigits,
      b4,
      row.bankNameLabel
    ),
  };
}

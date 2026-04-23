import { accountDigitsPreserve, cellString } from './commeetBankExcelParse';

/** 國泰銀行（網銀轉檔規則：分行可不檢核） */
export const CATHAY_BANK_CODE_3 = '013';

export function isCathayBank(bankDigits: string): boolean {
  return bankDigits.padStart(3, '0').slice(-3) === CATHAY_BANK_CODE_3;
}

/**
 * 非國泰：分行必填；僅能為 1、2、4 位數字（純三位數不允許）；1～2 位左補 0。
 * 國泰：分行可空白，視為 0000；有填則正規化為四位。
 */
export function validateBranchForWireRow(
  bankDigits: string,
  branchCellRaw: unknown
): { ok: true; branchDigits4: string } | { ok: false; message: string } {
  const bank3 = bankDigits.padStart(3, '0').slice(-3);
  if (bank3 === CATHAY_BANK_CODE_3) {
    if (branchCellRaw == null || branchCellRaw === '' || cellString(branchCellRaw) === '') {
      return { ok: true, branchDigits4: '0000' };
    }
    const digits = accountDigitsPreserve(branchCellRaw);
    if (!digits) {
      return { ok: true, branchDigits4: '0000' };
    }
    const branch4 = digits.padStart(4, '0').slice(-4);
    return { ok: true, branchDigits4: branch4 };
  }

  if (
    branchCellRaw == null ||
    branchCellRaw === '' ||
    cellString(branchCellRaw) === ''
  ) {
    return {
      ok: false,
      message: '非國泰銀行須填寫分行代碼（四位數字，可含前導零）',
    };
  }

  const digits = accountDigitsPreserve(branchCellRaw);
  if (!digits) {
    return { ok: false, message: '分行代碼須為數字' };
  }
  if (digits.length === 3) {
    return {
      ok: false,
      message: '分行不可為三位數，請改為四位（例如 0624）',
    };
  }
  if (digits.length > 4) {
    return { ok: false, message: '分行代碼最多四位數' };
  }

  const branch4 = digits.padStart(4, '0');
  return { ok: true, branchDigits4: branch4 };
}

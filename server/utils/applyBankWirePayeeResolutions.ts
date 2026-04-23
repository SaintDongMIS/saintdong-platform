import type { CommeetWireExportRow } from '../../utils/commeetBankExcelParse';
import {
  applyManualBranchToWireRow,
  applyPayeeMasterFieldsToWireRow,
  finalizeExcelWireRow,
} from '../../utils/bankConvertPayeeResolve';
import { fetchPayeeAccountById } from './payeeFuseIndex';

export type BankWirePayeeResolutionInput = {
  rowIndex: number;
  kind: 'excel' | 'master';
  payeeAccountId?: string;
  manualBranch4?: string;
};

export async function applyPayeeResolutionsToWireRows(
  rows: CommeetWireExportRow[],
  resolutions: BankWirePayeeResolutionInput[]
): Promise<CommeetWireExportRow[]> {
  const byIdx = new Map<number, BankWirePayeeResolutionInput>();
  for (const r of resolutions) {
    byIdx.set(r.rowIndex, r);
  }

  const next: CommeetWireExportRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const res = byIdx.get(i);
    if (!res) {
      throw new Error(`缺少第 ${i + 1} 筆匯款（rowIndex ${i}）之決議`);
    }
    if (res.rowIndex !== i) {
      throw new Error(`決議 rowIndex 與列序不一致：預期 ${i}，實際 ${res.rowIndex}`);
    }

    if (res.kind === 'master') {
      if (!res.payeeAccountId) {
        throw new Error(`第 ${i + 1} 筆選擇清單帳號時須帶 payeeAccountId`);
      }
      const m = await fetchPayeeAccountById(String(res.payeeAccountId));
      if (!m) {
        throw new Error(`收款帳號清單 id ${res.payeeAccountId} 不存在`);
      }
      next.push(applyPayeeMasterFieldsToWireRow(row, m));
      continue;
    }

    let r = row;
    if (res.manualBranch4 != null && String(res.manualBranch4).trim() !== '') {
      r = applyManualBranchToWireRow(r, res.manualBranch4);
    }
    next.push(finalizeExcelWireRow(r));
  }

  return next;
}

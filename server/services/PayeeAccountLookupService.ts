import sql from 'mssql';
import { getConnectionPool } from '../config/database';
import {
  getPayeeFuse,
  type PayeeFuseRecord,
} from '../utils/payeeFuseIndex';
import { normalizePayeeAccountDigits } from '../../utils/bankConvertPayeeResolve';
import type { CommeetWireExportRow } from '../../utils/commeetBankExcelParse';

const PAYEE_TABLE = 'Payee_Accounts';

/** 戶名模糊建議：僅保留 Fuse score 低於此值者（越低越相近，0 為最佳） */
const MAX_PAYEE_FUSE_SCORE_FOR_HINT = 0.32;

function masterFromRecord(r: PayeeFuseRecord): PayeeFuseRecord {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    bank_code: String(r.bank_code ?? '').trim(),
    branch_code: String(r.branch_code ?? '').trim(),
    account_no: String(r.account_no ?? '').trim(),
  };
}

async function selectByNormalizedAccount(
  norm: string
): Promise<PayeeFuseRecord[]> {
  if (!norm) return [];
  const pool = await getConnectionPool();
  const result = await pool
    .request()
    .input('norm', sql.NVarChar(64), norm)
    .query<PayeeFuseRecord>(`
      SELECT CAST(id AS NVARCHAR(32)) AS id,
             name,
             bank_code,
             branch_code,
             account_no
      FROM dbo.[${PAYEE_TABLE}]
      WHERE REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(account_no)), N' ', N''), N'-', N''), N'－', N'') = @norm
    `);
  return result.recordset.map(masterFromRecord);
}

async function selectByAccountAndBank(
  norm: string,
  bank3: string
): Promise<PayeeFuseRecord[]> {
  if (!norm || !bank3) return [];
  const pool = await getConnectionPool();
  const result = await pool
    .request()
    .input('norm', sql.NVarChar(64), norm)
    .input('bank3', sql.Char(3), bank3)
    .query<PayeeFuseRecord>(`
      SELECT CAST(id AS NVARCHAR(32)) AS id,
             name,
             bank_code,
             branch_code,
             account_no
      FROM dbo.[${PAYEE_TABLE}]
      WHERE REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(account_no)), N' ', N''), N'-', N''), N'－', N'') = @norm
        AND RTRIM(bank_code) = @bank3
    `);
  return result.recordset.map(masterFromRecord);
}

function payeeBankCode7FromMaster(m: PayeeFuseRecord): string {
  const b3 = normalizePayeeAccountDigits(m.bank_code).padStart(3, '0').slice(-3);
  const br4 = normalizePayeeAccountDigits(m.branch_code)
    .padStart(4, '0')
    .slice(-4);
  return (b3 + br4).slice(0, 7);
}

export type WireRowLookupAnalysis = {
  rowIndex: number;
  /** 帳號+銀行主檔命中列（0 或 1 筆時供自動帶入） */
  accountMatches: PayeeFuseRecord[];
  /** 戶名模糊候選（最多 8 筆） */
  nameCandidates: PayeeFuseRecord[];
  excelPayeeBankCode7: string;
  /** 主檔唯一命中且與 Excel 七碼不同 */
  excelVsMasterMismatch: boolean;
};

export async function analyzeWireRowAgainstPayeeMaster(
  rowIndex: number,
  row: CommeetWireExportRow
): Promise<WireRowLookupAnalysis> {
  const norm = normalizePayeeAccountDigits(row.accountDigits);
  let matches = await selectByNormalizedAccount(norm);
  if (matches.length !== 1) {
    const bank3 = row.bankDigits.padStart(3, '0').slice(-3);
    const narrowed = await selectByAccountAndBank(norm, bank3);
    if (narrowed.length > 0) {
      matches = narrowed;
    }
  }

  const fuse = await getPayeeFuse();
  const fuseHits = fuse.search(row.payeeName.trim(), { limit: 16 });
  const nameCandidates = fuseHits
    .filter((h) => (h.score ?? 1) <= MAX_PAYEE_FUSE_SCORE_FOR_HINT)
    .slice(0, 8)
    .map((h) => masterFromRecord(h.item));

  const excel7 = row.payeeBankCode7.replace(/\D/g, '').padStart(7, '0').slice(0, 7);
  let excelVsMasterMismatch = false;
  if (matches.length === 1) {
    const m7 = payeeBankCode7FromMaster(matches[0]!);
    if (m7 !== excel7) {
      excelVsMasterMismatch = true;
    }
  }

  return {
    rowIndex,
    accountMatches: matches,
    nameCandidates,
    excelPayeeBankCode7: excel7,
    excelVsMasterMismatch,
  };
}

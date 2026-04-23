import Fuse from 'fuse.js';
import sql from 'mssql';
import { getConnectionPool } from '../config/database';

const TTL_MS = 6 * 60 * 60 * 1000;

export type PayeeFuseRecord = {
  id: string;
  name: string;
  bank_code: string;
  branch_code: string;
  account_no: string;
};

let fuse: Fuse<PayeeFuseRecord> | null = null;
let builtAt: number | null = null;

const PAYEE_TABLE = 'Payee_Accounts';

export async function getPayeeFuse(): Promise<Fuse<PayeeFuseRecord>> {
  const isExpired = !builtAt || Date.now() - builtAt > TTL_MS;
  if (fuse && !isExpired) return fuse;

  const pool = await getConnectionPool();
  const result = await pool.request().query<PayeeFuseRecord>(`
    SELECT CAST(id AS NVARCHAR(32)) AS id,
           name,
           bank_code,
           branch_code,
           account_no
    FROM dbo.[${PAYEE_TABLE}]
  `);

  const list = result.recordset.map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ''),
    bank_code: String(r.bank_code ?? '').trim(),
    branch_code: String(r.branch_code ?? '').trim(),
    account_no: String(r.account_no ?? '').trim(),
  }));

  fuse = new Fuse(list, {
    keys: ['name'],
    threshold: 0.38,
    includeScore: true,
    minMatchCharLength: 2,
  });
  builtAt = Date.now();
  return fuse;
}

export function resetPayeeFuse(): void {
  fuse = null;
  builtAt = null;
}

export async function fetchPayeeAccountById(
  id: string
): Promise<PayeeFuseRecord | null> {
  const pool = await getConnectionPool();
  const result = await pool
    .request()
    .input('id', sql.BigInt, id)
    .query<PayeeFuseRecord>(`
      SELECT CAST(id AS NVARCHAR(32)) AS id,
             name,
             bank_code,
             branch_code,
             account_no
      FROM dbo.[${PAYEE_TABLE}]
      WHERE id = @id
    `);
  const row = result.recordset[0];
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    bank_code: String(row.bank_code ?? '').trim(),
    branch_code: String(row.branch_code ?? '').trim(),
    account_no: String(row.account_no ?? '').trim(),
  };
}

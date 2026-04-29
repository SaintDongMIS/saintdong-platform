import type { Knex } from 'knex';

/**
 * 擴充 ExpendForm 欄位長度 — 付款銀行戶名
 *
 * 背景：
 * COMMEET 同步/財務上傳時，[付款銀行戶名] 可能包含較長的銀行資訊字串，
 * 例如 SWIFT BIC 等完整資訊，原本 NVARCHAR(50) 容易觸發
 * SQL Server「String or binary data would be truncated」錯誤。
 */
export async function up(knex: Knex): Promise<void> {
  const tableName = 'ExpendForm';
  const columnName = '付款銀行戶名';
  const targetLen = 500;

  const tableExists = await knex.schema.hasTable(tableName);
  if (!tableExists) return;

  const col = await knex('INFORMATION_SCHEMA.COLUMNS')
    .select('DATA_TYPE as dataType', 'CHARACTER_MAXIMUM_LENGTH as maxLen')
    .where({ TABLE_NAME: tableName, COLUMN_NAME: columnName })
    .first();

  // 找不到欄位就略過（避免不同環境 schema 不一致）
  if (!col) return;

  // 只要長度小於目標就升級（若已是 NVARCHAR(MAX) 或 >= 500 則略過）
  const isNVarChar = String(col.dataType).toLowerCase() === 'nvarchar';
  const maxLen = Number(col.maxLen);
  const isMax = maxLen === -1;
  const isAlreadyEnough =
    isMax || (Number.isFinite(maxLen) && maxLen >= targetLen);
  if (isNVarChar && isAlreadyEnough) return;

  await knex.raw(
    `ALTER TABLE [dbo].[${tableName}] ALTER COLUMN [${columnName}] NVARCHAR(${targetLen}) NULL;`,
  );
}

export async function down(knex: Knex): Promise<void> {
  const tableName = 'ExpendForm';
  const columnName = '付款銀行戶名';

  const tableExists = await knex.schema.hasTable(tableName);
  if (!tableExists) return;

  const col = await knex('INFORMATION_SCHEMA.COLUMNS')
    .select('DATA_TYPE as dataType', 'CHARACTER_MAXIMUM_LENGTH as maxLen')
    .where({ TABLE_NAME: tableName, COLUMN_NAME: columnName })
    .first();

  if (!col) return;

  const isNVarChar = String(col.dataType).toLowerCase() === 'nvarchar';
  const maxLen = Number(col.maxLen);
  const isMax = maxLen === -1;
  const isTargetLen = Number.isFinite(maxLen) && maxLen === 500;
  if (!isNVarChar || (!isMax && !isTargetLen)) return;

  // 回滾可能造成截斷；僅在需要時手動執行。
  await knex.raw(
    `ALTER TABLE [dbo].[${tableName}] ALTER COLUMN [${columnName}] NVARCHAR(50) NULL;`,
  );
}

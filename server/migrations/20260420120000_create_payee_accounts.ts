import type { Knex } from 'knex';

const TABLE = 'Payee_Accounts';

/**
 * 收款人帳號主檔（銀行代碼 + 分行代碼 + 帳號 + 戶名）
 * 若表已存在則跳過，不影響既有資料。
 */
export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable(TABLE);
  if (exists) return;

  await knex.raw(`
    CREATE TABLE [dbo].[${TABLE}] (
      [id] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      [name] NVARCHAR(200) NOT NULL,
      [bank_code] CHAR(3) NOT NULL,
      [branch_code] CHAR(4) NOT NULL,
      [account_no] NVARCHAR(32) NOT NULL,
      [created_at] DATETIME2(3) NOT NULL CONSTRAINT DF_${TABLE}_created_at DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX [IX_${TABLE}_bank_account] ON [dbo].[${TABLE}]([bank_code], [branch_code], [account_no]);
    CREATE INDEX [IX_${TABLE}_name] ON [dbo].[${TABLE}]([name]);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}

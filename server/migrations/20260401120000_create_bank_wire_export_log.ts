import type { Knex } from 'knex';

const TABLE = 'bank_wire_export_log';

/**
 * 國泰整批轉檔匯出紀錄（單表：一列＝一張表單明細，同一 batch_id 為同一次下載）
 */
export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable(TABLE);
  if (exists) return;

  await knex.raw(`
    CREATE TABLE [dbo].[${TABLE}] (
      [id] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      [batch_id] NVARCHAR(64) NOT NULL,
      [exported_at] DATETIME2(3) NOT NULL CONSTRAINT DF_${TABLE}_exported_at DEFAULT SYSUTCDATETIME(),
      [source_filename] NVARCHAR(500) NOT NULL,
      [merged_line_index] INT NOT NULL,
      [payee_name] NVARCHAR(200) NOT NULL,
      [payee_account_digits] NVARCHAR(32) NULL,
      [bank_code_digits] NVARCHAR(16) NULL,
      [form_no] NVARCHAR(64) NOT NULL,
      [amount_cents] BIGINT NOT NULL
    );
    CREATE INDEX [IX_${TABLE}_batch] ON [dbo].[${TABLE}]([batch_id]);
    CREATE INDEX [IX_${TABLE}_form] ON [dbo].[${TABLE}]([form_no]);
    CREATE INDEX [IX_${TABLE}_exported] ON [dbo].[${TABLE}]([exported_at] DESC);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}

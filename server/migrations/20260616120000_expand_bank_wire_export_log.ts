import type { Knex } from 'knex';

const TABLE = 'BankWireExport_Log';

/**
 * 擴充國泰整批匯出紀錄：分行／七碼／清單 id／交易日／批次類型／事由／事後登錄標記
 */
export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable(TABLE);
  if (!exists) return;

  async function hasColumn(name: string): Promise<boolean> {
    const row = await knex('INFORMATION_SCHEMA.COLUMNS')
      .select('COLUMN_NAME')
      .where({ TABLE_NAME: TABLE, COLUMN_NAME: name })
      .first();
    return !!row;
  }

  if (!(await hasColumn('branch_code'))) {
    await knex.raw(
      `ALTER TABLE [dbo].[${TABLE}] ADD [branch_code] CHAR(4) NULL`
    );
  }
  if (!(await hasColumn('payee_bank_code7'))) {
    await knex.raw(
      `ALTER TABLE [dbo].[${TABLE}] ADD [payee_bank_code7] CHAR(7) NULL`
    );
  }
  if (!(await hasColumn('payee_account_id'))) {
    await knex.raw(
      `ALTER TABLE [dbo].[${TABLE}] ADD [payee_account_id] BIGINT NULL`
    );
  }
  if (!(await hasColumn('scheduled_tx_date'))) {
    await knex.raw(
      `ALTER TABLE [dbo].[${TABLE}] ADD [scheduled_tx_date] CHAR(8) NULL`
    );
  }
  if (!(await hasColumn('batch_type'))) {
    await knex.raw(
      `ALTER TABLE [dbo].[${TABLE}] ADD [batch_type] NVARCHAR(32) NULL`
    );
  }
  if (!(await hasColumn('line_note'))) {
    await knex.raw(
      `ALTER TABLE [dbo].[${TABLE}] ADD [line_note] NVARCHAR(500) NULL`
    );
  }
  if (!(await hasColumn('already_uploaded'))) {
    await knex.raw(`
      ALTER TABLE [dbo].[${TABLE}] ADD [already_uploaded] BIT NOT NULL
        CONSTRAINT DF_${TABLE}_already_uploaded DEFAULT (0)
    `);
  }

  await knex.raw(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'IX_BankWireExport_Log_batch_type'
        AND object_id = OBJECT_ID(N'dbo.${TABLE}')
    )
    CREATE INDEX [IX_BankWireExport_Log_batch_type]
      ON [dbo].[${TABLE}]([batch_type]);
  `);

  await knex.raw(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'IX_BankWireExport_Log_payee_account'
        AND object_id = OBJECT_ID(N'dbo.${TABLE}')
    )
    CREATE INDEX [IX_BankWireExport_Log_payee_account]
      ON [dbo].[${TABLE}]([payee_account_id]);
  `);
}

export async function down(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable(TABLE);
  if (!exists) return;

  async function hasColumn(name: string): Promise<boolean> {
    const row = await knex('INFORMATION_SCHEMA.COLUMNS')
      .select('COLUMN_NAME')
      .where({ TABLE_NAME: TABLE, COLUMN_NAME: name })
      .first();
    return !!row;
  }

  await knex.raw(`
    IF EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'IX_BankWireExport_Log_payee_account'
        AND object_id = OBJECT_ID(N'dbo.${TABLE}')
    )
    DROP INDEX [IX_BankWireExport_Log_payee_account] ON [dbo].[${TABLE}];
  `);

  await knex.raw(`
    IF EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'IX_BankWireExport_Log_batch_type'
        AND object_id = OBJECT_ID(N'dbo.${TABLE}')
    )
    DROP INDEX [IX_BankWireExport_Log_batch_type] ON [dbo].[${TABLE}];
  `);

  if (await hasColumn('already_uploaded')) {
    await knex.raw(`
      DECLARE @df sysname;
      SELECT @df = dc.name
      FROM sys.default_constraints dc
      JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
      WHERE dc.parent_object_id = OBJECT_ID(N'dbo.${TABLE}')
        AND c.name = N'already_uploaded';
      IF @df IS NOT NULL EXEC(N'ALTER TABLE [dbo].[${TABLE}] DROP CONSTRAINT [' + @df + N']');
      ALTER TABLE [dbo].[${TABLE}] DROP COLUMN [already_uploaded];
    `);
  }

  for (const col of [
    'line_note',
    'batch_type',
    'scheduled_tx_date',
    'payee_account_id',
    'payee_bank_code7',
    'branch_code',
  ]) {
    if (await hasColumn(col)) {
      await knex.raw(
        `ALTER TABLE [dbo].[${TABLE}] DROP COLUMN [${col}]`
      );
    }
  }
}

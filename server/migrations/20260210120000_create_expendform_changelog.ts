import type { Knex } from 'knex';

const TABLE_NAME = 'ExpendForm_ChangeLog';

/**
 * Migration: 建立 ExpendForm_ChangeLog 變更記錄表
 *
 * 目的：記錄費用報銷單特定欄位的變更歷史（付款狀態、實際付款日期、表單狀態）
 * 若表已存在（例如曾透過 create-dev-table API 建立），則跳過建表，不影響既有資料。
 */
export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable(TABLE_NAME);
  if (tableExists) {
    console.log(`表 ${TABLE_NAME} 已存在，跳過建立`);
    return;
  }

  await knex.raw(`
    CREATE TABLE [dbo].[${TABLE_NAME}] (
      [LogId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      [EFid] INT NOT NULL,
      [FieldName] NVARCHAR(100) NOT NULL,
      [OldValue] NVARCHAR(MAX),
      [NewValue] NVARCHAR(MAX),
      [ChangedAt] DATETIME NOT NULL DEFAULT GETDATE(),
      [ChangedBy] NVARCHAR(50) NOT NULL,
      [ChangeType] NVARCHAR(20)
    )
  `);
  console.log(`表 ${TABLE_NAME} 建立完成`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME);
  console.log(`表 ${TABLE_NAME} 已刪除`);
}

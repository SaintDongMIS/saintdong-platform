import type { Knex } from 'knex';

/**
 * Migration: 備份並更新 ExpendForm
 *
 * 目的：
 * 1. 備份現有 ExpendForm 資料到 ExpendForm_jimbackup_0203
 * 2. 新增缺少的欄位（外部系統單號、里程數(公里)）
 * 3. 準備支援 COMMEET 自動化同步
 *
 * 注意：SQL Server 不支持直接調整欄位順序，
 * 只能新增欄位（新欄位會出現在表的最後）
 */

const TABLE_NAME = 'ExpendForm';
const BACKUP_TABLE_NAME = 'ExpendForm_backup_0203';

export async function up(knex: Knex): Promise<void> {
  // ============================================================
  // 步驟 1: 備份現有資料到 ExpendForm_backup_0203
  // ============================================================
  const backupExists = await knex.schema.hasTable(BACKUP_TABLE_NAME);

  if (backupExists) {
    // 備份表已存在，跳過
  } else {
    // 1.2 使用 SELECT INTO 備份整個表結構和資料
    await knex.raw(`
      SELECT * 
      INTO ${BACKUP_TABLE_NAME}
      FROM ${TABLE_NAME}
    `);

    await knex(BACKUP_TABLE_NAME).count('* as count').first();
  }

  // ============================================================
  // 步驟 2: 檢查並新增缺少的欄位
  // ============================================================
  const hasExternalSystemNo = await knex.schema.hasColumn(
    TABLE_NAME,
    '外部系統單號',
  );
  if (!hasExternalSystemNo) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      table.string('外部系統單號', 50).nullable();
    });
  }

  const hasMileage = await knex.schema.hasColumn(TABLE_NAME, '里程數(公里)');
  if (!hasMileage) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      table.string('里程數(公里)', 50).nullable();
    });
  }

  // 2.3 確保欄位長度正確（之前從 50 改為 500 的欄位）

  // 注意：SQL Server 需要使用 ALTER COLUMN 來修改欄位長度
  const fieldsToExtend = [
    { name: '費用項目', length: 500 },
    { name: '分攤參與部門', length: 500 },
    { name: '會計科目代號', length: 500 },
    { name: '會計科目', length: 500 },
  ];

  for (const field of fieldsToExtend) {
    try {
      await knex.raw(`
        ALTER TABLE ${TABLE_NAME}
        ALTER COLUMN [${field.name}] NVARCHAR(${field.length})
      `);
    } catch {
      // 欄位已是正確長度時會拋錯，忽略即可
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const backupExists = await knex.schema.hasTable(BACKUP_TABLE_NAME);
  if (!backupExists) {
    throw new Error(`備份表 ${BACKUP_TABLE_NAME} 不存在，無法回滾`);
  }

  await knex.schema.dropTableIfExists(TABLE_NAME);
  await knex.raw(`
    SELECT * 
    INTO ${TABLE_NAME}
    FROM ${BACKUP_TABLE_NAME}
  `);
}

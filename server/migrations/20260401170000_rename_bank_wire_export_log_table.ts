import type { Knex } from 'knex';

const OLD_TABLE = 'bank_wire_export_log';
const NEW_TABLE = 'BankWireExport_Log';

/**
 * Migration: rename bank_wire_export_log -> BankWireExport_Log
 *
 * 命名風格對齊 ExpendForm_ChangeLog（Camel + '_' + Camel）
 */
export async function up(knex: Knex): Promise<void> {
  const oldExists = await knex.schema.hasTable(OLD_TABLE);
  const newExists = await knex.schema.hasTable(NEW_TABLE);
  if (!oldExists || newExists) return;

  await knex.raw(`EXEC sp_rename 'dbo.${OLD_TABLE}', '${NEW_TABLE}'`);
}

export async function down(knex: Knex): Promise<void> {
  const oldExists = await knex.schema.hasTable(OLD_TABLE);
  const newExists = await knex.schema.hasTable(NEW_TABLE);
  if (oldExists || !newExists) return;

  await knex.raw(`EXEC sp_rename 'dbo.${NEW_TABLE}', '${OLD_TABLE}'`);
}


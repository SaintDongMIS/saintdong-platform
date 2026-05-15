import type { Knex } from 'knex';

/**
 * 移除「施工日報樞紐」相關資料表（依外鍵順序 drop）。
 * 不可逆：down 不還原表結構與資料。
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ConstructionRecordDetail');
  await knex.schema.dropTableIfExists('DailyConstructionRecord');
  await knex.schema.dropTableIfExists('ConstructionItemMaster');
}

export async function down(): Promise<void> {
  throw new Error(
    '20260515120000_drop_construction_pivot_tables: 不可逆；請勿 rollback。若需復原請重新執行 20260121165050 / 20260122043113 / 20260122043143 等 migration 並還原資料。'
  );
}

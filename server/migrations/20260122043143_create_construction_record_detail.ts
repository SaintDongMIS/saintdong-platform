import type { Knex } from 'knex';

const tableName = 'ConstructionRecordDetail';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(tableName, (table) => {
    // 主鍵
    table.increments('DetailId').primary();

    // 外鍵
    table
      .integer('RecordId')
      .notNullable()
      .comment('關聯到 DailyConstructionRecord');
    
    table
      .integer('ItemId')
      .notNullable()
      .comment('關聯到 ConstructionItemMaster');

    // 數量與金額
    table.decimal('Quantity', 18, 2).defaultTo(0).comment('數量');
    table.decimal('UnitPrice', 18, 2).notNullable().comment('單價快照（保留歷史單價）');
    table.decimal('Amount', 18, 2).defaultTo(0).comment('金額 = Quantity × UnitPrice');

    // 時間戳記
    table.datetime('CreatedAt').defaultTo(knex.fn.now());
    table.datetime('UpdatedAt').defaultTo(knex.fn.now());

    // 索引
    table.index('RecordId', 'IX_ConstructionRecordDetail_RecordId');
    table.index('ItemId', 'IX_ConstructionRecordDetail_ItemId');
    table.index(['RecordId', 'ItemId'], 'IX_ConstructionRecordDetail_RecordId_ItemId');

    // 外鍵約束
    table
      .foreign('RecordId')
      .references('DCRid')
      .inTable('DailyConstructionRecord')
      .onDelete('CASCADE');
    
    table
      .foreign('ItemId')
      .references('ItemId')
      .inTable('ConstructionItemMaster')
      .onDelete('NO ACTION'); // 不允許刪除有歷史記錄的項目
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(tableName);
}

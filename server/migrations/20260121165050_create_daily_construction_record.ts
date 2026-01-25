import type { Knex } from 'knex';

const tableName = 'DailyConstructionRecord';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(tableName, (table) => {
    // 主鍵
    table.increments('DCRid').primary();

    // 基本資訊
    table.string('單位', 50).notNullable().comment('工務所/一標/二標/四標/五標');
    table.date('日期').notNullable().comment('施工日期');

    // 各項目數量（16個項目）
    table.decimal('拖車租工_數量', 18, 2).defaultTo(0);
    table.decimal('台北市拖車運費_數量', 18, 2).defaultTo(0);
    table.decimal('台北市瀝青渣運費_數量', 18, 2).defaultTo(0);
    table.decimal('補運費拖車_數量', 18, 2).defaultTo(0);
    table.decimal('補單趟運費拖車_數量', 18, 2).defaultTo(0);
    table.decimal('補拖車移點運費_數量', 18, 2).defaultTo(0);
    table.decimal('板橋拖車運費_數量', 18, 2).defaultTo(0);
    table.decimal('瀝青渣_數量', 18, 2).defaultTo(0);
    table.decimal('瀝青渣超大塊_數量', 18, 2).defaultTo(0);
    table.decimal('瀝青渣廢土級配_數量', 18, 2).defaultTo(0);
    table.decimal('泡沫瀝青_數量', 18, 2).defaultTo(0);
    table.decimal('三分之八三瀝青混凝土_數量', 18, 2).defaultTo(0);
    table.decimal('三分之八四瀝青混凝土_數量', 18, 2).defaultTo(0);
    table.decimal('改質瀝青四F_數量', 18, 2).defaultTo(0);
    table.decimal('冷油大桶_數量', 18, 2).defaultTo(0);

    // 時間戳記
    table.datetime('建立時間').defaultTo(knex.fn.now());
    table.datetime('更新時間').defaultTo(knex.fn.now());

    // 索引
    table.index('日期', 'IX_DailyConstructionRecord_日期');
    table.index('單位', 'IX_DailyConstructionRecord_單位');
    table.index(['單位', '日期'], 'IX_DailyConstructionRecord_單位_日期');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(tableName);
}

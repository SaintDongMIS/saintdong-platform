import type { Knex } from 'knex';

const tableName = 'ConstructionItemMaster';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(tableName, (table) => {
    // 主鍵
    table.increments('ItemId').primary();

    // 項目資訊
    table.string('ItemName', 100).notNullable().comment('項目名稱');
    table.string('Unit', 20).notNullable().comment('單位（天、頓、台、小時、桶等）');
    table.decimal('Price', 18, 2).notNullable().comment('單價');
    
    // 管理欄位
    table.boolean('IsActive').defaultTo(true).comment('是否啟用');
    table.integer('DisplayOrder').defaultTo(0).comment('顯示順序');

    // 時間戳記
    table.datetime('CreatedAt').defaultTo(knex.fn.now());
    table.datetime('UpdatedAt').defaultTo(knex.fn.now());

    // 索引
    table.index('IsActive', 'IX_ConstructionItemMaster_IsActive');
    table.index('DisplayOrder', 'IX_ConstructionItemMaster_DisplayOrder');
  });

  // 插入現有的 15 個項目（從 constructionItems.ts 遷移過來）
  await knex(tableName).insert([
    { ItemName: '拖車租工', Unit: '天', Price: 12000, DisplayOrder: 1 },
    { ItemName: '台北市.拖車運費', Unit: '頓', Price: 180, DisplayOrder: 2 },
    { ItemName: '台北市.瀝青渣運費(拖)', Unit: '頓', Price: 180, DisplayOrder: 3 },
    { ItemName: '補運費(拖車)', Unit: '小時', Price: 1000, DisplayOrder: 4 },
    { ItemName: '補單趟運費(拖車)', Unit: '台', Price: 2000, DisplayOrder: 5 },
    { ItemName: '補拖車移點運費', Unit: '台', Price: 2000, DisplayOrder: 6 },
    { ItemName: '板橋.拖車運費', Unit: '頓', Price: 200, DisplayOrder: 7 },
    { ItemName: '瀝青渣', Unit: '頓', Price: 100, DisplayOrder: 8 },
    { ItemName: '瀝青渣(超大塊)', Unit: '頓', Price: 400, DisplayOrder: 9 },
    { ItemName: '瀝青渣(廢土.級配)', Unit: '頓', Price: 700, DisplayOrder: 10 },
    { ItemName: '泡沫瀝青', Unit: '頓', Price: 1350, DisplayOrder: 11 },
    { ItemName: '3/8(三)瀝青混凝土', Unit: '頓', Price: 2050, DisplayOrder: 12 },
    { ItemName: '3/8(四)瀝青混凝土', Unit: '頓', Price: 1950, DisplayOrder: 13 },
    { ItemName: '改質 瀝青四-F', Unit: '頓', Price: 2050, DisplayOrder: 14 },
    { ItemName: '冷油(大桶)', Unit: '桶', Price: 4950, DisplayOrder: 15 },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(tableName);
}

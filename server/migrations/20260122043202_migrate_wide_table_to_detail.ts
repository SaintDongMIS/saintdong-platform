import type { Knex } from 'knex';

/**
 * 此遷移腳本將 DailyConstructionRecord 的寬表資料轉換成主從表結構
 * 如果表中有資料，會將 15 個數量欄位拆成明細記錄
 */

// 項目欄位對應（與 constructionItems.ts 保持一致）
const ITEM_FIELD_MAPPING = [
  { field: '拖車租工_數量', itemName: '拖車租工' },
  { field: '台北市拖車運費_數量', itemName: '台北市.拖車運費' },
  { field: '台北市瀝青渣運費_數量', itemName: '台北市.瀝青渣運費(拖)' },
  { field: '補運費拖車_數量', itemName: '補運費(拖車)' },
  { field: '補單趟運費拖車_數量', itemName: '補單趟運費(拖車)' },
  { field: '補拖車移點運費_數量', itemName: '補拖車移點運費' },
  { field: '板橋拖車運費_數量', itemName: '板橋.拖車運費' },
  { field: '瀝青渣_數量', itemName: '瀝青渣' },
  { field: '瀝青渣超大塊_數量', itemName: '瀝青渣(超大塊)' },
  { field: '瀝青渣廢土級配_數量', itemName: '瀝青渣(廢土.級配)' },
  { field: '泡沫瀝青_數量', itemName: '泡沫瀝青' },
  { field: '三分之八三瀝青混凝土_數量', itemName: '3/8(三)瀝青混凝土' },
  { field: '三分之八四瀝青混凝土_數量', itemName: '3/8(四)瀝青混凝土' },
  { field: '改質瀝青四F_數量', itemName: '改質 瀝青四-F' },
  { field: '冷油大桶_數量', itemName: '冷油(大桶)' },
];

export async function up(knex: Knex): Promise<void> {
  // 檢查是否有資料需要遷移
  const records = await knex('DailyConstructionRecord').select('*');

  if (records.length === 0) {
    console.log('✓ DailyConstructionRecord 表為空，無需遷移資料');
    return;
  }

  console.log(`開始遷移 ${records.length} 筆記錄...`);

  // 取得所有項目主檔（用於查詢 ItemId 和單價）
  const items = await knex('ConstructionItemMaster')
    .select('ItemId', 'ItemName', 'Price')
    .where('IsActive', true);

  // 建立項目名稱 -> ItemId, Price 的對應表
  const itemMap = new Map(
    items.map((item) => [item.ItemName, { ItemId: item.ItemId, Price: item.Price }])
  );

  // 遷移每筆記錄
  for (const record of records) {
    const details: any[] = [];

    // 處理每個項目欄位
    for (const mapping of ITEM_FIELD_MAPPING) {
      const quantity = record[mapping.field];

      // 只有數量 > 0 才建立明細記錄
      if (quantity && quantity > 0) {
        const itemInfo = itemMap.get(mapping.itemName);

        if (itemInfo) {
          const amount = quantity * itemInfo.Price;

          details.push({
            RecordId: record.DCRid,
            ItemId: itemInfo.ItemId,
            Quantity: quantity,
            UnitPrice: itemInfo.Price, // 儲存當時的單價快照
            Amount: amount,
          });
        } else {
          console.warn(`⚠️  找不到項目: ${mapping.itemName}`);
        }
      }
    }

    // 批次插入明細
    if (details.length > 0) {
      await knex('ConstructionRecordDetail').insert(details);
    }
  }

  console.log(`✓ 成功遷移 ${records.length} 筆記錄`);
}

export async function down(knex: Knex): Promise<void> {
  // 回滾時清空明細表
  await knex('ConstructionRecordDetail').del();
  console.log('✓ 已清空 ConstructionRecordDetail 表');
}
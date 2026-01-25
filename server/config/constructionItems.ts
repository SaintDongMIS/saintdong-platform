/**
 * 施工項目配置
 * 定義各項目的名稱、單位、單價、資料庫欄位名稱
 */

export interface ConstructionItem {
  name: string; // 顯示名稱
  field: string; // 資料庫欄位名稱
  unit: string; // 單位
  price: number; // 單價
}

export const CONSTRUCTION_ITEMS: ConstructionItem[] = [
  {
    name: '拖車租工',
    field: '拖車租工_數量',
    unit: '天',
    price: 12000,
  },
  {
    name: '台北市.拖車運費',
    field: '台北市拖車運費_數量',
    unit: '頓',
    price: 180,
  },
  {
    name: '台北市.瀝青渣運費(拖)',
    field: '台北市瀝青渣運費_數量',
    unit: '頓',
    price: 180,
  },
  {
    name: '補運費(拖車)',
    field: '補運費拖車_數量',
    unit: '小時',
    price: 1000,
  },
  {
    name: '補單趟運費(拖車)',
    field: '補單趟運費拖車_數量',
    unit: '台',
    price: 2000,
  },
  {
    name: '補拖車移點運費',
    field: '補拖車移點運費_數量',
    unit: '台',
    price: 2000,
  },
  {
    name: '板橋.拖車運費',
    field: '板橋拖車運費_數量',
    unit: '頓',
    price: 200,
  },
  {
    name: '瀝青渣',
    field: '瀝青渣_數量',
    unit: '頓',
    price: 100,
  },
  {
    name: '瀝青渣(超大塊)',
    field: '瀝青渣超大塊_數量',
    unit: '頓',
    price: 400,
  },
  {
    name: '瀝青渣(廢土.級配)',
    field: '瀝青渣廢土級配_數量',
    unit: '頓',
    price: 700,
  },
  {
    name: '泡沫瀝青',
    field: '泡沫瀝青_數量',
    unit: '頓',
    price: 1350,
  },
  {
    name: '3/8(三)瀝青混凝土',
    field: '三分之八三瀝青混凝土_數量',
    unit: '頓',
    price: 2050,
  },
  {
    name: '3/8(四)瀝青混凝土',
    field: '三分之八四瀝青混凝土_數量',
    unit: '頓',
    price: 1950,
  },
  {
    name: '改質 瀝青四-F',
    field: '改質瀝青四F_數量',
    unit: '頓',
    price: 2050,
  },
  {
    name: '冷油(大桶)',
    field: '冷油大桶_數量',
    unit: '桶',
    price: 4950,
  },
];

// 單位列表
export const CONSTRUCTION_UNITS = ['工務所', '一標', '二標', '四標', '五標'] as const;

// 用於快速查找
export const CONSTRUCTION_ITEMS_MAP = CONSTRUCTION_ITEMS.reduce(
  (map, item) => {
    map[item.field] = item;
    return map;
  },
  {} as Record<string, ConstructionItem>
);

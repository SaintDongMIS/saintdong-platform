/**
 * 複合鍵配置常數
 * 
 * 用於統一管理複合鍵的生成和解析邏輯
 */

/**
 * 安全分隔符
 * 
 * 使用 ~~~ 作為分隔符的原因：
 * 1. 不會出現在業務資料中（表單編號、發票號碼、日期等都不含 ~~~）
 * 2. 肉眼可辨識（除錯時看得懂）
 * 3. 業界有類似做法（Redis、Kafka、Log 系統）
 */
export const COMPOSITE_KEY_SEPARATOR = '~~~';

/**
 * 費用報銷單複合鍵規格（單一來源：改鍵只改這裡）
 * 複合鍵組成：表單編號 + 發票號碼 + 交易日期 + 項目原幣金額 + 費用項目 + 分攤參與部門
 */
export const EXPEND_FORM_KEY_SPEC = [
  { name: '表單編號', type: 'string' as const },
  { name: '發票號碼', type: 'string' as const },
  { name: '交易日期', type: 'date' as const },
  { name: '項目原幣金額', type: 'decimal' as const },
  { name: '費用項目', type: 'string' as const },
  { name: '分攤參與部門', type: 'string' as const },
] as const;

/** 費用報銷單解析鍵型別（由 EXPEND_FORM_KEY_SPEC 衍生，改鍵只需改 spec） */
export type ExpendFormParsedKey = (typeof EXPEND_FORM_KEY_SPEC)[number]['name'];
export type ExpendFormParsed = Partial<Record<ExpendFormParsedKey, string>>;

/** 由 EXPEND_FORM_KEY_SPEC 衍生，供 COMPOSITE_KEY_CONFIG 使用 */
export const EXPEND_FORM_KEY_FIELD_ORDER: readonly string[] =
  EXPEND_FORM_KEY_SPEC.map((s) => s.name);

/** 相容用欄位物件（COMPOSITE_KEY_CONFIG.fields） */
export const EXPEND_FORM_KEY_FIELDS = {
  FORM_NUMBER: '表單編號',
  INVOICE_NUMBER: '發票號碼',
  TRANSACTION_DATE: '交易日期',
  ITEM_AMOUNT: '項目原幣金額',
  EXPENSE_ITEM: '費用項目',
  ALLOCATION_DEPT: '分攤參與部門',
} as const;

/**
 * 道路施工部複合鍵欄位定義
 */
export const ROAD_CONSTRUCTION_KEY_FIELDS = {
  WORK_ORDER_NUMBER: '派工單號',
  VENDOR_NAME: '廠商名稱',
  ITEM_NAME: '項目名稱',
  DATE: '日期',
} as const;

/**
 * 道路施工部複合鍵欄位順序
 */
export const ROAD_CONSTRUCTION_KEY_FIELD_ORDER = [
  ROAD_CONSTRUCTION_KEY_FIELDS.WORK_ORDER_NUMBER,
  ROAD_CONSTRUCTION_KEY_FIELDS.VENDOR_NAME,
  ROAD_CONSTRUCTION_KEY_FIELDS.ITEM_NAME,
  ROAD_CONSTRUCTION_KEY_FIELDS.DATE,
] as const;

/**
 * 複合鍵類型
 */
export type CompositeKeyType = 'ExpendForm' | 'RoadConstruction';

/**
 * 複合鍵配置
 */
export const COMPOSITE_KEY_CONFIG = {
  ExpendForm: {
    fields: EXPEND_FORM_KEY_FIELDS,
    fieldOrder: EXPEND_FORM_KEY_FIELD_ORDER,
    separator: COMPOSITE_KEY_SEPARATOR,
  },
  RoadConstruction: {
    fields: ROAD_CONSTRUCTION_KEY_FIELDS,
    fieldOrder: ROAD_CONSTRUCTION_KEY_FIELD_ORDER,
    separator: COMPOSITE_KEY_SEPARATOR,
  },
} as const;

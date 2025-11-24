/**
 * 此檔案為資料庫資料表的統一定義 (Single Source of Truth)。
 * 當需要修改資料表欄位時，請修改此處的 schema 字串。
 * create-table.post.ts 與 update-table.post.ts 都會引用此定義。
 */
export const reimbursementTableSchema = `
  [EFid] INT IDENTITY(1,1) PRIMARY KEY,
  [表單種類] NVARCHAR(50),
  [表單編號] NVARCHAR(50),
  [表單狀態] NVARCHAR(50),
  [申請人姓名] NVARCHAR(50),
  [申請人信箱] NVARCHAR(50),
  [申請人部門] NVARCHAR(50),
  [申請日期] DATE,
  [費用歸屬] NVARCHAR(50),
  [事由] NVARCHAR(500),
  [勾稽單號] NVARCHAR(50),
  [所屬預算] NVARCHAR(50),
  [簽核階段] NVARCHAR(50),
  [表單本幣總計] DECIMAL(18,2),
  [代墊本幣總計] DECIMAL(18,2),
  [卡片交易本幣總計] DECIMAL(18,2),
  [請款原因-表單下方選項] NVARCHAR(500),
  [付款期限] DATE,
  [付款狀態] NVARCHAR(50),
  [實際付款日期] DATE,
  [供應商/銀行/員工] NVARCHAR(50),
  [入帳對象代號] NVARCHAR(50),
  [入帳對象] NVARCHAR(50),
  [付款對象統編] NVARCHAR(50),
  [付款金額] DECIMAL(18,2),
  [付款方式] NVARCHAR(50),
  [供應商來源] NVARCHAR(50),
  [付款銀行戶名] NVARCHAR(50),
  [付款銀行代號] NVARCHAR(50),
  [付款銀行名稱] NVARCHAR(50),
  [付款對象帳戶號碼] NVARCHAR(50),
  [用車供應商] NVARCHAR(50),
  [乘車代碼] NVARCHAR(50),
  [用車時間] DATE,
  [上車地點] NVARCHAR(50),
  [下車地點] NVARCHAR(50),
  [拜訪對象公司] NVARCHAR(50),
  [拜訪對象統編] NVARCHAR(50),
  [同行同事] NVARCHAR(50),
  [費用項目] NVARCHAR(50),
  [代墊/卡片] NVARCHAR(50),
  [交易日期] DATE,
  [備註] NVARCHAR(500),
  [項目原幣幣別] NVARCHAR(50),
  [項目原幣金額] DECIMAL(18,2),
  [匯率] DECIMAL(18,6),
  [項目本幣幣別] NVARCHAR(50),
  [項目本幣金額] DECIMAL(18,2),
  [報銷狀態] NVARCHAR(50),
  [油資出發地] NVARCHAR(50),
  [油資目的地] NVARCHAR(50),
  [每一段的里程數] NVARCHAR(50),
  [總里程數] NVARCHAR(50),
  [分攤參與部門] NVARCHAR(50),
  [分攤金額] DECIMAL(18,2),
  [備註-費用項目選項] NVARCHAR(500),
  [憑證類別] NVARCHAR(50),
  [發票號碼] NVARCHAR(50),
  [發票日期] DATE,
  [稅額] DECIMAL(18,2),
  [發票未稅金額] DECIMAL(18,2),
  [發票含稅金額] DECIMAL(18,2),
  [買方統編] NVARCHAR(50),
  [賣方統編] NVARCHAR(50),
  [入帳狀態] NVARCHAR(50),
  [傳票編號] NVARCHAR(50),
  [傳票日期] DATE,
  [會計科目代號] NVARCHAR(50),
  [會計科目] NVARCHAR(50),
  [會計科目原幣金額] DECIMAL(18,2),
  [建立時間] DATETIME DEFAULT GETDATE(),
  [更新時間] DATETIME DEFAULT GETDATE()
`;

/**
 * 道路施工部資料表 Schema
 *
 * 資料來源：對帳工務所 Excel 樞紐表
 * 結構：派工單號 × 項目名稱 × 日期 → 數量
 *
 * 設計說明：
 * 1. 將 Excel 樞紐表（項目 × 日期）正規化為關聯式資料
 * 2. 每筆紀錄代表：某派工單號、某項目、某日期的數量
 * 3. 採用技術主鍵 + 業務複合唯一鍵設計
 *
 * 範例資料：
 * - 派工單號：11409004（從 Excel 讀取）
 * - 項目名稱：義交、熱鏟、油車、乳化瀝青等
 * - 日期：2024-08-01, 2024-08-02...（從「10/13/25」轉換為實際日期）
 * - 數量：37.5, 1, 2000, 468.19 等（支援整數和小數）
 */
export const roadConstructionTableSchema = `
  [RCid] INT IDENTITY(1,1) PRIMARY KEY,
  [派工單號] NVARCHAR(50) NOT NULL,
  [廠商名稱] NVARCHAR(100),
  [項目名稱] NVARCHAR(100) NOT NULL,
  [單位] NVARCHAR(50),
  [單價] DECIMAL(18, 2),
  [日期] DATE NOT NULL,
  [數量] DECIMAL(18,2) NOT NULL,
  [備註] NVARCHAR(500),
  [已更新] BIT DEFAULT 0,
  [建立時間] DATETIME DEFAULT GETDATE(),
  [更新時間] DATETIME DEFAULT GETDATE(),
  CONSTRAINT [IX_RoadConstruction_Unique] UNIQUE ([派工單號], [廠商名稱], [項目名稱], [日期])
`;

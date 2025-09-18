/**
 * 此檔案為資料庫資料表的統一定義 (Single Source of Truth)。
 * 當需要修改資料表欄位時，請修改此處的 schema 字串。
 * create-table.post.ts 與 update-table.post.ts 都會引用此定義。
 */
export const reimbursementTableSchema = `
  [表單編號] NVARCHAR(50) PRIMARY KEY,
  [表單種類] NVARCHAR(50),
  [申請人姓名] NVARCHAR(50),
  [申請日期] DATE,
  [費用歸屬] NVARCHAR(50),
  [事由] NVARCHAR(500),
  [實際付款日期] DATE,
  [交易日期] DATE,
  [供應商/銀行/員工] NVARCHAR(100),
  [付款對象統編] NVARCHAR(20),
  [入帳對象代號] NVARCHAR(20),
  [入帳對象] NVARCHAR(100),
  [備註] NVARCHAR(500),
  [發票號碼] NVARCHAR(50),
  [發票日期] DATE,
  [表單本幣總計] DECIMAL(18,2),
  [稅額] DECIMAL(18,2),
  [發票未稅金額] DECIMAL(18,2),
  [發票含稅金額] DECIMAL(18,2),
  [賣方統編] NVARCHAR(20),
  [會計科目代號] NVARCHAR(20),
  [會計科目] NVARCHAR(100),
  [付款銀行戶名] NVARCHAR(100),
  [付款銀行代號] NVARCHAR(20),
  [付款銀行名稱] NVARCHAR(100),
  [付款對象帳戶號碼] NVARCHAR(50),
  [建立時間] DATETIME DEFAULT GETDATE(),
  [更新時間] DATETIME DEFAULT GETDATE()
`;

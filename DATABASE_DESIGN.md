# 資料庫設計

## 主鍵設計策略

### 1. 技術主鍵 + 業務唯一鍵設計 (目前採用)

採用業界標準的「技術主鍵 + 業務唯一鍵」設計策略，確保資料完整性和系統穩定性。

```sql
CREATE TABLE ExpendForm (
  [EFid] INT IDENTITY(1,1) PRIMARY KEY,  -- 技術主鍵 (自動遞增)
  [表單編號] NVARCHAR(50),                -- 業務唯一鍵
  -- 其他欄位...
);
```

### 2. 為什麼選擇技術主鍵？

#### **優點**

- **資料完整性**: 技術主鍵永遠唯一且不可變，確保關聯資料的完整性。
- **效能最佳化**: 整數主鍵的查詢和關聯效能最佳，特別是在大量資料時。
- **系統穩定性**: 避免業務主鍵變更對系統造成的影響。
- **標準化設計**: 符合關聯式資料庫設計的最佳實務。
- **外鍵關聯**: 便於建立與其他資料表的關聯。

#### **業務唯一鍵的優勢**

- **業務邏輯**: `表單編號` 仍保持業務意義，可建立唯一索引確保業務唯一性。
- **查詢便利**: 可透過 `表單編號` 進行業務查詢。
- **API 設計**: RESTful API 仍可使用 `表單編號` 作為查詢參數。

### 3. 索引策略

#### **主鍵索引**

- `[EFid]` 作為主鍵，SQL Server 會自動建立 `PK_ExpendForm` 聚簇索引。

#### **業務唯一索引**

```sql
-- 為表單編號建立唯一索引，確保業務唯一性
CREATE UNIQUE INDEX IX_ExpendForm_表單編號 ON ExpendForm([表單編號]);
```

#### **查詢效能索引**

```sql
-- 常用查詢的效能索引
CREATE INDEX IX_ExpendForm_申請人 ON ExpendForm([申請人姓名]);
CREATE INDEX IX_ExpendForm_申請日期 ON ExpendForm([申請日期]);
CREATE INDEX IX_ExpendForm_費用歸屬 ON ExpendForm([費用歸屬]);
CREATE INDEX IX_ExpendForm_建立時間 ON ExpendForm([建立時間]);
```

### 4. 資料表命名規範

- **表名**: `ExpendForm` (英文命名，避免編碼問題)
- **主鍵**: `EFid` (ExpendForm ID)
- **索引**: `PK_ExpendForm` (主鍵索引)

## 結論

**目前採用技術主鍵 + 業務唯一鍵設計**：

- `[EFid]` (INT IDENTITY) 作為技術主鍵
- `[表單編號]` (NVARCHAR) 作為業務唯一鍵

此設計提供最佳的資料完整性、系統穩定性和查詢效能，符合企業級應用的要求。

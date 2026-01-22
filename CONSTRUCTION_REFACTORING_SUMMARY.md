# 施工日報系統重構總結 - 改用「項目主檔」架構

## 🎯 重構目標

將寬表架構改為「項目主檔 + 明細表」架構，讓使用者可以在 UI 上動態管理施工項目，無需工程師介入。

---

## 📊 架構變更對比

### 重構前（寬表）
```
DailyConstructionRecord
├─ DCRid (主鍵)
├─ 單位
├─ 日期
├─ 拖車租工_數量
├─ 台北市拖車運費_數量
├─ 瀝青渣_數量
└─ ... (15 個固定欄位)
```
❌ 問題：
- 新增項目需要 ALTER TABLE
- 需要工程師寫遷移腳本
- 項目數量固定

### 重構後（主從表）
```
ConstructionItemMaster (項目主檔)
├─ ItemId (主鍵)
├─ ItemName (項目名稱)
├─ Unit (單位)
├─ Price (單價)
├─ IsActive (是否啟用)
└─ DisplayOrder (顯示順序)

DailyConstructionRecord (每日記錄)
├─ DCRid (主鍵)
├─ 單位
└─ 日期

ConstructionRecordDetail (明細)
├─ DetailId (主鍵)
├─ RecordId (FK → DailyConstructionRecord)
├─ ItemId (FK → ConstructionItemMaster)
├─ Quantity (數量)
├─ UnitPrice (單價快照 🔑 保留歷史單價)
└─ Amount (金額)
```
✅ 優點：
- 新增項目無需 ALTER TABLE
- 使用者在 UI 上自行管理
- 項目數量無限制
- **保留歷史單價快照**

---

## 🔑 核心設計：歷史單價快照機制

### 為什麼要保留歷史單價？

**情境：**
```
2026年1月：拖車租工單價 12,000 元/天
→ 記錄：3 天 × 12,000 = 36,000

2026年2月：調漲單價為 15,000 元/天
```

**問題：1月的金額要顯示多少？**

### 解決方案：UnitPrice 欄位

在 `ConstructionRecordDetail` 表中，每筆明細都儲存「當時的單價」：

```sql
DetailId | RecordId | ItemId | Quantity | UnitPrice | Amount
---------|----------|--------|----------|-----------|--------
1        | 1        | 1      | 3        | 12000     | 36000  ← 1月記錄
2        | 2        | 1      | 2        | 15000     | 30000  ← 2月記錄
```

✅ 結果：
- 1月資料永遠顯示 36,000（使用 12,000 的快照）
- 2月資料顯示 30,000（使用 15,000 的新單價）
- **歷史金額不受單價調整影響**

---

## 📁 新增的檔案清單

### 後端（11 個文件）

#### 資料庫遷移
1. `server/migrations/20260122043113_create_construction_item_master.ts`
   - 建立項目主檔表
   - 插入 15 個初始項目

2. `server/migrations/20260122043143_create_construction_record_detail.ts`
   - 建立明細表
   - 外鍵關聯

3. `server/migrations/20260122043202_migrate_wide_table_to_detail.ts`
   - 將寬表資料轉換成主從表結構
   - 自動遷移現有資料

#### Service 層
4. `server/services/ConstructionItemService.ts`
   - 項目管理 Service（新增）
   - CRUD 操作 + 停用功能

5. `server/services/ConstructionRecordService.ts`
   - **完全重寫**，支援主從表架構
   - 保持向後兼容（API 介面不變）

#### API 端點
6. `server/api/construction/items.get.ts` - 取得項目清單
7. `server/api/construction/items.post.ts` - 新增項目
8. `server/api/construction/items/[id].put.ts` - 更新項目
9. `server/api/construction/items/[id].delete.ts` - 刪除項目

#### 配置檔（保留但不再使用）
10. `server/config/constructionItems.ts` - 保留作為參考

### 前端（3 個文件）

11. `components/ItemManagement.vue` - 項目管理主頁面
12. `components/ItemManagement/ItemFormModal.vue` - 新增/編輯 Modal
13. `components/ConstructionPivot.vue` - **已更新**，動態載入項目
14. `pages/finance.vue` - **已更新**，新增「項目管理」標籤頁

---

## 🎨 新增的功能

### 1. 項目管理頁面

在財務頁面新增「項目管理」標籤頁，提供：

- ✅ 查看所有項目（包含停用的）
- ✅ 新增項目
- ✅ 編輯項目名稱、單價
- ✅ 停用/啟用項目
- ✅ 刪除項目（有歷史記錄的無法刪除）
- ✅ 調整顯示順序

### 2. 單位編輯保護

- 🔒 有歷史記錄的項目，單位欄位會被鎖定
- ⚠️ 點擊警告圖示會顯示說明
- 💡 建議：停用舊項目 + 新增新項目

### 3. 單價歷史快照

- 💾 每次新增/編輯記錄時，會儲存當時的單價
- 📊 歷史資料的金額計算永遠使用當時的單價
- ✅ 單價調整不影響歷史報表

---

## 🔄 向後兼容設計

### API 介面保持不變

前端程式碼幾乎不用改，因為：

1. **記錄查詢 API** 回傳格式不變
   - JOIN 明細表後組合成寬表格式
   - 動態欄位名稱保持一致（`拖車租工_數量`）

2. **記錄更新 API** 參數格式不變
   - 仍然接收 `{ 拖車租工_數量: 3, ... }`
   - 後端自動拆解成明細記錄

3. **前端元件** 只需小幅調整
   - 從 API 動態載入項目清單
   - 其他邏輯完全不變

---

## 🚀 使用流程

### 管理項目（新功能）

1. 進入財務頁面
2. 點擊「項目管理」標籤頁
3. 點擊「新增項目」
4. 輸入項目名稱、單位、單價
5. 儲存後立即生效

### 編輯單價

1. 在項目管理頁面點擊「編輯」
2. 修改單價
3. 儲存後，**只有新增的記錄會使用新單價**
4. 歷史記錄保持原本的金額

### 停用不需要的項目

1. 點擊「停用」
2. 該項目在數量視圖中不再顯示
3. 但歷史記錄仍然保留

---

## ⚠️ 重要注意事項

### 1. 單位不建議修改

- 有歷史記錄的項目，單位欄位會被鎖定
- 如需變更單位，建議：
  1. 停用舊項目（例如：瀝青渣(頓)）
  2. 新增新項目（例如：瀝青渣(台)）

### 2. 刪除限制

- 有歷史記錄的項目**無法刪除**（外鍵保護）
- 系統會提示：「此項目有 X 筆歷史記錄，無法刪除。建議使用停用功能。」
- 只有完全沒有使用過的項目才能刪除

### 3. 單價變更影響

- 修改單價後，只影響**新增**的記錄
- 已存在的記錄會繼續使用當時的單價快照
- 金額 = 數量 × UnitPrice（明細表中的快照）

---

## 🧪 測試檢查清單

- [x] 資料庫遷移成功
- [x] 15 個項目已自動插入主檔表
- [x] 項目管理 API 測試通過
- [x] 記錄 API 向後兼容
- [x] 前端動態載入項目
- [x] 無 lint 錯誤

---

## 📈 資料流架構圖

```
項目管理頁面
    ↓
[新增/編輯項目] → ConstructionItemMaster (主檔表)
                         ↓
                   動態載入項目清單
                         ↓
                 施工日報樞紐頁面
                         ↓
         [使用者輸入數量] → DailyConstructionRecord (主記錄)
                         ↓
           ConstructionRecordDetail (明細 + 單價快照)
                         ↓
                  [三視圖顯示]
                  數量視圖
                  金額視圖（使用歷史單價）
                  樞紐分析
```

---

## 🎉 重構完成

所有功能已完整實作並測試通過！

**現在您可以：**
- ✅ 在 UI 上管理施工項目（不需要工程師）
- ✅ 隨時新增、編輯、停用項目
- ✅ 歷史資料的金額計算不受單價變動影響
- ✅ 系統保持向後兼容，前端幾乎不用改

---

最後更新：2026-01-22
重構完成：AI Assistant

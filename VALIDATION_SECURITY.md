# 資料驗證與安全機制

## 🛡️ 已實作的安全防護

### 1. SQL Injection 防護 ✅

**使用參數化查詢：**
```typescript
// ✅ 安全的做法
request.input('單位', sql.NVarChar, userInput);
await request.query('SELECT * FROM Table WHERE [單位] = @單位');

// ❌ 危險的做法（已避免）
await request.query(`SELECT * FROM Table WHERE [單位] = '${userInput}'`);
```

所有 SQL 查詢都使用 `sql.input()` 參數化，完全防止 SQL Injection。

---

### 2. 數量輸入驗證 ✅

#### 前端即時驗證（`QuantityView.vue`）

```typescript
// 輸入時：移除非數字字元
@input="validateInput($event)"

// 失焦時：範圍檢查 + 小數位限制
@blur="handleBlur(...)"
  ├─ 檢查是否為有效數字
  ├─ 限制範圍：0 ~ 999,999
  ├─ 限制小數位：2 位
  └─ 無效值回復為原值
```

#### 後端嚴格驗證（`ConstructionRecordService.ts`）

```typescript
import { validateQuantity } from '../utils/validationHelper';

const quantityValidation = validateQuantity(quantity);
if (!quantityValidation.valid) {
  throw new Error(quantityValidation.message);
}
```

**驗證規則：**
- ✅ 只接受數字
- ✅ 範圍：0 ~ 999,999
- ✅ 小數位：最多 2 位
- ✅ 自動清理千分位符號

---

### 3. 項目管理驗證 ✅

#### 項目名稱（`ConstructionItemService.ts`）

```typescript
import { validateItemName, sanitizeString } from '../utils/validationHelper';

// 驗證項目名稱
const nameValidation = validateItemName(item.ItemName);
if (!nameValidation.valid) {
  throw new Error(nameValidation.message);
}

// 清理字串
const cleanedName = sanitizeString(item.ItemName, 100);
```

**防護機制：**
- ✅ 長度限制：最多 100 字元
- ✅ 移除危險字元：`< > " ' ; -- /* */ script`
- ✅ 只保留：中文、英文、數字、常用標點符號

#### 單位驗證（白名單）

```typescript
import { validateUnit } from '../utils/validationHelper';

if (!validateUnit(cleanedUnit)) {
  throw new Error('單位不在允許清單中');
}
```

**允許的單位：**
```
天、頓、台、小時、桶、噸、公尺、平方公尺、立方公尺、個、組、式
```

#### 單價驗證

```typescript
import { validatePrice } from '../utils/validationHelper';

const priceValidation = validatePrice(item.Price);
if (!priceValidation.valid) {
  throw new Error(priceValidation.message);
}
```

**驗證規則：**
- ✅ 範圍：0 ~ 9,999,999
- ✅ 小數位：最多 2 位
- ✅ 自動處理非數字輸入

---

### 4. 日期驗證 ✅

```typescript
import { validateDate } from '../utils/validationHelper';

const dateValidation = validateDate(record.日期);
if (!dateValidation.valid) {
  throw new Error(dateValidation.message);
}
```

**驗證規則：**
- ✅ 格式：YYYY-MM-DD
- ✅ 有效日期檢查
- ✅ 合理範圍：2020-2050

---

## 🎯 多層防護架構

```
使用者輸入
    ↓
[前端即時驗證]
    ├─ HTML 屬性（type, min, max, maxlength）
    ├─ @input 事件即時清理
    └─ 提交前最終檢查
    ↓
[後端 API 驗證]
    ├─ 必填欄位檢查
    ├─ 資料類型驗證
    ├─ 範圍檢查
    ├─ 字串清理
    └─ 白名單驗證
    ↓
[資料庫層保護]
    ├─ 參數化查詢（防 SQL Injection）
    ├─ 欄位類型限制
    ├─ NOT NULL 約束
    └─ 外鍵約束
```

---

## 📋 驗證規則總覽

| 欄位 | 前端驗證 | 後端驗證 | 說明 |
|------|---------|---------|------|
| **數量** | type="number"<br/>min="0"<br/>max="999999"<br/>即時清理 | sanitizeNumber()<br/>0~999,999<br/>2 位小數 | 防止負數、過大值、特殊符號 |
| **項目名稱** | maxlength="100"<br/>即時移除危險字元 | validateItemName()<br/>sanitizeString()<br/>長度限制 | 防止 XSS、SQL Injection |
| **單位** | maxlength="20" | validateUnit()<br/>白名單檢查 | 只允許預定義的單位 |
| **單價** | type="number"<br/>min="0"<br/>max="9999999" | validatePrice()<br/>0~9,999,999<br/>2 位小數 | 防止負數、過大值 |
| **日期** | type="date" | validateDate()<br/>格式檢查<br/>範圍檢查 | 2020-2050 合理範圍 |

---

## 🚨 特殊字元防護

### 已過濾的危險字元

```javascript
// XSS 防護
< > " ' 

// SQL Injection 防護
; -- /* */ 

// Script 關鍵字
script (不分大小寫)
```

### 允許的字元

```
✅ 中文字：\u4e00-\u9fa5
✅ 英文字：a-zA-Z
✅ 數字：0-9
✅ 空白：\s
✅ 常用標點：. - ( ) /
```

---

## 💡 實際防護範例

### 範例 1：數量輸入

```
使用者輸入：「abc123.456」
  ↓ 前端即時清理
結果：「123.456」
  ↓ blur 時驗證
結果：「123.46」（限制 2 位小數）
```

### 範例 2：項目名稱

```
使用者輸入：「拖車<script>alert(1)</script>租工」
  ↓ 前端即時清理
結果：「拖車租工」
  ↓ 後端驗證
通過：移除 script 標籤
```

### 範例 3：SQL Injection 嘗試

```
使用者輸入：「'; DROP TABLE Users; --」
  ↓ 參數化查詢
結果：當作普通字串處理，不會執行 SQL
  ↓ sanitizeString 清理
結果：「DROP TABLE Users」（移除特殊符號）
```

---

## ✅ 安全檢查清單

- [x] SQL Injection 防護（參數化查詢）
- [x] XSS 防護（清理特殊字元）
- [x] 數字範圍驗證（防止溢出）
- [x] 字串長度限制（防止資料庫錯誤）
- [x] 白名單驗證（單位）
- [x] 日期範圍檢查（合理性）
- [x] 外鍵約束（資料完整性）
- [x] 交易機制（原子性）

---

## 🔧 驗證輔助函數位置

所有驗證函數集中在：
```
server/utils/validationHelper.ts
├─ sanitizeString()    - 字串清理
├─ sanitizeNumber()    - 數字驗證
├─ validateUnit()      - 單位白名單
├─ validateItemName()  - 項目名稱驗證
├─ validateQuantity()  - 數量驗證
├─ validatePrice()     - 單價驗證
└─ validateDate()      - 日期驗證
```

---

最後更新：2026-01-22
完成人員：AI Assistant

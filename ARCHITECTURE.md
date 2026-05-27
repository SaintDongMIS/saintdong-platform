# 系統架構與開發指南

## 專案概述

建立企業內部平台，服務 MIS、財務、管理部門。採用 Nuxt.js 4 + Tailwind CSS 快速開發前端，並使用 Nuxt 內建 Nitro (Node.js + TypeScript) 提供後端 API。部署至 Synology NAS Docker 環境，直接連接內網 SQL Server 資料庫。遵循 Clean Code 原則，保持專案結構清晰，避免複雜化。優先實現財務部門 Excel 上傳功能，後續擴展其他部門需求。

## 整體架構

### 技術架構圖

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端 (Nuxt.js) │────│   後端 (Node.js) │────│   SQL Server    │
│                 │    │                 │    │                 │
│ • 使用者介面     │    │ • API 服務      │    │ • 內網資料庫    │
│ • 檔案上傳      │    │ • 業務邏輯      │    │ • 1433 埠       │
│ • 資料展示      │    │ • 資料處理      │    │ • 192.168.8.239 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 網路架構圖

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   使用者瀏覽器   │────│   Synology NAS  │────│   內網資料庫    │
│                 │    │ 192.168.197.216 │    │ 192.168.8.239  │
│ • Web 介面      │    │                 │    │                 │
│ • 檔案上傳      │    │ • Docker 容器   │    │ • SQL Server    │
│ • 資料展示      │    │ • Nuxt.js 應用  │    │ • 1433 埠       │
└─────────────────┘    │ • 前端+後端     │    └─────────────────┘
                       └─────────────────┘
```

**資料流向：**

```
使用者瀏覽器 → NAS:3000 → Docker 容器 (Nuxt.js) → 內網資料庫:1433
```

### 專案結構

本專案採用 Nuxt 的整合式架構（同一專案內同時包含前端與後端 API），簡化開發與部署流程。

```
saintdong-platform/
├── server/            # Nuxt 4 後端 API (Nitro)
│   ├── api/           # API 路由端點
│   ├── services/      # 業務邏輯服務
│   ├── migrations/    # Knex 資料庫遷移腳本
│   └── config/        # 設定檔
├── pages/             # Nuxt 4 前端頁面
├── components/        # Vue 組件
├── assets/            # 靜態資源
├── nuxt.config.ts     # Nuxt 設定檔
├── Dockerfile         # Docker 建構檔案
└── deploy.sh          # NAS 部署腳本
```

## 前端架構 (Nuxt.js)

### 核心功能

- **檔案上傳**: Excel 檔案上傳介面
- **資料展示**: 上傳檔案列表與狀態
- **響應式設計**: 支援桌面與行動裝置

### 技術特色

- **SSR/SSG**: 伺服器端渲染提升效能
- **自動路由**: 基於檔案系統的路由
- **組合式 API**: Vue 3 Composition API
- **Tailwind CSS**: 快速樣式開發

### 檔案結構

本專案採 Nuxt 的標準目錄（非獨立 `frontend/` 專案）：

- `components/`: 共用組件
- `pages/`: 頁面路由
- `layouts/`: 佈局模板
- `composables/`: 組合式函數
- `utils/`: 前端工具函數與資料處理
- `server/`: 後端 API（Nitro）

### 前端檔案驗證機制

為了提升使用者體驗並防止上傳錯誤的檔案，系統在前端實現了即時的 Excel 檔案格式驗證。此機制在檔案上傳至伺服器前執行，能夠立即給予使用者回饋。

- **核心技術**: 使用 `xlsx` (SheetJS) 套件在瀏覽器端直接讀取並解析 Excel 檔案的標頭 (Header)。

- **驗證邏輯 (`composables/useExcelValidator.ts`)**:
  - 建立了一個可重用的 Vue Composable 來封裝驗證邏輯。
  - 此 Composable 接收檔案與部門驗證規則，並回傳驗證結果。
  - 支援兩種驗證規則：
    1.  **必要欄位 (`requiredFields`)**: 檢查檔案是否包含所有指定的欄位（用於財務部）。
    2.  **禁止欄位 (`forbiddenFields`)**: 檢查檔案是否**不**包含任何指定的欄位（用於道路施工部，反向檢查）。

- **部門規則配置 (`utils/departmentConfig.ts`)**:
  - 建立了一個前端專用的設定檔，集中管理各部門的驗證規則，與後端配置分離，保持前端邏輯的獨立性。

## 後端架構 (Nuxt Nitro Server)

後端 API 基於 Nuxt 4 內建的 Nitro 伺服器引擎，採用檔案系統路由，開發體驗與前端保持一致。

### API 設計

API 端點定義在 `server/api/` 目錄下，例如：

- `POST /api/upload/finance`: 處理財務部檔案上傳
- `POST /api/upload/road-construction`: 處理道路施工部檔案上傳
- `POST /api/bank-convert/analyze`: 國泰整批付款轉檔「分析」（回傳 JSON，比對收款帳號清單與相似戶名候選）。
- `POST /api/bank-convert`: 國泰整批付款轉檔（Commeet 付款資料 Excel `.xlsx`/`.xls` → 固定寬度 361 bytes + CRLF 之 `.txt`，Big5）。可選帶 `resolutions`（逐列決議：使用清單帳號或 Excel），以確保匯出內容符合使用者在前端的選擇。手動測試步驟見 `docs/BANK_CONVERT_TESTING.md`。
- `GET /api/finance/reports`: 取得財務報表資料
- `POST /api/finance/fill-payment-reason`: 付款報表 Excel 事由填補（寫回 ExpendForm 等）
- `POST /api/commeet/login`: COMMEET 登入驗證（Puppeteer）
- `POST /api/commeet/sync`: COMMEET 報表同步至 `ExpendForm`（含 `ExpendForm_ChangeLog`）。流程：Puppeteer 登入 → 下載 Excel → 解析 → `ExpendFormChangeTrackingService` 批次 UPSERT；**同一 transaction 結束前**由 `ExpendFormDupPaymentAlignService` 掃描全表 dup 群組並對齊「付款狀態／實際付款日期」（`ChangedBy = COMMEET_SYNC_DUP_PAYMENT_ALIGN`）。回應與通知信含 `databaseStats.dupPaymentAlignedCount`。
- `POST /api/commeet/manual-update`: 手動修正單筆 `ExpendForm`（含變更追蹤寫入 `ExpendForm_ChangeLog`）；適用緊急止血或單筆修正（`tests/manual-fixes*.http`）。

財務頁（`/finance`）目前包含報表管理、資料匯入、網銀付款轉檔、付款報表事由填補等；**已不再提供「施工日報樞紐／施工項目管理」**（相關 API、`Construction*` 服務與資料表已自程式與遷移流程移除）。

**注意**: `create-table` 和 `update-table` 相關的 API 端點已被新的資料庫遷移流程取代，應視為已棄用。

### 核心服務

- **檔案上傳處理**: 驗證並解析 Excel 檔案。
- **國泰整批付款轉檔** (`BankConverterService` + `server/constants/bankConverterConfig.ts` / `bankConverterExcelConfig.ts`): 將 Commeet「付款資料」工作表對應為國泰上傳格式；輸出每行 361 bytes，手續費 13/15 仍由 `HandlingFeeService.isSpecialCompany`（依 Excel `戶名`）決定；預定交易日期依操作當下台北時間，當月為「15 日或當月最後一日」。
- **收款帳號清單比對（網銀轉檔）**: 透過 `Payee_Accounts`（「收款帳號清單」）比對收款人資訊：先依帳號（必要時再加銀行代碼縮窄）找清單列；再用 Fuse.js 依戶名提供相似候選，供使用者在前端做決議。當清單無此帳號但有相似戶名時，分析狀態會標為 `name_hint_only`，代表僅供參考且預設使用 Excel。
- **資料庫操作**: 透過 `DatabaseService` 執行 SQL 操作。
- **資料表定義**: 透過 `TableDefinitionService` 統一管理資料表 Schema。
- **錯誤處理**: 統一的錯誤回應機制。

### 多部門架構設計

為了支援多個部門（財務部、道路施工部等）的獨立資料處理需求，系統採用了**部門配置系統**和**通用上傳處理器**的設計：

#### 1. 部門配置系統 (`departmentConfig.ts`)

- **目的**: 集中管理各部門的配置，包括資料表名稱、必要欄位、Schema、Excel 解析器等
- **設計原則**:
  - 財務部配置完全重用現有服務，確保向後相容
  - 道路施工部使用專屬解析器處理樞紐表結構
  - 完全隔離，互不影響

#### 2. 通用上傳處理器 (`UploadProcessor`)

- **目的**: 根據部門配置執行完整的上傳流程
- **處理流程**:
  1. 驗證資料庫連接
  2. 使用部門專屬解析器解析 Excel
  3. 驗證資料
  4. 可選的資料擴充（如財務部的銀行資料擴充）
  5. 確保資料表結構（使用部門專屬 Schema）
  6. 批次插入資料庫
  7. 回傳處理結果

#### 3. 部門專屬解析服務

- **財務部**: 使用 `ExcelService.parseExcel()` 處理標準表格結構
- **道路施工部**: 使用 `RoadConstructionExcelService.parsePivotTableExcel()` 處理樞紐表結構
  - 自動從檔名提取派工單號
  - 正規化樞紐表資料（項目 × 日期 → 多筆紀錄）
  - 過濾統計欄位（總計、合計等）

#### 4. 資料表 Schema 管理

- **財務部**: `ExpendForm` (使用 `reimbursementTableSchema`)
- **道路施工部**: `RoadConstructionForm` (使用 `roadConstructionTableSchema`)
- **自動遷移**: `TableMigrationService` 支援可選的 schema 參數，確保向後相容

### 核心業務邏輯亮點

本專案的後端服務不僅僅是簡單的 CRUD 操作，更包含了多項確保資料品質、系統穩定性與可維護性的核心邏輯設計：

1.  **智慧化的資料預處理 (`ExcelService`)**:
    - **資料過濾**: 在解析階段即根據業務規則（如 `表單狀態` 需為「已核准」）過濾無效資料，確保只有符合條件的資料進入系統。
    - **資料清洗**: 自動標準化資料格式，例如移除金額中的千分位符號、統一日期格式，確保資料庫儲存的純淨度。
    - **資料擴充**: 主動補全缺失的關聯性資料，例如根據銀行代碼自動填入銀行名稱 (`DataEnrichmentService`)，提升資料完整性。
    - **主從架構資料處理**: 支援 Excel 中的主從結構資料（Master-Detail），當從屬行（Detail Row）缺少表單編號時，會自動繼承主紀錄（Master Row）的資訊，減少使用者重複填寫。同時透過「強制覆寫」機制，確保特定欄位（如會計科目、會計科目代號、會計科目原幣金額）不會錯誤繼承，維持資料正確性。
    - **資料一致性保證**: 在 `sanitizeInheritedData` 方法中實作了多項業務規則，確保從屬紀錄的合理性：
      - 當會計科目為空時，會計科目原幣金額也會自動清空，保持資料一致性（NULL 而非 0，因為代表「不適用」而非「金額為零」）。
      - 處理稅額分錄時，會自動清理不相關的金額欄位。
      - 處理費用分攤分錄時，會清理發票層級的總額資訊。

2.  **穩健的資料庫操作 (`DatabaseService`)**:
    - **交易完整性**: 所有資料庫寫入操作皆採用交易 (Transaction)，確保批次匯入的資料要麼全部成功，要麼在發生錯誤時全部回滾，杜絕資料不一致的風險。
    - **手動欄位更新與審計**: `manualUpdateWithTracking` 僅允許更新 `ExpendForm`，會比對舊值、略過無變更欄位，並將實際變更寫入 `ExpendForm_ChangeLog`（供 `/api/commeet/manual-update` 使用）。
    - **高效的重複資料檢查**: 採用「複合鍵」概念，並透過單次批次查詢 (`batchCheckExistingData`) 檢查資料庫中所有已存在的紀錄，效能遠高於逐筆檢查。
    - **費用報銷單複合鍵與分攤行處理** (`CompositeKeyService` + `ExpendFormChangeTrackingService`): 費用報銷單一筆表單會對應多列（主列、分攤列、進項稅額列），故用六欄組成複合鍵（表單編號、發票號碼、交易日期、項目原幣金額、費用項目、分攤參與部門）唯一識別一列，以決定 UPDATE 或 INSERT。**分攤行**在 Excel 經 `sanitizeInheritedData` 後 項目原幣金額 被清為 0，但 DB 該列當初以主列金額（如 10737）寫入，若組鍵與查詢都嚴格用「項目原幣金額 = 0」會對不到而重複插入。因此：(1) 組鍵時，若為分攤行（分攤參與部門有值且費用項目為空），將 項目原幣金額 統一為 `0.00`，使 Excel 與 DB 產出的 key 一致；(2) 查詢 DB 時，若為分攤行的 key，WHERE 條件**略過** 項目原幣金額（不篩該欄），只依其餘五欄匹配，才能查到 DB 裡存 10737 的分攤列，再以 key 對應做 UPDATE 而非誤 INSERT。同步 UPSERT 時 `batchQueryExistingData` 對**同一複合鍵若有多列**僅保留一列於 Map，故歷史上可能出現「同鍵多列、付款狀態不一致」；見下方 dup 對齊。
    - **dup 群組付款狀態對齊** (`ExpendFormDupPaymentAlignService`): 在 `executeBatchUpsertWithTracking` 完成後、transaction commit 前執行。以六欄正規化（與手動止血 SQL 相同：`HAVING COUNT(*) > 1`）找出 dup 群組；若群內已有「已付款」且具「實際付款日期」，則將同群內「未付款或日期空」的列改為已付款，日期取群內 `MAX(實際付款日期)`。僅升級補齊、不 downgrade。凡 `batchInsertData(..., { trackChanges: true })` 的 `ExpendForm` 寫入（含 COMMEET sync、財務上傳 pipeline）皆會觸發。
    - **動態型別對應**: 根據欄位名稱智慧判斷應使用的 SQL 資料類型，確保日期、金額等資料以最正確的格式儲存。

3.  **資料庫結構管理 (`TableDefinitionService` + `Knex.js`)**:
    - **單一事實來源 (藍圖)**: `server/services/TableDefinitionService.ts` 是資料表結構的**唯一權威藍圖**。所有期望的欄位定義、順序和類型都應在此檔案中修改。
    - **版本控制的遷移**: 所有的資料庫結構**變更**都是透過 `knex.js` 遷移腳本來執行。這取代了原有的自動 `ALTER TABLE` 機制，提供了版本控制、可追溯性與更高的安全性。詳細流程請參閱下方的「資料庫遷移」章節。

4.  **結構化的日誌系統 (`LoggerService`)**:
    - 提供帶有時間戳、服務來源、日誌級別的結構化日誌，便於後續的問題追蹤與系統監控。

### 檔案結構

```
server/
├── api/              # API 路由端點
│   ├── upload/
│   │   ├── finance.post.ts                # 財務部上傳
│   │   └── road-construction.post.ts      # 道路施工部上傳
│   ├── commeet/
│   │   ├── login.post.ts                  # COMMEET 登入（Puppeteer）
│   │   ├── sync.post.ts                   # COMMEET 同步 + 通知信
│   │   └── manual-update.post.ts          # 手動單筆修正
│   ├── create-table.post.ts               # 財務部資料表建立
│   ├── create-table-road-construction.post.ts  # 道路施工部資料表建立
│   └── ...
├── services/         # 核心業務邏輯
│   ├── DatabaseService.ts
│   ├── CommeetService.ts                  # COMMEET 登入與 Excel 下載
│   ├── ExpendFormChangeTrackingService.ts # ExpendForm UPSERT + ChangeLog
│   ├── ExpendFormDupPaymentAlignService.ts # dup 群組付款狀態對齊
│   ├── CompositeKeyService.ts
│   ├── ExcelService.ts                    # 財務部 Excel 解析
│   ├── RoadConstructionExcelService.ts   # 道路施工部 Excel 解析
│   ├── EmailService.ts                    # 上傳與自動化排程通知
│   ├── TableDefinitionService.ts         # 統一管理所有資料表 Schema
│   └── TableMigrationService.ts          # 資料表遷移（支援多部門）
├── utils/
│   ├── automationIoLog.ts                # COMMEET sync I/O 計時與 log
│   ├── commeetSyncRunLog.ts               # 單次 sync 摘要（通知信 txt 附件）
│   ├── uploadProcessor.ts
│   ├── fileUploadHandler.ts
│   └── errorHandler.ts
├── constants/
│   ├── compositeKey.ts                   # ExpendForm 六欄複合鍵定義
│   └── emailTemplates.ts                 # 上傳／自動化通知 HTML
└── config/
    ├── database.ts
    ├── departmentConfig.ts
    ├── commeetSelectors.ts
    └── bankCodes.json

tests/
├── commeet-api.http                       # COMMEET 手動測試
├── manual-fixes.http                      # 單筆手動修正範例
└── manual-fixes-batch.http                # 批次止血（dup 付款）範例
```

## 資料流設計

### 檔案上傳流程

```
1. 前端選擇 Excel 檔案
2. 前端即時驗證:
   - 使用 `xlsx` 套件解析檔案標頭。
   - 根據 `utils/departmentConfig.ts` 中的規則，呼叫 `useExcelValidator` 進行驗證。
   - 財務部: 驗證是否包含 `表單編號` 等必要欄位。
   - 道路施工部: 驗證是否不包含財務部的特有欄位。
   - 若驗證失敗，立即提示使用者並中止上傳。
3. 上傳至後端 API (`/api/upload/...`)
4. 後端深度驗證:
   - 根據 `server/config/departmentConfig.ts` 執行業務邏輯驗證（如樞紐表轉換、資料格式等）。
5. 解析 Excel 資料
6. 批次插入資料庫（使用交易）
7. 回傳上傳結果
```

### COMMEET 同步流程（`POST /api/commeet/sync`）

```
1. （可選）台灣休假日 gate → 略過則結束
2. 測試 DB 連線、確保 ExpendForm 結構
3. Puppeteer 登入 COMMEET → 下載指定期間 Excel（記憶體 Buffer）
4. ExcelService 解析 → 有效列批次 UPSERT（ExpendFormChangeTrackingService，追蹤付款狀態／實際付款日期）
5. 同一 transaction：ExpendFormDupPaymentAlignService 全表掃描 dup 群組並對齊付款欄位 → commit
6. 回傳 JSON（含 databaseStats.dupPaymentAlignedCount）
7. 非阻塞寄信：HTML 統計 + CommeetSyncRunLogCollector 產生的 .txt 附件
```

手動驗證：`tests/commeet-api.http`。歷史 dup 不一致亦可先用 `tests/manual-fixes-batch.http` 單筆修正（`ChangedBy` 與自動對齊不同，便於區分）。

### 資料存取流程

```
1. 前端請求資料
2. 後端查詢資料庫
3. 回傳查詢結果
4. 前端顯示資料
5. 支援資料匯出功能
```

## 資料庫整合

### SQL Server

- **內網連接**: 直接連接公司內部資料庫
- **高效能**: 批次處理大量資料
- **交易安全**: 確保資料一致性
- **備份策略**: 定期資料備份

### 資料表設計

- **ExpendForm**: 費用報銷資料表
- **ExpendForm_ChangeLog**: 費用報銷欄位變更紀錄。常見 `ChangedBy`：`COMMEET_SYNC`（Excel UPSERT 追蹤欄位）、`COMMEET_SYNC_DUP_PAYMENT_ALIGN`（dup 群組付款對齊）、`ADMIN_*`（手動 `/api/commeet/manual-update` 或 `.http` 批次止血）
- **RoadConstructionForm**: 道路施工部資料表
- **結構管理**: 所有資料表的建立與變更皆由 `knex` 遷移腳本管理。
- **重複檢查**: 防止重複資料插入
- **索引優化**: 提升查詢效能

### 資料庫遷移 (Database Migration) - 標準作業流程 (SOP)

為了確保資料庫結構的變更有序、可追溯且在所有開發環境中保持一致，本專案採用 `knex.js` 進行資料庫遷移管理。**所有資料庫的結構變更（新增/修改/刪除資料表或欄位）都必須遵循此流程。**

#### 核心理念

- **程式碼即架構**: 任何資料庫結構的變更，都必須對應到一個版本控制的遷移腳本檔案。
- **不可變的歷史**: 已經執行過的遷移腳本不應再被修改，若要撤銷變更，應建立一支新的遷移腳本來執行反向操作。

#### 標準作業流程 (SOP)

##### **步驟 1: 修改「藍圖」**

首先，修改 `server/services/TableDefinitionService.ts` 中的 schema 字串，以反映您期望的**最終狀態**。

```typescript
// server/services/TableDefinitionService.ts

export const reimbursementTableSchema = `
  ...
  [付款銀行名稱] NVARCHAR(50),
  [付款對象帳戶號碼] NVARCHAR(50),
  [新增的欄位] NVARCHAR(100)  // <-- 新增或修改欄位
  ...
`;
```

##### **步驟 2: 建立新的「施工計畫」(遷移腳本)**

在終端機中，使用 `knex` CLI 建立一支新的遷移腳本。檔名應清楚描述此次變更的目的。

```bash
# 範例：為 ExpendForm 新增一個備註欄位
npx knex migrate:make -x ts add_memo_to_expendform
```

此指令會在 `server/migrations/` 目錄下建立一個帶有時間戳的新檔案。

##### **步驟 3: 撰寫「施工計畫」的具體內容**

打開新建立的遷移檔案，填寫 `up` 和 `down` 兩個方法。

- **`up()`**: 定義如何**應用**此次變更。
- **`down()`**: 定義如何**撤銷**此次變更。

```typescript
// server/migrations/YYYYMMDDHHMMSS_add_memo_to_expendform.ts

import type { Knex } from 'knex';

const tableName = 'ExpendForm';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(tableName, (table) => {
    // 新增一個名為「新備註」的欄位，類型為 NVARCHAR(500)，允許 NULL
    table.string('新備註', 500).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(tableName, (table) => {
    // 移除「新備註」欄位
    table.dropColumn('新備註');
  });
}
```

##### **步驟 4: 執行「施工」**

在本地開發環境儲存遷移腳本後，執行以下指令來更新資料庫。

```bash
npx knex migrate:latest
```

`knex` 會自動找到所有尚未執行的遷移腳本，並依序執行它們的 `up` 方法。

##### **(可選) 步驟 5: 撤銷上一次的變更 (回滾)**

如果發現剛才的遷移有問題，可以執行以下指令來回滾**最新一批**的變更。

```bash
npx knex migrate:rollback
```

此指令會執行最新一批遷移腳本的 `down` 方法。

## 開發規範

### 開發原則

1. **Clean Code**: 保持代碼整潔與可讀性
2. **TypeScript**: 使用 TypeScript 確保類型安全
3. **模組化**: 功能分離，避免耦合
4. **文檔化**: 重要邏輯需有註解說明

### 技術規範

- **前端**: Tailwind CSS + 組件化開發 + 響應式設計
- **後端**: Nuxt Nitro + 檔案系統路由 API + 錯誤處理
- **共用模組**: 類型定義 + 工具函數 + 常數定義

### TypeScript 規範

- 使用嚴格模式
- 明確類型註解
- 避免 any 類型
- 使用介面定義資料結構

### Git 提交規範

```
feat: 新功能
fix: 修復問題
docs: 文檔更新
style: 代碼格式調整
refactor: 重構代碼
test: 測試相關
chore: 建置工具或輔助工具的變動
```

## 安全性設計

### 環境變數管理

- **敏感資訊分離**: 密碼等敏感資訊不寫入程式碼
- **環境隔離**: 開發、測試、生產環境使用不同配置
- **檔案權限**: 環境變數檔案權限設為 600
- **版本控制**: 敏感檔案不提交到 Git

### 資料保護

- **內網連接**: 資料庫連接限制在內網範圍
- **傳輸安全**: HTTPS 加密傳輸
- **存取日誌**: 完整的操作記錄
- **資料備份**: 定期備份重要資料

## 擴展性設計

### 功能擴展

- **模組化設計**: 易於添加新功能
- **API 版本控制**: 向後相容性
- **部門擴展**: 支援 MIS、管理部門等功能
- **資料表擴展**: 支援動態資料表結構更新

## 環境設定

### 開發環境

- Node.js 18+
- npm/yarn 套件管理
- 本地開發伺服器
- 環境變數檔案 (`.env`)

### 生產環境（NAS Docker）

- Synology NAS
- Docker Container Manager
- 內網資料庫直連

### COMMEET 相關環境變數（可選）

- **COMMEET_AUTO_SYNC_ENABLED**: 是否啟用排程自動同步（cron）；`true` 啟用、`false` 僅手動同步。
- **COMMEET_SYNC_DEFAULT_DAYS**: 同步 API 未帶 `dateStart`/`dateEnd` 時的預設抓取天數（1～180），預設為 7。
- **排程時間（NAS Docker）**: 排程定義在 `docker/crontab`，並以容器內 `TZ=Asia/Taipei`（台灣時間）為準。目前設定為每天 **08:30、14:30** 呼叫 `POST /api/commeet/sync`。
- **排程日誌（NAS Docker）**: `docker/crontab` 會將執行時間戳與 API 回應（含 HTTP code）寫入 `/var/log/commeet-sync.log`（容器內檔案）。完整同步摘要以**通知信附件**為主；應用細節另見 `docker logs` 或上述 `.txt` 附件。
- **COMMEET_SYNC_SKIP_ON_TW_HOLIDAY**: 預設休假日略過 sync（回傳 `skipped: true`、不寄信）；手動補跑可於 body 帶 `skipHolidayCheck: true`（見 `tests/commeet-api.http`）。

### Email 通知（COMMEET 同步結果）

`/api/commeet/sync` 在成功/失敗（含「無資料需處理」）時都會嘗試寄出「自動化排程執行結果」通知信（寄信失敗不影響同步主流程）。模板見 `server/constants/emailTemplates.ts`（`buildAutomationEmailHtml`）。

**信內統計（HTML）**

- Excel：總行數、有效行數、跳過行數、欄位樣本
- 資料庫：`insertedCount`、`skippedCount`、`errorCount`、**`dupPaymentAlignedCount`（永遠顯示，含 0）**
- 執行時間、同步日期範圍、下載檔名、錯誤摘要（最多 10 筆）

**附件（單次執行摘要 `.txt`）**

- `CommeetSyncRunLogCollector`（`server/utils/commeetSyncRunLog.ts`）於該次 sync 累積結構化 log（`sync_run`、各 `io_start`/`io_complete`、`excel_parsed`、`sync_done` 等），檔名例：`COMMEET_SYNC-2026-05-25_03-13-27.txt`
- 非完整 Terminal dump；與 `automationLogger` 的 `sync_done` 欄位可互相對照
- 詳細 Puppeteer 步驟在 production 預設為 DEBUG 級，不一定寫入附件

**SMTP 環境變數**

- **DISABLE_EMAIL**: `true`/`1` 時停用寄信。
- **EMAIL_TO**: 收件人，可用逗號分隔多個 email。
- **SMTP_HOST / SMTP_PORT / SMTP_FROM**: SMTP 連線設定。
- **SMTP_USER / SMTP_PASSWORD**: 若 SMTP 需要帳密則設定；未設定 `SMTP_USER` 時會以匿名方式連線（適用內網 SMTP）。
- **LOG_LEVEL**: 影響 `automationIoLog` 在 production 是否輸出 `io_start` 細項至 console（不影響附件摘要）。

## 監控與維護

### 效能監控

- **Docker 監控**: 容器資源使用情況
- **資料庫監控**: 查詢效能與連接狀態
- **應用日誌**: 結構化 JSON 格式日誌

### 日誌管理

- **容器日誌**: `docker logs -f saintdong-platform`
- **應用日誌**: 內建 Logger 服務
- **錯誤追蹤**: 完整的錯誤記錄與堆疊追蹤

## NAS Docker 部署

### 快速部署流程

```bash
# 完整更新流程
cd /volume1/docker/saintdong-platform
git pull origin main
sudo ./deploy.sh

# 查看容器狀態
sudo docker ps | grep saintdong

# 查看即時日誌
sudo docker logs -f saintdong-platform

# 重啟容器（如果有問題）
sudo docker restart saintdong-platform
```

### 部署腳本功能

部署腳本 (`deploy.sh`) 會自動執行：

1. ✅ **停止舊容器** - 自動停止正在運行的容器
2. ✅ **移除舊映像** - 清理舊的 Docker 映像
3. ✅ **建構新映像** - 使用最新代碼建構新的 Docker 映像
4. ✅ **啟動新容器** - 啟動包含最新代碼的容器
5. ✅ **顯示狀態** - 確認容器正常運行

### 訪問應用

- **內網訪問**: http://192.168.197.216:3000
- **外網訪問**: 設定路由器埠轉發後可用公網 IP:3000

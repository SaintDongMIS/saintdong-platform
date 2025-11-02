# 系統架構與開發指南

## 專案概述

建立企業內部平台，服務 MIS、財務、管理部門。採用 Nuxt.js 3 + Tailwind CSS 快速開發前端，Node.js + TypeScript 建構後端 API。部署至 Synology NAS Docker 環境，直接連接內網 SQL Server 資料庫。遵循 Clean Code 原則，保持專案結構清晰，避免複雜化。優先實現財務部門 Excel 上傳功能，後續擴展其他部門需求。

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

本專案採用 Nuxt.js 3 的整合式架構，前端與後端 API 都在同一個專案中開發，簡化了開發與部署流程。

```
saintdong-platform/
├── server/            # Nuxt 3 後端 API (Nitro)
│   ├── api/           # API 路由端點
│   ├── services/      # 業務邏輯服務
│   └── config/        # 設定檔
├── pages/             # Nuxt 3 前端頁面
├── components/        # Vue 組件
├── assets/            # 靜態資源
├── nuxt.config.ts     # Nuxt 設定檔
├── Dockerfile         # Docker 建構檔案
└── deploy.sh          # NAS 部署腳本
```

## 前端架構 (Nuxt.js 3)

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

```
frontend/
├── components/        # 共用組件
├── pages/            # 頁面路由
├── layouts/          # 佈局模板
├── composables/      # 組合式函數
├── utils/            # 工具函數
└── types/            # 類型定義
```

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

## 後端架構 (Nuxt 3 Nitro Server)

後端 API 基於 Nuxt 3 內建的 Nitro 伺服器引擎，採用檔案系統路由，開發體驗與前端保持一致。

### API 設計

API 端點定義在 `server/api/` 目錄下，例如：

- `POST /api/upload/finance`: 處理財務部檔案上傳
- `POST /api/upload/road-construction`: 處理道路施工部檔案上傳
- `POST /api/create-table`: 建立財務部資料表
- `POST /api/create-table-road-construction`: 建立道路施工部資料表
- `POST /api/update-table`: 更新資料表結構
- `GET /api/table-info`: 取得資料表資訊

### 核心服務

- **檔案上傳處理**: 驗證並解析 Excel 檔案。
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

2.  **穩健的資料庫操作 (`DatabaseService`)**:

    - **交易完整性**: 所有資料庫寫入操作皆採用交易 (Transaction)，確保批次匯入的資料要麼全部成功，要麼在發生錯誤時全部回滾，杜絕資料不一致的風險。
    - **高效的重複資料檢查**: 採用「複合鍵」概念，並透過單次批次查詢 (`batchCheckExistingData`) 檢查資料庫中所有已存在的紀錄，效能遠高於逐筆檢查。
    - **動態型別對應**: 根據欄位名稱智慧判斷應使用的 SQL 資料類型，確保日期、金額等資料以最正確的格式儲存。

3.  **自動化的資料庫結構管理 (`TableDefinitionService`)**:

    - **單一事實來源**: `TableDefinitionService.ts` 是資料表結構的唯一權威來源，所有欄位修改都集中於此。
    - **自動結構遷移**: 系統在啟動或上傳時會自動比對資料庫結構與程式碼定義，若有差異（如新增欄位），會自動執行 `ALTER TABLE` 指令進行更新，大幅簡化了部署與維護流程。

4.  **結構化的日誌系統 (`LoggerService`)**:
    - 提供帶有時間戳、服務來源、日誌級別的結構化日誌，便於後續的問題追蹤與系統監控。

### 檔案結構

```
server/
├── api/              # API 路由端點
│   ├── upload/
│   │   ├── finance.post.ts                # 財務部上傳
│   │   └── road-construction.post.ts      # 道路施工部上傳
│   ├── create-table.post.ts               # 財務部資料表建立
│   ├── create-table-road-construction.post.ts  # 道路施工部資料表建立
│   └── ...
├── services/         # 核心業務邏輯
│   ├── DatabaseService.ts
│   ├── ExcelService.ts                    # 財務部 Excel 解析
│   ├── RoadConstructionExcelService.ts   # 道路施工部 Excel 解析（新增）
│   ├── TableDefinitionService.ts         # 統一管理所有資料表 Schema
│   └── TableMigrationService.ts          # 資料表遷移（支援多部門）
├── utils/            # 工具函數
│   ├── uploadProcessor.ts                # 通用上傳處理器（新增）
│   ├── fileUploadHandler.ts
│   └── errorHandler.ts
└── config/           # 設定檔
    ├── database.ts
    ├── departmentConfig.ts               # 部門配置系統（新增）
    └── bankCodes.json
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
- **自動結構更新**: 支援動態欄位新增
- **重複檢查**: 防止重複資料插入
- **索引優化**: 提升查詢效能

## 開發規範

### 開發原則

1. **Clean Code**: 保持代碼整潔與可讀性
2. **TypeScript**: 使用 TypeScript 確保類型安全
3. **模組化**: 功能分離，避免耦合
4. **文檔化**: 重要邏輯需有註解說明

### 技術規範

- **前端**: Tailwind CSS + 組件化開發 + 響應式設計
- **後端**: Express/Fastify + RESTful API + 錯誤處理
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

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

## 後端架構 (Nuxt 3 Nitro Server)

後端 API 基於 Nuxt 3 內建的 Nitro 伺服器引擎，採用檔案系統路由，開發體驗與前端保持一致。

### API 設計

API 端點定義在 `server/api/` 目錄下，例如：

- `POST /api/upload`: 處理檔案上傳
- `POST /api/create-table`: 建立資料表
- `POST /api/update-table`: 更新資料表結構
- `GET /api/table-info`: 取得資料表資訊

### 核心服務

- **檔案上傳處理**: 驗證並解析 Excel 檔案。
- **資料庫操作**: 透過 `DatabaseService` 執行 SQL 操作。
- **資料表定義**: 透過 `TableDefinitionService` 統一管理資料表 Schema。
- **錯誤處理**: 統一的錯誤回應機制。

### 檔案結構

```
server/
├── api/              # API 路由端點
│   ├── upload.post.ts
│   └── ...
├── services/         # 核心業務邏輯
│   ├── DatabaseService.ts
│   ├── ExcelService.ts
│   └── TableDefinitionService.ts
└── config/           # 設定檔
    ├── database.ts
    └── bankCodes.json
```

## 資料流設計

### 檔案上傳流程

```
1. 前端選擇 Excel 檔案
2. 前端驗證檔案格式
3. 上傳至後端 API
4. 後端驗證檔案內容
5. 解析 Excel 資料
6. 批次插入資料庫
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
- 環境變數檔案 (`.env.nas`)

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

### 環境變數配置

容器運行時會從 `.env.nas` 檔案讀取環境變數：

```bash
# 建立環境變數檔案
cp .env.nas.example .env.nas

# 編輯實際配置
vim .env.nas

# 設定檔案權限
chmod 600 .env.nas
```

**環境變數範例：**

```bash
NODE_ENV=production
DB_SERVER=192.168.8.239
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=your_actual_password
DB_DATABASE=APIsync
```

### 訪問應用

- **內網訪問**: http://192.168.197.216:3000
- **外網訪問**: 設定路由器埠轉發後可用公網 IP:3000

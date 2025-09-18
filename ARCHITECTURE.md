# 系統架構與開發指南

## 專案概述

建立企業內部平台，服務 MIS、財務、管理部門。採用 Nuxt.js 3 + Tailwind CSS 快速開發前端，Node.js + TypeScript 建構後端 API。整合 Google Cloud Storage 處理檔案上傳，部署至 App Engine 環境。遵循 Clean Code 原則，保持專案結構清晰，避免複雜化。優先實現財務部門 Excel 上傳功能，後續擴展其他部門需求。

## 整體架構

### 技術架構圖

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端 (Nuxt.js) │────│   後端 (Node.js) │────│   GCP 服務群組   │
│                 │    │                 │    │                 │
│ • 使用者介面     │    │ • API 服務      │    │ • App Engine    │
│ • 檔案上傳      │    │ • 業務邏輯      │    │ • Cloud Storage │
│ • 資料展示      │    │ • 資料處理      │    │ • Firestore     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
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
└── app.yaml           # GCP App Engine 部署配置
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
5. 儲存至 Cloud Storage
6. 記錄檔案資訊至資料庫
7. 回傳上傳結果
```

### 資料存取流程

```
1. 前端請求檔案列表
2. 後端查詢資料庫
3. 回傳檔案元資料
4. 前端顯示檔案資訊
5. 使用者可下載或刪除檔案
```

## GCP 服務整合

### App Engine

- **自動擴展**: 根據流量自動調整實例
- **版本管理**: 支援藍綠部署
- **監控日誌**: 整合 Cloud Logging
- **安全認證**: 內建身份驗證機制

### Cloud Storage

- **檔案儲存**: 安全可靠的檔案儲存
- **存取控制**: IAM 權限管理
- **生命週期**: 自動檔案管理策略
- **備份復原**: 多區域備份

### Firestore

- **檔案元資料**: 儲存檔案資訊與狀態
- **即時同步**: 支援即時資料更新
- **查詢優化**: 高效能的資料查詢
- **安全性**: 資料加密與存取控制

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

### 身份認證

- **Google Workspace**: 整合企業身份系統
- **角色權限**: 不同部門的存取權限
- **會話管理**: 安全的登入狀態管理

### 資料保護

- **檔案加密**: Cloud Storage 自動加密
- **傳輸安全**: HTTPS 加密傳輸
- **存取日誌**: 完整的操作記錄
- **資料備份**: 定期備份重要資料

## 擴展性設計

### 水平擴展

- **App Engine**: 自動負載平衡
- **Cloud Storage**: 無限制儲存容量
- **Firestore**: 自動分片與擴展

### 功能擴展

- **模組化設計**: 易於添加新功能
- **API 版本控制**: 向後相容性
- **微服務架構**: 未來可拆分為多個服務

## 環境設定

### 開發環境

- Node.js 18+
- npm/yarn 套件管理
- 本地開發伺服器

### 正式環境

- GCP App Engine
- Cloud Storage
- 環境變數配置

## 監控與維護

### 效能監控

- **Cloud Monitoring**: 應用效能指標
- **錯誤追蹤**: 自動錯誤偵測與通知
- **使用統計**: 使用者行為分析

### 日誌管理

- **結構化日誌**: JSON 格式日誌
- **日誌聚合**: Cloud Logging 集中管理
- **日誌分析**: 支援複雜查詢與分析

## 開發流程

1. **需求分析**: 明確功能需求與技術規格
2. **架構設計**: 設計前後端架構與 API 介面
3. **開發實作**: 遵循編碼規範進行開發
4. **測試驗證**: 功能測試與整合測試
5. **部署上線**: 部署至 App Engine 環境

# SaintDong Platform

企業內部管理平台，服務 MIS、財務、管理等部門。

## 專案架構

本專案採用 Nuxt 4 的整合式架構，將前端與後端 API 開發整合在同一個專案中。

```
saintdong-platform/
├── server/            # Nuxt 後端 API (Nitro)
├── pages/             # 前端頁面（含 pages/tutorial/ 教學中心）
├── components/        # Vue 組件（含 finance/、tutorial/）
├── composables/       # 共用 composable（含教學影片 seek）
├── data/tutorials/    # 教學課程靜態資料（每集一檔）
├── types/             # 共用 TypeScript 型別
├── utils/             # 共用工具（含匯款解析、log 顯示）
└── nuxt.config.ts
```

## 技術棧

- **框架**: Nuxt 4 (Vue 3)
- **樣式**: Tailwind CSS
- **語言**: TypeScript
- **部署**: Synology NAS (Docker) / Google Cloud Platform (App Engine)
- **資料庫**: Microsoft SQL Server

## 環境設定

### 1. 複製環境變數範本

```bash
cp .env.example .env
```

### 2. 編輯環境變數

編輯 `.env` 檔案，填入實際的資料庫連接資訊：

```bash
DB_SERVER=
DB_PORT=
DB_USER=
DB_PASSWORD=your_actual_password
DB_DATABASE=

# Email 通知設定（可選）
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
EMAIL_TO=
```

### 3. 執行環境

- **開發環境**: 本機 `yarn dev`
- **正式環境**: Synology NAS (Docker) / GCP App Engine

## 開發原則

- Clean Code 原則
- 保持專案結構清晰
- 避免過度複雜化
- 優先快速交付

## 功能模組

### 操作教學中心（`/tutorial`）

全公司各部門共用的**圖文 + YouTube 影片**教學，與財務／後端 API 邏輯無關。

| 路由 | 說明 |
|------|------|
| `/tutorial` | 教學目錄（依系列分組，顯示上架狀態） |
| `/tutorial/[slug]` | 單集教學頁（影片嵌入、時間軸跳轉、詳解卡片） |

**目前已上架（COMMEET 通用篇）：**

| 集數 | slug | 主題 |
|------|------|------|
| 一 | `commmeet-general-01` | 首次登入與簽核代理人設定 |
| 二 | `commmeet-general-02` | 三種最常使用表單的介紹 |

新增教學：在 `data/tutorials/` 新增一集資料檔，於 `index.ts` 註冊並設 `status: 'published'`。影片章節時間寫入 `videoChapters` 與 `keyPoints` 的 `videoStartSeconds`。

### 財務部門（`/finance`）

| 功能 | 說明 |
|------|------|
| 報表管理 | 財務報表檢視 |
| 資料匯入 | Excel 上傳寫入 `ExpendForm` |
| **網銀付款轉檔** | Commeet「付款資料」Excel → 國泰整批 TXT；比對 `Payee_Accounts`；曾匯出表單預設不轉 |
| **臨時整批匯款** | 會計 Payment 匯款 Excel／貼上 → TXT；支援合併與 log 重複比對 |
| **匯款事後登錄** | 國泰已匯完、當時未經平台 → 補寫 `BankWireExport_Log`（不產 TXT） |
| 付款報表事由填補 | 付款報表 Excel 事由寫回資料庫 |

三條匯款管道（Commeet／臨時／事後登錄）皆寫入同一張 **`BankWireExport_Log`**；財務各 tab 共用「匯款匯出紀錄」面板（類型篩選、搜尋、交易日等）。

### 未來擴展

- COMMEET 通用篇其餘集數（三～六）、財會篇教學
- MIS 部門功能
- 管理部門功能

## 快速開始

```bash
# 安裝依賴
yarn install

# 啟動開發環境
yarn dev

# 建置生產版本
yarn build
```

## 主要功能

- **Excel 上傳與解析**: 支援財務報銷單 Excel 檔案上傳，並解析其內容。
- **資料庫整合**: 將解析後的資料寫入 Microsoft SQL Server 的 `ExpendForm` 資料表。
- **國泰整批匯款轉檔**: Commeet 或臨時清單產出固定寬度 TXT；匯出紀錄寫入 `BankWireExport_Log`（`batch_type`: `commeet` / `adhoc` / `manual_backfill`）。
- **收款帳號清單比對**: 轉檔前比對 `Payee_Accounts`，減少分行／帳號錯誤。
- **動態資料表管理**: 提供 API 端點，可動態建立或更新資料庫中的資料表結構。
- **智能結構遷移**: 使用 Knex migration 安全地新增欄位，保留現有資料。
- **業界標準 Logger**: 使用結構化日誌記錄，便於監控和除錯。
- **設定檔管理**: 將銀行代碼等設定資訊外部化為 JSON 檔案，易於維護。

### 單元測試（匯款相關）

```bash
node --import tsx --test utils/__tests__/bankWire*.test.ts utils/__tests__/backfillPasteParse.test.ts
```

## 部署

### NAS Docker 部署（推薦）

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

### GCP App Engine 部署

使用 GCP App Engine 進行部署，詳細步驟請參考 `deploy/` 目錄中的配置檔案。

### 部署方案比較

| 項目     | NAS Docker   | GCP App Engine |
| -------- | ------------ | -------------- |
| 成本     | 免費         | 按用量收費     |
| 維護     | 需自行維護   | Google 維護    |
| 擴展性   | 受 NAS 限制  | 自動擴展       |
| 網路     | 內網或需設定 | 全球部署       |
| 適用場景 | 公司內部使用 | 公開服務       |

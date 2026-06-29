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

# 財務部登入（帳號 Jim / Sam / Finance）
FINANCE_PASSWORD=your_finance_password_here
FINANCE_SESSION_SECRET=your_random_session_secret_here
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

| 路由               | 說明                                         |
| ------------------ | -------------------------------------------- |
| `/tutorial`        | 教學目錄（依系列分組，顯示上架狀態）         |
| `/tutorial/[slug]` | 單集教學頁（影片嵌入、時間軸跳轉、詳解卡片） |

**COMMEET 通用篇（已上架 5 集）：**

| 集數 | slug                  | 主題                     |
| ---- | --------------------- | ------------------------ |
| 一   | `commmeet-general-01` | 首次登入與簽核代理人設定 |
| 二   | `commmeet-general-02` | 三種最常使用表單的介紹   |
| 三   | `commmeet-general-03` | 費用申請單與費用報銷單   |
| 五   | `commmeet-general-05` | 手機與電腦申請費用報銷單 |
| 六   | `commmeet-general-06` | 手機與電腦簽核單據       |

> 官方播放清單另有「通用篇（四）」，本站系列尚未納入。

**待上架：**

| 系列         | slug                  | 主題     |
| ------------ | --------------------- | -------- |
| 財會篇（二） | `commmeet-finance-02` | 付款報表 |

**新增一集教學：**

1. 在 `data/tutorials/` 新增 `commmeet-{series}-{episode}.ts`
2. 於 `data/tutorials/index.ts` import 並加入 `tutorialLessons`、對應 `tutorialSeries.lessons`
3. 設 `status: 'published'`，填寫 `video`、`videoChapters`、`keyPoints`、`forms`
4. 影片章節時間寫入 `videoChapters.startSeconds` 與 `keyPoints.videoStartSeconds`；**須逐秒對照影片**（下載後 `ffmpeg -vf fps=1` 抽幀），勿粗估間隔

資料檔範例：`data/tutorials/commmeet-general-06.ts`

### 財務部門（`/finance`）

需登入後使用（帳號 `Jim` / `Sam` / `Finance`，密碼見 `.env` 的 `FINANCE_PASSWORD`）。Session 有效 **8 小時**；未登入時 `/finance` 顯示登入卡，finance 相關 API 回傳 401。

| 功能             | 說明                                                                               |
| ---------------- | ---------------------------------------------------------------------------------- |
| 報表管理         | 財務報表檢視                                                                       |
| 資料匯入         | Excel 上傳寫入 `ExpendForm`                                                        |
| **網銀付款轉檔** | Commeet「付款資料」Excel → 國泰整批 TXT；比對 `Payee_Accounts`；曾匯出表單預設不轉 |
| **臨時整批匯款** | 會計 Payment 匯款 Excel／貼上 → TXT；支援合併與 log 重複比對                       |
| **匯款事後登錄** | 國泰已匯完、當時未經平台 → 補寫 `BankWireExport_Log`（不產 TXT）                   |
| 付款報表事由填補 | 付款報表 Excel 事由寫回資料庫                                                      |

三條匯款管道（Commeet／臨時／事後登錄）皆寫入同一張 **`BankWireExport_Log`**；財務各 tab 共用「匯款匯出紀錄」面板（類型篩選、搜尋、交易日等）。

## TODO（依優先度）

### P0 — 維運／上線

- [ ] **NAS 部署檢查清單**：`deploy.sh`／部署段落補上 `FINANCE_PASSWORD`、`FINANCE_SESSION_SECRET`（缺則財務登入 503）

### P1 — 財務登入（體驗／安全／稽核）

- [ ] **Session 過期 UX**：API 401 時前端統一跳回登入卡並提示「請重新登入」（避免 tab 只顯示載入失敗）
- [ ] **登入失敗 rate limit**：同 IP 短時間多次錯誤暫時鎖定
- [ ] **操作軌跡 log**：middleware 記 `username` + method + path（必要時 query 摘要；不 log 上傳內容）
- [ ] **報表查詢稽核**：記篩選條件、頁碼等（目前僅 log 登入／登出／失敗）

### P2 — 教學中心

- [ ] **COMMEET 財會篇（二）**：`commmeet-finance-02` 付款報表上架（時間軸逐秒對齊）
- [ ] **COMMEET 通用篇（四）**：評估是否納入系列、補 `commmeet-general-04`
- [ ] **集數跳號說明**：系列 1→2→3→5→6，目錄是否註明「四未收錄」

### P3 — 文件／測試／基礎建設

- [ ] **`.env.example` 補 `DISABLE_EMAIL`**：與 SMTP 設定放一起
- [ ] **單元測試指令**：README 測試段落加入 `utils/__tests__/financeAuth.test.ts`
- [ ] **GCP VPN 連 DB**：`server/config/database.ts` 既有 TODO

### P4 — 產品（可晚做）

- [ ] **`jim測試用`**：評估是否改名、移 tab 或僅限特定帳號
- [ ] **導覽／首頁**：Logo 或 nav 連到 `/tutorial`（`/` 已 redirect 教學中心）
- [ ] **其他部門上鎖**：`/road-construction` 等若含敏感資料，可沿用 finance auth 模式
- [ ] **MIS 部門功能**
- [ ] **管理部門功能**

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

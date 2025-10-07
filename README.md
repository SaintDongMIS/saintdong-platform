# SaintDong Platform

企業內部管理平台，服務 MIS、財務、管理等部門。

## 專案架構

本專案採用 Nuxt.js 3 的整合式架構，將前端與後端 API 開發整合在同一個專案中。

```
saintdong-platform/
├── server/            # Nuxt 3 後端 API (Nitro)
├── pages/             # Nuxt 3 前端頁面
├── components/        # Vue 組件
└── nuxt.config.ts     # Nuxt 設定檔
```

## 技術棧

- **框架**: Nuxt.js 3 (Vue 3)
- **樣式**: Tailwind CSS
- **語言**: TypeScript
- **部署**: Synology NAS (Docker) / Google Cloud Platform (App Engine)
- **資料庫**: Microsoft SQL Server

## 環境設定

### 1. 複製環境變數範本

```bash
# 開發環境
cp .env.example .env

# NAS 生產環境
cp .env.nas.example .env.nas
```

### 2. 編輯環境變數

編輯 `.env` 檔案，填入實際的資料庫連接資訊：

```bash
# 開發環境範例
DB_SERVER=192.168.8.239
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=your_actual_password
DB_DATABASE=APIsync
```

### 3. 安全注意事項

- ⚠️ **不要將 `.env` 檔案提交到 Git**
- 🔒 生產環境使用 `.env.nas` 檔案
- 🛡️ 定期更換資料庫密碼

## 開發原則

- Clean Code 原則
- 保持專案結構清晰
- 避免過度複雜化
- 優先快速交付

## 功能模組

### 財務部門

- Excel 檔案上傳功能
- 檔案管理與檢視

### 未來擴展

- MIS 部門功能
- 管理部門功能

## 環境設定

- **開發環境**: 本機開發
- **正式環境**: Synology NAS (Docker) / GCP App Engine

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
- **動態資料表管理**: 提供 API 端點，可動態建立或更新資料庫中的資料表結構。
- **智能結構遷移**: 使用 ALTER TABLE 方式安全地新增欄位，保留現有資料。
- **業界標準 Logger**: 使用結構化日誌記錄，便於監控和除錯。
- **設定檔管理**: 將銀行代碼等設定資訊外部化為 JSON 檔案，易於維護。

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

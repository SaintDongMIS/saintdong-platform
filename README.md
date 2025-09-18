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
- **部署**: Google Cloud Platform (App Engine)
- **資料庫**: Microsoft SQL Server

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
- **正式環境**: GCP App Engine

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
- **資料庫整合**: 將解析後的資料寫入 Microsoft SQL Server。
- **動態資料表管理**: 提供 API 端點，可動態建立或更新資料庫中的資料表結構。
- **設定檔管理**: 將銀行代碼等設定資訊外部化為 JSON 檔案，易於維護。

## 部署

使用 GCP App Engine 進行部署，詳細步驟請參考 `deploy/` 目錄中的配置檔案。

# SaintDong Platform

企業內部管理平台，服務 MIS、財務、管理等部門。

## 專案架構

```
saintdong-platform/
├── frontend/          # Nuxt.js 3 前端應用
├── backend/           # Node.js API 後端服務
├── shared/            # 共用類型定義與工具函數
└── deploy/            # GCP App Engine 部署配置
```

## 技術棧

- **前端**: Nuxt.js 3 + Tailwind CSS + TypeScript
- **後端**: Node.js + Express/Fastify + TypeScript
- **部署**: Google Cloud Platform (App Engine)
- **儲存**: Cloud Storage
- **資料庫**: Firestore / Cloud SQL

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
npm install

# 啟動開發環境
npm run dev

# 建置生產版本
npm run build
```

## 檔案上傳功能

目前實現的功能：

- 支援 Excel 檔案上傳 (.xlsx, .xls)
- 檔案大小限制：10MB
- 自動儲存到桌面
- 檔案名稱格式：`時間戳_原始檔名`

## 部署

使用 GCP App Engine 進行部署，詳細步驟請參考 `deploy/` 目錄中的配置檔案。

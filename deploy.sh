#!/bin/bash

# SaintDong Platform App Engine 部署腳本
# 作者: Jim MIS
# 專案: SamLeeplant (annular-welder-684)

set -e  # 遇到錯誤時停止執行

echo "🚀 開始部署 SaintDong Platform 到 App Engine..."

# 載入環境設定
if [ -f .envrc ]; then
    echo "📋 載入環境設定..."
    source .envrc
fi

# 檢查 gcloud 是否已安裝
if ! command -v gcloud &> /dev/null; then
    echo "❌ 錯誤: gcloud CLI 未安裝"
    echo "請先安裝 Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# 檢查是否已登入
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
    echo "❌ 錯誤: 未登入 Google Cloud"
    echo "請先執行: gcloud auth login"
    exit 1
fi

# 專案設定已在 .envrc 中處理
PROJECT_ID="annular-welder-684"

# 檢查 App Engine 是否已初始化
if ! gcloud app describe &> /dev/null; then
    echo "🔧 初始化 App Engine..."
    gcloud app create --region=asia-east1
else
    echo "✅ App Engine 已存在"
fi

# 檢查 Node.js 版本
echo "🔍 檢查 Node.js 版本..."
if command -v nvm &> /dev/null; then
    nvm use
fi

NODE_VERSION=$(node --version)
echo "📦 使用 Node.js: $NODE_VERSION"

# 安裝依賴項
echo "📦 安裝依賴項..."
yarn install

# 建構應用程式
echo "🔨 建構應用程式..."
yarn build

# 檢查建構結果
if [ ! -d ".output" ]; then
    echo "❌ 錯誤: 建構失敗，找不到 .output 目錄"
    exit 1
fi

echo "✅ 建構完成"

# 部署到 App Engine
echo "🚀 部署到 App Engine..."
gcloud app deploy app.yaml --quiet

# 獲取應用程式 URL
APP_URL=$(gcloud app browse --no-launch-browser)
echo ""
echo "🎉 部署成功！"
echo "📱 應用程式 URL: $APP_URL"
echo ""
echo "🔧 管理命令:"
echo "  查看日誌: gcloud app logs tail -s sdg"
echo "  查看版本: gcloud app versions list -s sdg"
echo "  停止服務: gcloud app versions stop [VERSION] -s sdg"
echo ""

# 開啟瀏覽器
if command -v open &> /dev/null; then
    echo "🌐 正在開啟瀏覽器..."
    open $APP_URL
fi
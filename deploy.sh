#!/bin/bash

echo "🚀 開始部署..."

# 載入環境設定
if [ -f .envrc ]; then
    source .envrc
fi

# 載入 nvm 並確保使用正確的 Node.js 版本
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

if command -v nvm &> /dev/null; then
    echo "🔍 切換到 Node.js v23.1.0..."
    nvm use v23.1.0
    NODE_VERSION=$(node --version)
    echo "✅ 目前使用 Node.js: $NODE_VERSION"
else
    echo "❌ 錯誤: nvm 未安裝或無法載入"
    echo "請確保 nvm 已正確安裝"
    exit 1
fi

# 建構
yarn build

# 部署到指定專案
echo "🚀 部署到專案: annular-welder-684"
gcloud app deploy app.yaml --project=annular-welder-684 --quiet

# 獲取應用程式 URL
APP_URL=$(gcloud app browse --project=annular-welder-684 --no-launch-browser)
echo ""
echo "🎉 部署成功！"
echo "📱 應用程式 URL: $APP_URL"

# 開啟瀏覽器
if command -v open &> /dev/null; then
    echo "🌐 正在開啟瀏覽器..."
    open $APP_URL
fi

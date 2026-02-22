#!/bin/bash

echo "🚀 開始自動部署 SaintDong Platform..."

# 進入專案目錄
cd /volume1/docker/saintdong-platform

# 停止並移除舊容器
echo "🛑 停止並移除舊容器..."
/usr/local/bin/docker stop saintdong-platform 2>/dev/null || true
/usr/local/bin/docker rm saintdong-platform 2>/dev/null || true

# 移除舊映像檔
echo "🗑️ 移除舊映像檔..."
/usr/local/bin/docker rmi saintdong-platform:latest 2>/dev/null || true

# 建構新的 Docker 映像檔
echo "🔨 建構新的 Docker 映像檔..."
if ! /usr/local/bin/docker build -t saintdong-platform:latest .; then
    echo "❌ Docker 映像檔建構失敗！"
    exit 1
fi

# 檢查 .env 檔案是否存在
if [ ! -f .env ]; then
    echo "⚠️  警告: .env 檔案不存在，容器可能無法正常啟動"
fi

# 執行資料庫 migration（新表／欄位由 knex 管理，表已存在則跳過）
echo "📋 執行資料庫 Migration..."
if /usr/local/bin/docker run --rm --env-file .env saintdong-platform:latest npx knex migrate:latest; then
    echo "✅ Migration 完成"
else
    echo "⚠️  Migration 執行有誤，請檢查 DB 連線與 .env；可稍後手動執行: docker run --rm --env-file .env saintdong-platform:latest npx knex migrate:latest"
fi

# 啟動新的 Docker 容器
echo "🚀 啟動新的 Docker 容器..."
/usr/local/bin/docker run -d \
  --name saintdong-platform \
  -p 3000:3000 \
  --shm-size=2gb \
  --env-file .env \
  --restart unless-stopped \
  saintdong-platform:latest

# 等待容器啟動
echo "⏳ 等待容器啟動..."
sleep 5

# 檢查容器狀態
echo "✅ 部署完成！檢查容器狀態..."
if ! /usr/local/bin/docker ps | grep -q saintdong-platform; then
    echo "❌ 容器未成功啟動！"
    /usr/local/bin/docker ps -a | grep saintdong-platform
    exit 1
fi
echo "✅ 容器運行正常"

# 顯示容器日誌
echo ""
echo "📋 容器日誌："
/usr/local/bin/docker logs --tail 20 saintdong-platform

echo ""
echo "🎉 部署成功！"
echo "📱 應用 URL: http://192.168.197.216:3000"
echo ""
echo "常用命令："
echo "  查看日誌: /usr/local/bin/docker logs -f saintdong-platform"
echo "  重啟容器: /usr/local/bin/docker restart saintdong-platform"
echo "  停止容器: /usr/local/bin/docker stop saintdong-platform"

#!/bin/bash

echo "🚀 開始自動部署 SaintDong Platform..."

# 進入專案目錄
cd /volume1/docker/saintdong-platform

# 拉取最新代碼（如果使用 Git）
echo "📦 拉取最新代碼..."
# git pull origin main

# 停止並移除舊容器
echo "🛑 停止並移除舊容器..."
docker stop saintdong-platform 2>/dev/null || true
docker rm saintdong-platform 2>/dev/null || true

# 移除舊映像檔
echo "🗑️ 移除舊映像檔..."
docker rmi saintdong-platform:latest 2>/dev/null || true

# 建構新的 Docker 映像檔
echo "🔨 建構新的 Docker 映像檔..."
docker build -t saintdong-platform:latest .

# 啟動新的 Docker 容器
echo "🚀 啟動新的 Docker 容器..."
docker run -d \
  --name saintdong-platform \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  saintdong-platform:latest

# 等待容器啟動
echo "⏳ 等待容器啟動..."
sleep 5

# 檢查容器狀態
echo "✅ 部署完成！檢查容器狀態..."
docker ps | grep saintdong-platform

# 顯示容器日誌
echo ""
echo "📋 容器日誌："
docker logs --tail 20 saintdong-platform

echo ""
echo "🎉 部署成功！"
echo "📱 應用 URL: http://192.168.197.216:3000"
echo ""
echo "常用命令："
echo "  查看日誌: docker logs -f saintdong-platform"
echo "  重啟容器: docker restart saintdong-platform"
echo "  停止容器: docker stop saintdong-platform"

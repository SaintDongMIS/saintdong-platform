# SaintDong Platform - NAS 部署指南

## 方案概述

將整個 Nuxt.js 應用（前端 + 後端）部署到 Synology NAS 的 Docker 容器中運行。

## 架構圖

```
使用者瀏覽器
    ↓
http://192.168.197.216:3000
    ↓
NAS Docker 容器 (Nuxt.js App)
    ↓
內網 SQL Server (192.168.8.239:1433)
```

## 優勢

- ✅ **簡單**: 不需要 GCP，不需要代理
- ✅ **快速**: 內網直連資料庫，延遲低
- ✅ **成本**: 完全免費，利用現有 NAS
- ✅ **維護**: 一個 Docker 容器管理

## 部署步驟

### 1. 在 NAS 安裝 Docker

1. 登入 Synology DSM
2. 開啟 **套件中心**
3. 安裝 **Container Manager** (原 Docker)
4. 啟用 **SSH** 服務

### 2. 在 NAS 上 Clone 專案

SSH 連線到 NAS：

```bash
ssh admin@192.168.197.216
```

Clone 專案：

```bash
# 進入 Docker 目錄
cd /volume1/docker/

# Clone 專案
git clone https://github.com/your-username/saintdong-platform.git
cd saintdong-platform
```

### 3. 執行部署腳本

```bash
# 賦予執行權限
chmod +x deploy.sh

# 執行部署
./deploy.sh
```

部署腳本會自動：

1. 停止舊容器
2. 建構新的 Docker 映像
3. 啟動新容器
4. 顯示運行狀態

### 4. 驗證部署

開啟瀏覽器訪問：

```
http://192.168.197.216:3000
```

## 環境變數說明

容器運行時會自動設定以下環境變數：

```bash
NODE_ENV=production           # 生產環境
DB_SERVER=192.168.8.239      # 資料庫伺服器（內網 IP）
DB_PORT=1433                 # SQL Server 埠
DB_USER=sa                   # 資料庫用戶
DB_PASSWORD=dsc@23265946     # 資料庫密碼
DB_DATABASE=APIsync          # 資料庫名稱
```

## 常用操作

### 查看容器狀態

```bash
docker ps | grep saintdong
```

### 查看即時日誌

```bash
docker logs -f saintdong-platform
```

### 查看最近 100 行日誌

```bash
docker logs --tail 100 saintdong-platform
```

### 重啟容器

```bash
docker restart saintdong-platform
```

### 停止容器

```bash
docker stop saintdong-platform
```

### 進入容器

```bash
docker exec -it saintdong-platform sh
```

### 查看容器資源使用

```bash
docker stats saintdong-platform
```

## 更新應用

當有代碼更新時：

```bash
cd /volume1/docker/saintdong-platform

# 拉取最新代碼
git pull origin main

# 重新部署
./deploy.sh
```

## 設定自動更新（選配）

使用 Synology 任務排程器設定自動更新：

1. 開啟 **控制台** → **任務排程器**
2. 新增 → **排定的任務** → **使用者定義的腳本**
3. 設定：
   - 名稱：`自動更新 SaintDong Platform`
   - 使用者：`root`
   - 排程：每天凌晨 3:00
   - 腳本：
     ```bash
     cd /volume1/docker/saintdong-platform
     git pull origin main
     ./deploy.sh
     ```

## 外網訪問設定（選配）

如果需要從公司外訪問：

### 方法 1: 路由器埠轉發

在路由器設定：

- 外部埠 3000 → 內部 192.168.197.216:3000

### 方法 2: Synology QuickConnect

使用 Synology 內建的 QuickConnect 服務。

### 方法 3: VPN

使用 Synology VPN Server，透過 VPN 連線後訪問。

## 故障排除

### 問題 1: 容器啟動失敗

**檢查日誌**：

```bash
docker logs saintdong-platform
```

**常見原因**：

- 埠 3000 被占用
- 記憶體不足
- 建構失敗

### 問題 2: 無法連接資料庫

**檢查網路**：

```bash
# 進入容器測試連接
docker exec saintdong-platform nc -zv 192.168.8.239 1433
```

**常見原因**：

- 資料庫服務未啟動
- 防火牆阻擋
- 資料庫密碼錯誤

### 問題 3: 頁面無法訪問

**檢查容器狀態**：

```bash
docker ps -a | grep saintdong
```

**檢查埠映射**：

```bash
docker port saintdong-platform
```

## 效能優化

### 1. 限制容器資源

修改 `deploy.sh`，添加資源限制：

```bash
docker run -d \
  --name saintdong-platform \
  -p 3000:3000 \
  --memory="512m" \
  --cpus="1.0" \
  ...
```

### 2. 使用持久化儲存

如需持久化資料：

```bash
docker run -d \
  --name saintdong-platform \
  -p 3000:3000 \
  -v /volume1/docker/saintdong-data:/app/data \
  ...
```

## 監控建議

### 1. 設定健康檢查

可以透過 Synology 監控中心設定警報。

### 2. 日誌管理

定期清理日誌：

```bash
# 清理舊日誌
docker logs saintdong-platform > /dev/null 2>&1
```

### 3. 備份

定期備份專案目錄：

```bash
cd /volume1/docker/
tar -czf saintdong-platform-backup-$(date +%Y%m%d).tar.gz saintdong-platform
```

## 與 GCP 方案比較

| 項目     | NAS 方案     | GCP App Engine |
| -------- | ------------ | -------------- |
| 成本     | 免費         | 按用量收費     |
| 維護     | 需自行維護   | Google 維護    |
| 擴展性   | 受 NAS 限制  | 自動擴展       |
| 網路     | 內網或需設定 | 全球部署       |
| 適用場景 | 公司內部使用 | 公開服務       |

## 建議

- 🏢 **內部使用**: NAS 方案完全足夠
- 🌍 **外部訪問**: 考慮 GCP 方案
- 🔄 **混合方案**: 測試用 NAS，正式用 GCP

---

**最後更新**: 2025-10-07  
**版本**: 1.0.0

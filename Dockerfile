# 使用 Node.js 20 作為基礎映像
FROM node:20-alpine

# 設定工作目錄
WORKDIR /app

# 安裝 curl（crontab 內呼叫 API 用）與 Supercronic（容器用 cron）
# https://github.com/aptible/supercronic/releases
ENV SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/v0.2.42/supercronic-linux-amd64 \
    SUPERCRONIC_SHA1SUM=b444932b81583b7860849f59fdb921217572ece2 \
    SUPERCRONIC=supercronic-linux-amd64
# Chromium 供 COMMEET 同步（Puppeteer 登入用）
# Alpine 可能裝在 /usr/bin/chromium-browser 或 /usr/lib/chromium/chromium，統一建 symlink 到 /usr/bin/chromium
RUN apk add --no-cache curl chromium \
 && ( [ -x /usr/bin/chromium ] || ( [ -x /usr/bin/chromium-browser ] && ln -sf /usr/bin/chromium-browser /usr/bin/chromium ) || ( [ -x /usr/lib/chromium/chromium ] && ln -sf /usr/lib/chromium/chromium /usr/bin/chromium ) ) \
 && curl -fsSLO "$SUPERCRONIC_URL" \
 && echo "${SUPERCRONIC_SHA1SUM}  ${SUPERCRONIC}" | sha1sum -c - \
 && chmod +x "$SUPERCRONIC" \
 && mv "$SUPERCRONIC" "/usr/local/bin/supercronic"

# 複製 package.json 和 lock 文件
COPY package.json yarn.lock ./

# 安裝依賴
RUN yarn install --frozen-lockfile

# 複製所有文件（含 docker/entrypoint.sh、docker/crontab）
COPY . .

# 建構 Nuxt.js 應用
RUN yarn build

# COMMEET 排程 log 專用檔（與 Node 日誌分離，方便 debug）
RUN mkdir -p /var/log && touch /var/log/commeet-sync.log && chmod 666 /var/log/commeet-sync.log

# Entrypoint：先起 Supercronic，再執行原 CMD
RUN chmod +x /app/docker/entrypoint.sh
ENTRYPOINT ["/app/docker/entrypoint.sh"]

# 暴露埠號
EXPOSE 3000

# 設定環境變數（排程 6:00 以台灣時間為準）
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV TZ=Asia/Taipei

# 啟動應用
CMD ["node", ".output/server/index.mjs"]


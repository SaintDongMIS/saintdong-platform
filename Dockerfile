# 使用 Node.js 20 作為基礎映像
FROM node:20-alpine

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 lock 文件
COPY package.json yarn.lock ./

# 安裝依賴
RUN yarn install --frozen-lockfile

# 複製所有文件
COPY . .

# 建構 Nuxt.js 應用
RUN yarn build

# 暴露埠號
EXPOSE 3000

# 設定環境變數
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# 啟動應用
CMD ["node", ".output/server/index.mjs"]


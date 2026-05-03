#!/bin/sh
set -e

# 僅在 COMMEET_AUTO_SYNC_ENABLED=true 時啟動 COMMEET 排程（週一至五 08:30、14:30；國定假日由 /api/commeet/sync 內 tw-holiday 略過，見 docker/crontab）
# 未設或 false 時不啟動，僅能透過手動呼叫 /api/commeet/sync
if [ "$COMMEET_AUTO_SYNC_ENABLED" = "true" ]; then
  supercronic /app/docker/crontab &
fi

# 執行傳入的指令（原 CMD：Node 應用），成為 PID 1 以正確接收訊號
exec "$@"

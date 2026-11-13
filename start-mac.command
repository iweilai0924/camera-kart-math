#!/bin/zsh
# Mac：雙擊啟動。在本機開一個小伺服器，再用 Chrome 開啟遊戲（關掉這個視窗就停止）
cd "$(dirname "$0")"
PORT=8931
while lsof -ti tcp:$PORT >/dev/null; do PORT=$((PORT+1)); done
python3 server.py $PORT &
sleep 1
open -a "Google Chrome" "http://localhost:$PORT/index.html"
echo "鏡頭數學賽車執行中：http://localhost:$PORT/index.html（關閉此視窗即停止）"
wait

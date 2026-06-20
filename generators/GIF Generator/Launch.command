#!/bin/bash
DIR="$(dirname "$0")"
PORT=8088

# kill any existing server on this port
lsof -ti tcp:$PORT | xargs kill -9 2>/dev/null

cd "$DIR"
python3 -m http.server $PORT &
SERVER_PID=$!

# wait for the server to be ready
for i in $(seq 1 20); do
  curl -s "http://localhost:$PORT" > /dev/null && break
  sleep 0.3
done

open -a "Google Chrome" "http://localhost:$PORT"

wait $SERVER_PID

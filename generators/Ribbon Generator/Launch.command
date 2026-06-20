#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Ribbon Generator…"
python3 app.py &
SERVER_PID=$!
sleep 2
open -a "Google Chrome" http://localhost:8002
wait $SERVER_PID

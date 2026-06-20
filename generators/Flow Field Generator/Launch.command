#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Flow Field Generator…"
python3 app.py &
SERVER_PID=$!
sleep 2
open -a "Google Chrome" http://localhost:8000
wait $SERVER_PID

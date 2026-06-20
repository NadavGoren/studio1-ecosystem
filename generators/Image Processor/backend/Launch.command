#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Image Processor (Backend)…"
python3 app.py &
SERVER_PID=$!
sleep 2
open -a "Google Chrome" http://localhost:5500
wait $SERVER_PID

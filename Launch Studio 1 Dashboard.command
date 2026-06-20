#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Studio 1 Dashboard…"
python3 dashboard/launcher.py &
SERVER_PID=$!
sleep 1.5
open -a "Google Chrome" http://localhost:7777
wait $SERVER_PID

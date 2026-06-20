#!/bin/bash
# Hershey Hebrew Generator — start the local server (saves edits to font/overrides.json) and open it
cd "$(dirname "$0")"
echo "Starting Hershey Hebrew Generator…"
python3 server.py &
SERVER_PID=$!
sleep 1
open -a "Google Chrome" http://localhost:8095
wait $SERVER_PID

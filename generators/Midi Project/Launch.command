#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Midi Project…"
python3 app.py &
SERVER_PID=$!
sleep 2
open -a "Google Chrome" http://localhost:5050
wait $SERVER_PID

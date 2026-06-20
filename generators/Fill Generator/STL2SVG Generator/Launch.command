#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Fill Generator (STL2SVG)…"
python3 server.py &
SERVER_PID=$!
sleep 2
open -a "Google Chrome" http://localhost:8001/3d-generator.html
wait $SERVER_PID

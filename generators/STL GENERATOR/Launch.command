#!/bin/bash
cd "$(dirname "$0")/stl-generator"
echo "Starting STL Generator…"
npm run dev &
SERVER_PID=$!
sleep 5
open -a "Google Chrome" http://localhost:5173
wait $SERVER_PID

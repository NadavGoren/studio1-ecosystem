#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Hatch Generator…"
npm run dev &
SERVER_PID=$!
sleep 5
open -a "Google Chrome" http://localhost:4000
wait $SERVER_PID

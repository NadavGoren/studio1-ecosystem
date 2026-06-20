#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Studio 1 Tracker…"
npm start &
SERVER_PID=$!
sleep 3
open -a "Google Chrome" http://localhost:3137
wait $SERVER_PID

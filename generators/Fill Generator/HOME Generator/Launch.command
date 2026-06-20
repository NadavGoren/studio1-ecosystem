#!/bin/bash
cd "$(dirname "$0")"
echo "Starting HOME Generator on port 3002…"
npm run dev -- --port 3002 &
SERVER_PID=$!
sleep 5
open -a "Google Chrome" http://localhost:3002
wait $SERVER_PID

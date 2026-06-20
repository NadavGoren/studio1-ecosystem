#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Image Processor (Frontend) on port 5174…"
npm run dev -- --port 5174 &
SERVER_PID=$!
sleep 5
open -a "Google Chrome" http://localhost:5174
wait $SERVER_PID

#!/bin/bash
# Agamograph — double-click launcher
cd "$(dirname "$0")"
echo "Starting Agamograph…"
if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run)…"
  npm install
fi
npm run dev &
SERVER_PID=$!
sleep 5
open -a "Google Chrome" http://localhost:5180
wait $SERVER_PID

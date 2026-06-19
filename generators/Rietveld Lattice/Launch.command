#!/bin/bash
# Rietveld Lattice — double-click launcher
cd "$(dirname "$0")"
echo "Starting Rietveld Lattice…"
if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run)…"
  npm install
fi
npm run dev &
SERVER_PID=$!
sleep 5
open -a "Google Chrome" http://localhost:6060
wait $SERVER_PID

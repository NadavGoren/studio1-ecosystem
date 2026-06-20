#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Image Processor — backend + frontend…"

(cd backend && python3 app.py) &
BACKEND_PID=$!

(cd frontend && npm run dev -- --port 5174) &
FRONTEND_PID=$!

sleep 5
open -a "Google Chrome" http://localhost:5174

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait

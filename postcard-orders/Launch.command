#!/bin/bash
# Double-click to run the postcard order tracker locally.
cd "$(dirname "$0")" || exit 1
[ -d node_modules ] || npm install
open "http://localhost:6120"
exec npm run dev

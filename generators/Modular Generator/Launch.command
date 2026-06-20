#!/bin/bash
# Double-click to open the Modular generator in Chrome (no server needed).
cd "$(dirname "$0")"
open -a "Google Chrome" "$(pwd)/index.html"

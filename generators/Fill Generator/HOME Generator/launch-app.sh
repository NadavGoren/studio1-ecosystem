#!/bin/bash

# HOME Generator Launcher Script
# This script starts the dev server and opens Chrome

# Project directory (this script's location)
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
URL="http://localhost:3000"

# Change to project directory
cd "$PROJECT_DIR"

# Check if node_modules exists, if not run npm install
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "Port 3000 is already in use. Opening browser..."
    # Just open the browser since server is already running
    open -a "Google Chrome" "$URL"
else
    echo "Starting development server..."
    # Start the dev server in a new Terminal window so user can see logs
    osascript -e "tell application \"Terminal\"" \
              -e "do script \"cd '$PROJECT_DIR' && npm run dev\"" \
              -e "end tell"
    
    # Wait a few seconds for the server to start
    echo "Waiting for server to start..."
    sleep 5
    
    # Open Chrome with the URL
    open -a "Google Chrome" "$URL"
fi






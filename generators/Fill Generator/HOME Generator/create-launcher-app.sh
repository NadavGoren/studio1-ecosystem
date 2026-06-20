#!/bin/bash

# Script to automatically create the launcher app using osacompile

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APPLESCRIPT_PATH="$SCRIPT_DIR/launch-app.applescript"
APP_NAME="HOME Generator Launcher"
OUTPUT_PATH="$HOME/Desktop/$APP_NAME.app"

echo "Creating launcher app..."

# Compile the AppleScript into an app
osacompile -o "$OUTPUT_PATH" "$APPLESCRIPT_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Success! Launcher app created at: $OUTPUT_PATH"
    echo "You can now double-click '$APP_NAME' on your Desktop to launch the app!"
else
    echo "❌ Error creating app. Please try creating it manually using Script Editor."
    exit 1
fi






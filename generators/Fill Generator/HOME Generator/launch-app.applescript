-- HOME Generator Launcher AppleScript
-- This can be saved as an application in macOS

-- Project directory (hardcoded for reliability)
set projectPath to "/Users/nadavgoren/Desktop/סטודיו/Fill Generator/HOME Generator"

set theURL to "http://localhost:3000"

-- Check if node_modules exists
set nodeModulesPath to projectPath & "/node_modules"
tell application "System Events"
    set nodeModulesExists to exists folder nodeModulesPath
end tell

if not nodeModulesExists then
    display dialog "Installing dependencies. This may take a moment..." buttons {"OK"} default button 1 giving up after 2
    try
        do shell script "cd '" & projectPath & "' && npm install" without altering line endings
    on error
        display dialog "Error installing dependencies. Please run 'npm install' manually." buttons {"OK"} default button 1
        return
    end try
end if

-- Check if port 3000 is already in use
try
    do shell script "lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1"
    set serverRunning to true
on error
    set serverRunning to false
end try

if serverRunning then
    -- Server is already running, just open the browser
    tell application "Google Chrome"
        activate
        open location theURL
    end tell
else
    -- Start the dev server in a new Terminal window
    tell application "Terminal"
        activate
        do script "cd '" & projectPath & "' && npm run dev"
    end tell
    
    -- Wait a moment for the server to start
    delay 5
    
    -- Open Chrome
    tell application "Google Chrome"
        activate
        open location theURL
    end tell
end if


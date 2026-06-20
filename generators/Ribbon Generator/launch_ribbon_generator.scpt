-- Ribbon Generator Launcher
-- This script starts the Flask app and opens it in Chrome

set appPath to "/Users/nadavgoren/Desktop/סטודיו/Ribbon Generator"
set appURL to "http://localhost:8000"

-- Build the command to run
set shellCmd to "cd " & quoted form of appPath & " && python3 app.py"

-- Start the Flask app in Terminal
tell application "Terminal"
	activate
	do script shellCmd
end tell

-- Wait for the server to start (3 seconds should be enough)
delay 3

-- Open the URL in Google Chrome
tell application "Google Chrome"
	activate
	if (count of windows) is 0 then
		make new window
		set URL of active tab of front window to appURL
	else
		tell front window
			make new tab with properties {URL:appURL}
		end tell
	end if
end tell

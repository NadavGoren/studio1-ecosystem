-- Launch Hatch Generator App
-- This script opens Terminal and runs the Vite development server
-- Then opens Chrome browser to localhost:4000

tell application "Terminal"
	activate
	-- Open a new terminal window and start the Vite dev server
	set newTab to do script "cd '/Users/nadavgoren/Desktop/סטודיו/Hatch Generator' && npm run dev"
end tell

-- Wait a few seconds for the Vite server to start
delay 4

-- Open Chrome with the localhost URL
tell application "Google Chrome"
	activate
	open location "http://localhost:4000"
end tell








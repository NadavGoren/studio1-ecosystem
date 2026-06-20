# HOME Generator Launcher Setup Guide

This guide will help you create a clickable macOS app shortcut to launch the HOME Generator development server.

## Option 1: AppleScript Application (Recommended)

This creates a native macOS app you can double-click.

### Steps:

1. **Open Script Editor**
   - Press `Cmd + Space` to open Spotlight
   - Type "Script Editor" and open it

2. **Open the AppleScript file**
   - In Script Editor: File → Open
   - Navigate to the project folder
   - Open `launch-app.applescript`

3. **Save as Application**
   - File → Export
   - File Format: Choose "Application"
   - Name it "HOME Generator Launcher" (or whatever you prefer)
   - Save it anywhere you like (Desktop, Applications folder, etc.)
   - Make sure "Stay open after run handler" is **NOT** checked

4. **Optional: Change the icon**
   - Right-click the app → Get Info
   - Drag an icon image to the icon in the top-left corner of the Get Info window

5. **Double-click to use!**

## Option 2: Shell Script with Automator

If you prefer using Automator (which you mentioned you've used):

1. **Open Automator**
   - Press `Cmd + Space` and type "Automator"

2. **Create New Application**
   - Choose "Application" as the document type

3. **Add Actions**
   - Search for "Run Shell Script" and drag it to the workflow
   - In the shell script box, paste this:
   ```bash
   cd "/Users/nadavgoren/Desktop/סטודיו/Fill Generator/HOME Generator"
   
   # Check if node_modules exists
   if [ ! -d "node_modules" ]; then
       npm install
   fi
   
   # Check if server is already running
   if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
       open -a "Google Chrome" "http://localhost:3000"
   else
       # Start server in new Terminal window
       osascript -e "tell application \"Terminal\"" \
                 -e "do script \"cd '/Users/nadavgoren/Desktop/סטודיו/Fill Generator/HOME Generator' && npm run dev\"" \
                 -e "end tell"
       sleep 5
       open -a "Google Chrome" "http://localhost:3000"
   fi
   ```
   - Set "Shell" to `/bin/bash`
   - Set "Pass input" to "as arguments"

4. **Add "Open URLs" action** (optional alternative)
   - Search for "Open URLs" and drag it after the shell script
   - Set URL to: `http://localhost:3000`
   - Change "Open URLs in:" to "Google Chrome"

5. **Save the Application**
   - File → Save
   - Name it "HOME Generator Launcher"
   - Save anywhere you like

## Option 3: Quick Action (Services Menu)

You can also add it to your Services menu:

1. Open Automator
2. Choose "Quick Action" instead of "Application"
3. Set "Workflow receives" to "no input"
4. Add the same shell script from Option 2
5. Save as "Launch HOME Generator"
6. Access via: Right-click anywhere → Services → Launch HOME Generator

## Troubleshooting

- **"npm: command not found"**: Make sure Node.js is installed and in your PATH
- **Port already in use**: The launcher will detect this and just open the browser
- **Chrome doesn't open**: Make sure Google Chrome is installed. If you use a different browser, change "Google Chrome" to "Safari" or "Firefox" in the scripts

## Customization

You can modify the scripts to:
- Use a different browser (Safari, Firefox, etc.)
- Change the port number
- Add additional startup commands
- Customize the Terminal window appearance






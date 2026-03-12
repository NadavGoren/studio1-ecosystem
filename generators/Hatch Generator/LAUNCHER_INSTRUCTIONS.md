# Hatch Generator App Launcher Instructions

This guide explains how to easily launch the Hatch Generator app without using terminal commands.

## Option 1: AppleScript Application (Recommended)

This creates a double-clickable application that opens Terminal and runs the Vite development server.

### Steps to Create the App:

1. **Open Script Editor**
   - Press `Cmd + Space` to open Spotlight
   - Type "Script Editor" and press Enter
   - Or find it in Applications → Utilities → Script Editor

2. **Open the AppleScript File**
   - In Script Editor, go to File → Open
   - Navigate to: `/Users/nadavgoren/Desktop/סטודיו/Hatch Generator/`
   - Open `launch_hatch_generator.applescript`

3. **Save as Application**
   - Go to File → Export (or File → Save As)
   - In the "File Format" dropdown, select "Application"
   - Name it "Hatch Generator" (or any name you prefer)
   - Choose where to save it (Desktop or Applications folder)
   - Click "Save"

4. **Use the App**
   - Double-click the "Hatch Generator" icon
   - A Terminal window will open and start the Vite development server
   - The app will automatically open in Chrome at `http://localhost:4000`
   - To stop the server, press `Ctrl+C` in the Terminal window

### Optional: Add to Dock
- Drag the "Hatch Generator" icon to your Dock for quick access
- You can also add it to your Desktop for easy access

---

## Option 2: Shell Script (Simpler Alternative)

This is a simpler option that works immediately without any setup.

### Steps:

1. **Create a Shell Script**
   - Create a new file named `start_hatch_generator.command` in the project directory
   - Add the following content:
   ```bash
   #!/bin/bash
   cd '/Users/nadavgoren/Desktop/סטודיו/Hatch Generator'
   npm run dev
   ```

2. **Make it Executable**
   - Open Terminal
   - Run: `chmod +x "/Users/nadavgoren/Desktop/סטודיו/Hatch Generator/start_hatch_generator.command"`

3. **Use the Script**
   - Double-click `start_hatch_generator.command` in Finder
   - A Terminal window will open and start the Vite server
   - The app will be available at `http://localhost:4000`
   - To stop the server, press `Ctrl+C` in the Terminal window

### Optional: Add to Dock or Desktop
- Right-click `start_hatch_generator.command` → Make Alias
- Drag the alias to your Desktop or Dock
- Rename it to "Hatch Generator" or "Start Hatch Generator" if you want

---

## Troubleshooting

### If double-clicking doesn't work:

**For `.command` files:**
- Right-click the file → Get Info
- Under "Open with:", select "Terminal"
- Click "Change All..." if you want this for all `.command` files

**For AppleScript apps:**
- Right-click the app → Get Info
- Check "Open in Low Resolution" if you have display issues
- Make sure Script Editor saved it as an Application, not a Script

### If you get "Permission Denied" error:
- Open Terminal
- Run: `chmod +x "/Users/nadavgoren/Desktop/סטודיו/Hatch Generator/start_hatch_generator.command"`

### If the server doesn't start:
- Make sure Node.js is installed: `node --version`
- Make sure npm is installed: `npm --version`
- Install dependencies: `npm install` (run this once in the project directory)
- Check that you're in the correct directory

---

## Quick Reference

- **Server URL:** http://localhost:4000
- **Port:** 4000 (configured in vite.config.ts)
- **Stop Server:** Press `Ctrl+C` in the Terminal window
- **Check if running:** Visit http://localhost:4000 in your browser

---

## Which Option Should I Use?

- **Option 1 (AppleScript App):** Better if you want a proper application icon, automatic browser opening, and more control
- **Option 2 (Shell Script):** Faster to set up, works immediately, simpler

Both options work equally well - choose whichever you prefer!








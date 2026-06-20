# How to Run the 3D Cube Generator

The animation feature requires loading external libraries (FFmpeg.wasm) from a CDN. To enable all features (including SharedArrayBuffer for faster processing), you need to run the app through a local web server with proper headers.

## ⭐ RECOMMENDED: Custom Python Server (Easiest & Full Featured)

We've included a custom server that enables all required features:

```bash
cd "3D Cube Generator"
python3 server.py
```

Then open: **http://localhost:8001/3d-generator.html**

This server enables:
- ✅ CORS headers (allows loading FFmpeg from CDN)
- ✅ SharedArrayBuffer support (for browser features)
- ✅ ES6 modules
- ✅ All browser security features

**This is the best option!** It's just as easy as the basic Python server but works reliably.

---

## Alternative Options (if you can't use the custom server)

### Option 1: Basic Python Server (Slower but works)

```bash
cd "3D Cube Generator"
python3 -m http.server 8001
```

Then open: http://localhost:8001/3d-generator.html

⚠️ **Note**: This may cause CORS errors when loading FFmpeg. Use the custom `server.py` instead for reliable operation.

## Option 2: Node.js - http-server

Install globally:
```bash
npm install -g http-server
```

Run:
```bash
cd "3D Cube Generator"
http-server -p 8001 --cors
```

Then open: http://localhost:8001/3d-generator.html

## Option 3: VS Code Live Server Extension

1. Install the "Live Server" extension in VS Code
2. Right-click on `3d-generator.html`
3. Select "Open with Live Server"

The page will automatically open in your browser.

## Option 4: PHP (if installed)

```bash
cd "3D Cube Generator"
php -S localhost:8001
```

Then open: http://localhost:8001/3d-generator.html

## Why Can't I Just Open the HTML File?

When you open an HTML file directly (using `file://` protocol), browsers apply strict security restrictions that:
- Block loading ES6 modules
- Prevent cross-origin requests to CDNs
- Disable SharedArrayBuffer (required by FFmpeg.wasm)

A local web server (`http://localhost`) bypasses these restrictions while still running locally on your computer.

## Verifying It's Working

1. Open the browser console (F12 or Cmd+Option+I)
2. You should see:
   - No CORS errors
   - `[FFmpeg]` log messages when generating video
   - Module imports working correctly

## Troubleshooting

### "Failed to fetch" error
- **Solution**: Make sure you're using one of the server methods above, not opening the file directly

### "Worker cannot be accessed from origin" error
- **Solution**: Make sure you're using `python3 server.py` not the basic Python server
- The custom server includes CORS headers that fix this issue

### Still having issues?
1. Check your internet connection (FFmpeg needs to download ~30MB on first use)
2. Clear browser cache and reload
3. Try a different browser (Chrome usually works best)
4. Check browser console for detailed error messages

## Recommended Setup

**Best option for most users:**
```bash
# Open terminal in the "3D Cube Generator" folder
python3 server.py
```

Then bookmark: **http://localhost:8001/3d-generator.html**

Keep the terminal window open while using the app. Press Ctrl+C to stop the server when done.

## Quick Start (Copy & Paste)

Open Terminal/Command Prompt and paste:

**macOS/Linux:**
```bash
cd "/Users/nadavgoren/Desktop/סטודיו/Fill Generator/3D Cube Generator" && python3 server.py
```

**Windows (Command Prompt):**
```cmd
cd "C:\path\to\Fill Generator\3D Cube Generator" && python server.py
```

**Windows (PowerShell):**
```powershell
cd "C:\path\to\Fill Generator\3D Cube Generator"; python server.py
```


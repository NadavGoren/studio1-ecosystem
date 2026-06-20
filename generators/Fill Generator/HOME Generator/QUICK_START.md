# Quick Start - HOME Generator Launcher

## ✅ Your Launcher App is Ready!

I've created a launcher app for you at:
**`~/Desktop/HOME Generator Launcher.app`**

Just **double-click it** to:
1. ✅ Start the development server
2. ✅ Open Chrome with `http://localhost:3000`
3. ✅ Handle port conflicts automatically
4. ✅ Install dependencies if needed

## What it does:

- **Checks if the server is already running** - if port 3000 is in use, it just opens the browser
- **Installs dependencies automatically** - runs `npm install` if `node_modules` is missing
- **Starts the dev server** - opens a Terminal window with `npm run dev`
- **Opens Chrome** - automatically navigates to `http://localhost:3000`

## Customization

To change the browser or port, edit:
- `launch-app.applescript` (for the app version)
- `launch-app.sh` (for the shell script version)

Then recreate the app by running:
```bash
./create-launcher-app.sh
```

Or manually:
1. Open Script Editor
2. Open `launch-app.applescript`
3. File → Export → Application

## Alternative: Quick Terminal Command

You can also use the shell script directly:
```bash
./launch-app.sh
```

---

Enjoy your one-click launcher! 🚀






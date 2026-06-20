# Quick Start: STL Integration 🚀

## In 3 Simple Steps

### 1️⃣ Start the Server (30 seconds)

Open Terminal and run:
```bash
cd "/Users/nadavgoren/Desktop/סטודיו/Fill Generator/STL2SVG Generator"
python3 server.py
```

Then open: **http://localhost:8001/3d-generator.html**

---

### 2️⃣ Load Your STL File (10 seconds)

Look for the **"Model"** section in the left sidebar.

**Option A: Drag & Drop**
- Drag your `.stl` file onto the drop zone 📦

**Option B: Click to Browse**
- Click the drop zone
- Select your `.stl` file

**Try the Test File:**
- Use `test-cube.stl` (already in the folder)

---

### 3️⃣ Customize & Export (2 minutes)

**What You Can Do:**

✨ **Rotate**: Drag the preview to orbit  
📏 **Resize**: Use "Object Size" slider  
🎨 **Shade**: Adjust lighting and hatching  
💾 **Export**: Click "Export SVG" or "Generate Video"  

**All the original features work with STL:**
- Hatching patterns
- Cross-hatching
- Gradient shading
- Shadows
- Line jitter
- Color per face
- Lighting controls

---

## 🎯 Quick Tips

### Switching Modes
- **Cube Mode** ➡️ **STL Mode**: Upload an STL file
- **STL Mode** ➡️ **Cube Mode**: Click "🗑️ Clear STL"

### File Size
- **Small files** (< 10K triangles): ⚡ Lightning fast
- **Medium files** (10K-100K triangles): 🚗 Smooth
- **Large files** (100K+ triangles): 🐢 May be slow

### Best Results
1. Use **binary STL** format (smaller, faster)
2. Keep triangle count reasonable (< 50K recommended)
3. Enable **Advanced Shading** for gradient effects
4. Adjust **Shadow Falloff** for softer shadows

---

## 📊 What You'll See

### Cube Mode (Default)
```
┌─────────────────────────┐
│      Model              │
├─────────────────────────┤
│  Current Mode           │
│  🧊 Cube Mode           │
│                         │
│  ┌──────────────────┐   │
│  │   📦             │   │
│  │ Drop STL Here    │   │
│  │ or click browse  │   │
│  └──────────────────┘   │
└─────────────────────────┘
```

### STL Mode (After Upload)
```
┌─────────────────────────┐
│      Model              │
├─────────────────────────┤
│  Current Mode           │
│  📦 STL Mode            │
│                         │
│  Loaded: my-model.stl   │
│  Triangles: 15,234      │
│  Vertices: 7,890        │
│  Size: 50×30×20 mm      │
│                         │
│  [ 🗑️ Clear STL ]       │
└─────────────────────────┘
```

---

## ✅ Verification Checklist

Test everything works:

- [ ] Cube renders on page load
- [ ] Can drag to rotate cube
- [ ] Can upload STL file
- [ ] STL file info appears
- [ ] STL model renders with hatching
- [ ] Can rotate STL view
- [ ] Can adjust size slider
- [ ] Lighting controls work
- [ ] Shadow toggle works
- [ ] Can export SVG
- [ ] Can clear STL and return to cube

---

## 🎓 Learn More

- **Full Documentation**: See `STL_INTEGRATION_COMPLETE.md`
- **Original Guide**: See `STL_INTEGRATION_GUIDE.md`
- **General Help**: See `README.md`

---

## 🆘 Common Issues

### "Address already in use"
✅ Server is already running! Just open the browser.

### "Failed to parse STL"
❌ File might be corrupted or not a valid STL.
- Try opening in a 3D viewer first (e.g., MeshLab, Blender)
- Re-export from your 3D software

### Rendering is slow
🐢 File might be too large.
- Check triangle count in the mesh info panel
- Try simplifying the mesh in a 3D tool

### Can't see the model
👁️ Check these:
- Is "Show Edges" enabled? (for wireframe)
- Is lighting too bright? (everything white)
- Is the model very small or very large? (adjust size)

---

## 🎉 You're Ready!

Start by loading `test-cube.stl` to verify everything works.

Then try your own STL files from:
```
/Users/nadavgoren/Desktop/סטודיו/STL GENERATOR/stl-generator/public/3D Assets/
```

**Happy rendering!** ✨🎨









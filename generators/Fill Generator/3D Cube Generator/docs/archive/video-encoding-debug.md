# Video Encoding Debug Guide

## Current Issue: 0-Byte Video Files

The video export is creating files but they're 0 bytes, which means FFmpeg encoding is failing silently.

## Critical: Check Browser Console

**You MUST check the browser console (F12) to see what's happening.**

### Step 1: Open Console
1. Press **F12** (or right-click → Inspect)
2. Click the **Console** tab
3. **Clear the console** (trash icon or Ctrl+L)

### Step 2: Generate Video
1. Set Animation: 24 frames, 12 FPS (quick test)
2. Click "Generate Video"
3. **Watch the console** - don't close it!

### Step 3: Look For These Messages

#### ✅ Good Signs:
- "✓ Verified first frame exists: X bytes"
- "✓ All X frames written to FFmpeg filesystem"
- "FFmpeg command: ..."
- "✓ FFmpeg run() completed"
- "✓ Video file read: X MB"

#### ❌ Bad Signs:
- "✗ First frame not found"
- "FFmpeg run() error: ..."
- "Output file is empty"
- Any red error messages

## What to Share

When reporting the issue, please share:

1. **All console messages** (copy/paste or screenshot)
2. **Any red error messages**
3. **The "FFmpeg command:" line** - shows the exact command
4. **File size messages** - shows if frames are being written

## Common Issues

### Issue 1: Frames Not Being Written
**Symptom:** "✗ First frame not found"

**Solution:** Frame generation is failing. Check if SVG rendering works.

### Issue 2: FFmpeg Command Failing
**Symptom:** "FFmpeg run() error: ..."

**Solution:** The error message will tell us what's wrong. Share it.

### Issue 3: FFmpeg Completes But File is Empty
**Symptom:** "✓ FFmpeg run() completed" but file is 0 bytes

**Possible Causes:**
- FFmpeg.wasm version issue
- Invalid PNG frames
- Memory issue
- FFmpeg command syntax

**Solution:** Check console for FFmpeg's internal messages (they appear in console when setLogging(true) is used)

## Next Steps

1. **Open console (F12)**
2. **Generate video**
3. **Copy ALL console output**
4. **Share it** so we can see exactly what's happening

Without console output, we can't diagnose the issue. The console will show:
- If frames are valid PNGs
- If FFmpeg is running
- What FFmpeg is doing
- Any errors

---

**The console is the key to solving this!**



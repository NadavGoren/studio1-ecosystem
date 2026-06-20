# Turntable Animation Feature - Complete Implementation

## Overview

The turntable animation feature allows you to create time-lapse videos of the 3D cube rotating around its axis. The feature exports MP4 videos directly to your Downloads folder.

## How to Use

### 1. Access the Animation Controls

Open the 3D Cube Generator in your browser and find the **"Animation"** section in the left sidebar (below the "Display" section).

### 2. Configure Animation Parameters

- **Start Angle (°):** Beginning rotation angle (0-360°)
- **End Angle (°):** Ending rotation angle (0-360°)
- **Number of Frames:** How many frames to generate (12-360)
  - More frames = smoother animation but longer generation time
  - Recommended: 60-120 frames for good quality
- **Frames Per Second (FPS):** Playback speed
  - 12 FPS: Slow, cinematic
  - 24 FPS: Standard film
  - 30 FPS: Smooth video (recommended)
  - 60 FPS: Very smooth, fast playback
- **Duration:** Auto-calculated (Frames ÷ FPS)

### 3. Generate Video

1. Click the **"Generate Video"** button
2. Wait while the system:
   - Loads FFmpeg library (first time only, ~30MB)
   - Generates each frame
   - Encodes frames into MP4 video
3. Video automatically downloads to your Downloads folder
4. Filename format: `cube_turntable_YYYY-MM-DD_HH-MM-SS.mp4`

### 4. Progress Tracking

While generating, you'll see:
- Progress bar showing completion percentage
- Status messages:
  - "Loading FFmpeg library..."
  - "Generating frame X/Y..."
  - "Encoding video..."
  - "Video downloaded successfully!"

## Example Configurations

### Quick Preview (Fast Generation)
- Start: 0°, End: 360°
- Frames: 24, FPS: 12
- Duration: 2.0 seconds
- Generation time: ~30 seconds

### Standard Quality (Recommended)
- Start: 0°, End: 360°
- Frames: 120, FPS: 30
- Duration: 4.0 seconds
- Generation time: ~2-3 minutes

### High Quality (Smooth)
- Start: 0°, End: 360°
- Frames: 180, FPS: 60
- Duration: 3.0 seconds
- Generation time: ~3-4 minutes

### Partial Rotation
- Start: 0°, End: 90°
- Frames: 30, FPS: 30
- Duration: 1.0 second
- Shows quarter turn only

## Technical Details

### Video Specifications
- Format: MP4 (H.264)
- Resolution: Based on canvas size at 96 DPI
  - A3 (420×297mm) = ~1587×1123 pixels
  - A4 (297×210mm) = ~1123×794 pixels
- Color: Full color (matches your cube face colors)
- Quality: CRF 23 (high quality)
- Processing: Single-threaded (reliable across all setups)

### Browser Requirements
- Modern browser (Chrome, Firefox, Safari, Edge)
- JavaScript ES6 modules support
- ~100MB free RAM for processing

### Performance Notes
- First use: Downloads FFmpeg.wasm (~30MB) from CDN
- Subsequent uses: Uses cached library (much faster)
- Generation time depends on:
  - Frame count (more = slower)
  - Canvas size (larger = slower)
  - Computer performance

## Tips & Tricks

1. **Start Small:** Test with 24 frames before generating large videos
2. **Balance Quality vs Time:** 120 frames @ 30fps is a good sweet spot
3. **Customize First:** Set up colors, lighting, and shadows before generating
4. **Full Rotation:** Use 0° to 360° for complete turntable effect
5. **Reverse Rotation:** Set End angle < Start angle for counter-clockwise
6. **Patience:** High-quality videos take time to generate

## Troubleshooting

### CORS / Worker Loading Errors

**Solution**: Use the included `server.py` instead of the basic Python server:

```bash
# Stop your current server (Ctrl+C)
# Then run:
cd "3D Cube Generator"
python3 server.py
```

The custom server sends proper CORS headers that allow loading external libraries.

**Why?** The basic `python3 -m http.server` doesn't send CORS headers, causing issues with CDN resources. Our custom server fixes this.

### "FFmpeg loading failed"
- Check internet connection (needs to download from CDN)
- Try refreshing the page
- Check browser console for errors
- Make sure you're running with `python3 server.py`

### "Failed to generate video"
- Ensure frame count is between 12-360
- Check start and end angles are different
- Try with fewer frames first
- Verify you're using the custom server (not basic Python server)

### Video is choppy
- Increase frame count
- Try higher FPS
- Reduce angle range for slower rotation

### Generation is slow
- Normal for high frame counts
- Close other browser tabs
- Consider reducing frames or canvas size

## Files Modified

This feature was implemented across these files:
- `3d-generator.html` - Animation UI controls
- `3d-generator.css` - Animation section styling
- `src/export/videoExporter.js` - Video generation logic (NEW)
- `src/ui/controls.js` - Animation control handlers
- `3d-generator.js` - Video exporter integration

## Support

For testing instructions and detailed test cases, see `ANIMATION_FEATURE_TEST.md`

---

**Enjoy creating your turntable animations! 🎬**


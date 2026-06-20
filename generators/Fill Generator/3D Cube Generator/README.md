# 3D Isometric Cube Generator

A professional web-based tool for generating 3D isometric cube line art with advanced shading, lighting, and export capabilities. Perfect for creating plotter-ready SVG files and turntable animations.

## Quick Start

1. **Start the server:**
   ```bash
   cd "3D Cube Generator"
   python3 server.py
   ```

2. **Open in browser:**
   Navigate to `http://localhost:8001/3d-generator.html`

3. **Generate your cube:**
   - Adjust canvas size, cube size, and rotation
   - Configure lighting and shading
   - Click "Download SVG" to export

For detailed setup instructions, see [HOW_TO_RUN.md](HOW_TO_RUN.md).

## Features

### Core Features
- **3D Cube Rendering**: Isometric and perspective projection modes
- **Interactive Controls**: Drag to rotate, tool-based canvas manipulation
- **Advanced Shading**: Gradient-based shading with adaptive hatch line density
- **Lighting System**: Adjustable light angle, elevation, brightness, and ambient light
- **Shadow Projection**: Realistic floor shadows with soft edges and falloff control
- **Line Jitter**: Optional wavy line effects for hand-drawn appearance
- **Cross-Hatch**: Perpendicular hatch lines for enhanced shading
- **Color Layers**: Per-face color control or single color mode
- **SVG Export**: Plotter-ready SVG with layer organization
- **Video Export**: Turntable animation generation (MP4)

### Canvas & Tools
- **Paper Presets**: A3, A4, A5, A6, and custom sizes
- **Orientation Toggle**: Portrait/landscape switching
- **Canvas Tools**: Rotate tool (R) and Move tool (V) with keyboard shortcuts
- **Margins**: Adjustable drawing boundaries
- **3D Grid**: Optional isometric reference grid

### Advanced Features
- **Advanced Shading Mode**: Per-region gradient shading with key point interpolation
- **Adaptive Hatch Density**: Variable-density hatch lines based on local shading
- **Shadow Soft Edges**: Directional blur layers for realistic shadow falloff
- **Debug Tools**: Occlusion visualization and fine-tuning controls

## Documentation

### Main Documentation
- **[requirements.md](requirements.md)** - Complete functional specification (single source of truth)
- **[HOW_TO_RUN.md](HOW_TO_RUN.md)** - Setup and running instructions
- **[CHANGELOG.md](CHANGELOG.md)** - Historical fixes and changes

### Feature Documentation
- **[docs/features/animation.md](docs/features/animation.md)** - Animation and video export guide
- **[docs/features/canvas-tools.md](docs/features/canvas-tools.md)** - Canvas tools (Rotate/Move) documentation
- **[docs/features/line-jitter.md](docs/features/line-jitter.md)** - Line jitter feature guide

### Architecture
- **Modular Structure**: Organized into focused modules (`src/core/`, `src/rendering/`, `src/ui/`, etc.)
- **File Mapping**: See `requirements.md` Section "FEATURE-TO-FILE MAPPING" for complete module responsibilities
- **Module Responsibilities**: See `requirements.md` Section "MODULE RESPONSIBILITIES" for detailed breakdown

## Project Structure

```
3D Cube Generator/
├── README.md                    ← You are here
├── requirements.md             ← Complete specification
├── HOW_TO_RUN.md               ← Setup instructions
├── CHANGELOG.md                ← Historical changes
├── 3d-generator.html           ← Main UI
├── 3d-generator.js             ← Entry point
├── 3d-generator.css            ← Styling
├── server.py                   ← Custom Python server
└── src/
    ├── core/                   ← Core geometry & math
    │   ├── constants.js
    │   ├── geometry.js
    │   ├── projection.js
    │   └── transformations.js
    ├── lighting/               ← Lighting calculations
    │   ├── lightCalculation.js
    │   └── gradientShading.js
    ├── rendering/              ← Rendering engine
    │   ├── renderer.js
    │   ├── clipping.js
    │   └── grid.js
    ├── shading/                ← Shading effects
    │   ├── hatchLines.js
    │   └── shadow.js
    ├── ui/                     ← User interface
    │   ├── canvas.js
    │   ├── controls.js
    │   └── updates.js
    ├── export/                 ← Export functionality
    │   ├── svgExporter.js
    │   └── videoExporter.js
    └── utils/                  ← Utilities
        └── jitter.js
```

## Key Controls

### Keyboard Shortcuts
- **R**: Switch to Rotate tool
- **V**: Switch to Move tool

### Mouse Interactions
- **Rotate Tool**: Drag horizontally to rotate cube
- **Move Tool**: Drag in any direction to reposition artwork
- **Canvas**: Click and drag on preview area

### Quick Settings
- **Canvas Presets**: A3 (default), A4, A5, A6, Custom
- **View Mode**: Isometric (default) or Perspective
- **Advanced Shading**: Enabled by default
- **Line Jitter**: Disabled by default

## Export Options

### SVG Export
- **Format**: SVG with proper namespaces
- **Layers**: Organized by face when using per-face colors
- **Dimensions**: Exact canvas dimensions in millimeters
- **Filtering**: Preview-only elements (grid, boundaries) excluded

### Video Export
- **Format**: MP4 (H.264)
- **Resolution**: Based on canvas size at 96 DPI
- **Quality**: High quality (CRF 23)
- **Generation**: Frame-by-frame rendering with FFmpeg encoding

## Browser Requirements

- Modern browser (Chrome, Firefox, Safari, Edge)
- JavaScript ES6 modules support
- Local web server required (use included `server.py`)
- ~100MB free RAM for video generation

## Performance Notes

- **Rendering**: Optimized for 60 FPS during interaction
- **Video Generation**: CPU-intensive, may take 2-4 minutes for high-quality videos
- **First Use**: Downloads FFmpeg.wasm (~30MB) from CDN
- **Subsequent Uses**: Uses cached library (much faster)

## Troubleshooting

### Server Issues
- Use `python3 server.py` (not basic Python server)
- Custom server includes required CORS headers
- See [HOW_TO_RUN.md](HOW_TO_RUN.md) for alternatives

### Video Generation
- Requires internet connection for first-time FFmpeg download
- Check browser console for errors
- Ensure sufficient RAM available

### Rendering Issues
- Check browser console for errors
- Verify all modules load correctly
- Try refreshing the page

## Contributing

When adding new features:
1. Update `requirements.md` first (single source of truth)
2. Document in appropriate `docs/features/` file if needed
3. Add entry to `CHANGELOG.md` for significant changes
4. Update this README if adding major features

## License

This project is part of the Fill Generator suite.

---

**For complete specifications, see [requirements.md](requirements.md)**



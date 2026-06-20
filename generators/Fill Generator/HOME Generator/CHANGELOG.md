# Changelog

All notable changes to the HOME Generator project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-11-19

### 🎉 Initial Release

#### Added - Core System
- Complete TypeScript implementation with full type safety
- Millimeter-based coordinate system for plotter compatibility
- Seeded random number generator (mulberry32 algorithm) for deterministic generation
- Canvas size system with A3, A4, A5 presets and custom dimensions
- Portrait and landscape orientation support
- SVG export with proper viewBox in millimeters

#### Added - Geometry System
- Rectangle primitives with optional rounded corners
- Isosceles triangle roofs with configurable height
- Windows with 4-pane crossbar design
- Doors with doorknob details
- Ground lines with optional jitter
- Tapered paths from canvas bottom to door
- Tree icons (trunk + circular or triangular canopy)
- Dog silhouettes (body, head, tail, four legs)
- Sun/moon with optional radiating rays
- Sky band backgrounds

#### Added - Style System
- Five mood presets:
  - **Cozy**: Welcoming family homes with soft edges
  - **Temporary**: Fragile structures with high jitter
  - **Fortress**: Solid, protective buildings
  - **Minimal**: Clean, modernist aesthetic
  - **Playful**: Whimsical, fun designs
- Parametric control over house proportions
- Adjustable corner radius (0-10mm)
- Configurable window count (0-4) with automatic layouts
- Line jitter system for hand-drawn appearance
- Line break probability for fragility effects
- Asymmetry factor for organic element placement

#### Added - Pen System
- Multi-pen configuration for plotter output
- Four default pen roles:
  - **Outline** (0.8mm): Main structure
  - **Detail** (0.4mm): Windows, doors, environment
  - **Hatch** (0.2mm): Reserved for textures
  - **Background** (0.3mm): Sky elements
- Path grouping by pen role in SVG output
- Stroke width specification in millimeters
- Minimal pen-lift optimization

#### Added - User Interface
- Clean, functional HTML/CSS interface
- Real-time SVG preview
- Canvas configuration controls (size, orientation)
- Style controls (mood, proportions, jitter)
- Environment element toggles
- Random seed input with randomize button
- Generate and download SVG buttons
- Responsive layout for different screen sizes
- Live value displays for all sliders

#### Added - Export System
- SVG generation with proper structure and metadata
- Automatic filename generation (mood-seed-timestamp)
- Direct browser download functionality
- Path grouping with data attributes for pen organization
- XML serialization with proper declaration

#### Added - Documentation
- Comprehensive README with quick start guide
- Detailed USAGE guide with mood explanations and workflows
- TECHNICAL documentation with architecture details
- QUICK_REFERENCE card for common parameters
- PROJECT_SUMMARY with complete feature list
- Programmatic usage examples
- Inline code comments and docstrings

#### Added - Development Tools
- Vite configuration for fast development
- TypeScript configuration with strict mode
- Build scripts (dev, build, preview)
- Git ignore configuration
- Package.json with minimal dependencies

#### Technical Details
- Zero runtime dependencies
- ES2020 target for modern browser support
- Modular architecture with clear separation of concerns
- Deterministic generation (same seed = same output)
- Continuous paths to minimize pen lifts
- Efficient path string generation
- Type-safe configuration system

### Implementation Notes

**Coordinate System**
- Origin at top-left (0, 0)
- X-axis increases rightward
- Y-axis increases downward
- All values in millimeters

**Generation Pipeline**
1. Initialize seeded RNG
2. Resolve canvas dimensions based on preset/orientation
3. Generate background elements (sky band, sun/moon)
4. Generate house structure (body, roof)
5. Generate architectural details (door, windows)
6. Generate environment elements (ground, path, tree, dog)
7. Group paths by pen role
8. Return organized path groups

**Jitter Implementation**
- Subdivide lines into smooth segments
- Apply random offset to each point
- Preserve endpoints to maintain connections
- Scale jitter by element importance

**Window Layouts**
- 0 windows: None
- 1 window: Centered above door
- 2 windows: Symmetrical, one per side
- 3 windows: Evenly spaced across facade
- 4 windows: 2×2 grid arrangement

### Browser Compatibility
- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

### File Structure
```
HOME Generator/
├── src/
│   ├── config/          # Types and defaults
│   ├── geometry/        # Shape primitives
│   ├── generator/       # Composition engine
│   ├── export/          # SVG export
│   ├── ui/              # Interface controller
│   ├── utils/           # RNG, math, canvas helpers
│   └── index.ts         # Main entry
├── examples/            # Usage examples
├── index.html           # Main page
├── package.json
├── tsconfig.json
├── vite.config.ts
└── Documentation files
```

### Known Limitations
- Single house per canvas (no multi-house layouts yet)
- Limited texture/hatching patterns
- No path optimization for pen travel time
- No animation or frame interpolation support

### Future Considerations
- Roof texture patterns (shingles, tiles)
- Wall hatching and shading options
- Multiple houses with automatic layout
- Additional architectural elements (chimney, fence, garden)
- Path optimization algorithms
- Animation/interpolation support
- Preset library with thumbnails

---

## Release Notes

This initial release provides a complete, production-ready system for generating plotter-ready house illustrations. The system successfully achieves all design goals:

✅ Vector-only, stroke-based output  
✅ Millimeter-based coordinate system  
✅ Parametric control over geometry and style  
✅ Canvas size flexibility (A3/A4/A5/custom)  
✅ Mood-based archetypal styling  
✅ Clean, modular architecture  
✅ Comprehensive documentation  
✅ Zero runtime dependencies  

The HOME Generator is ready for:
- Interactive use via web interface
- Programmatic batch generation
- Series-based art production
- Integration into larger workflows
- Extension with custom features

**Status**: Production Ready
**Build**: Tested and verified
**Documentation**: Complete

[1.0.0]: https://github.com/yourusername/home-generator/releases/tag/v1.0.0







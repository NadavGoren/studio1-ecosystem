# HOME Generator - Technical Documentation

## Architecture Overview

The HOME Generator is built as a modular TypeScript system with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface (HTML)                │
│                  ui/controller.ts                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              generator/houseGenerator.ts                │
│  (Main composition logic, coordinates generation)       │
└───┬─────────────────────┬───────────────────┬───────────┘
    │                     │                   │
    ▼                     ▼                   ▼
┌──────────┐      ┌──────────────┐    ┌─────────────┐
│ geometry/│      │   utils/     │    │  export/    │
│primitives│      │ rng, math,   │    │svgExporter  │
│environment│      │   canvas     │    │             │
└──────────┘      └──────────────┘    └─────────────┘
```

## Core Modules

### 1. Configuration System (`src/config/`)

**types.ts**
- Central type definitions
- All interfaces use millimeters as base unit
- Strong typing ensures compile-time safety

**defaults.ts**
- Default values for all configuration options
- `getMoodDefaults()`: Maps moods to style parameters
- Paper size constants (ISO 216 standard)

### 2. Utility Modules (`src/utils/`)

**rng.ts - Seeded Random Number Generator**
```typescript
class SeededRNG {
  random(): number              // [0, 1)
  randomInt(min, max): number   // [min, max] inclusive
  randomRange(min, max): number // [min, max)
  chance(prob): boolean         // true with probability
  choice(array): T              // random element
  shuffle(array): T[]           // Fisher-Yates shuffle
}
```

Uses mulberry32 algorithm for deterministic pseudo-random generation.

**math.ts - Geometric Helpers**
- `applyLineJitter()`: Adds controlled randomness to points
  - Preserves endpoints to maintain connections
  - Uses smooth subdivision before jittering
- `pointsToPath()`: Converts point arrays to SVG path strings
- `breakPath()`: Probabilistically splits paths for artistic effect
- `smoothLine()`: Subdivides segments for smoother curves
- Standard utilities: `lerp()`, `clamp()`, `map()`, `distance()`

**canvas.ts - Dimension Resolution**
- `resolveCanvasDimensions()`: Converts preset/orientation to mm
- `createViewBox()`: Generates SVG viewBox attribute
- Handles portrait/landscape flipping

### 3. Geometry Modules (`src/geometry/`)

**primitives.ts - Basic Shapes**

All functions return `string[]` (array of SVG path strings):

```typescript
drawRect(x, y, width, height, cornerRadius?, jitter?, rng?)
  // Rectangle with optional rounded corners
  // Returns continuous closed path

drawTriangleRoof(centerX, baseY, width, height, jitter?, breakProb?, rng?)
  // Isosceles triangle for roof
  // Can break into segments based on probability

drawWindow(x, y, width, height, crossbars?, jitter?, rng?)
  // Window frame with optional 4-pane crossbars
  // Returns 1-3 paths (frame + vertical + horizontal bars)

drawDoor(x, y, width, height, cornerRadius?, jitter?, rng?)
  // Door with knob (small circle at 3/4 width)
  // Returns 2 paths (frame + knob)
```

**Rounded Corner Implementation**
- For perfect lines: Uses SVG arc commands
- With jitter: Approximates arcs with line segments
- 8 points per corner arc for smooth appearance

**environment.ts - Decorative Elements**

```typescript
drawDogIcon(anchorX, anchorY, scale, jitter?, rng?)
  // Iconic dog silhouette: body + head + tail + 4 legs
  // Scale relative to base size of ~10mm

drawTreeIcon(anchorX, anchorY, scale, jitter?, rng?)
  // Trunk + canopy (circular or triangular, random)
  // Scale relative to base size of ~15mm

drawSunOrMoon(centerX, centerY, radius, withRays?, jitter?, rng?)
  // Circle with optional 8 radiating lines
  // Rays extend 60% of radius beyond edge

drawPathToDoor(bottomY, doorCenterX, doorBottomY, width, jitter?, rng?)
  // Tapered path (wider at bottom)
  // Returns 2 paths (left edge + right edge)

drawGroundLine(startX, endX, y, jitter?, rng?)
  // Simple horizontal line with optional waviness

drawSkyBand(x, y, width, height, jitter?, rng?)
  // Rectangular strip for background
```

### 4. Generator (`src/generator/`)

**houseGenerator.ts - Main Composition Engine**

```typescript
class HouseGenerator {
  constructor(config: HomeGeneratorConfig)
  generate(): PathGroup[]
}
```

**Generation Pipeline:**

1. **Initialize**
   - Create seeded RNG
   - Resolve canvas dimensions
   - Initialize path groups (Map by PenRole)

2. **Generate Background** (first, behind everything)
   - Sky band (if enabled)
   - Sun/moon (80% chance of sun vs moon)

3. **Generate House** (main structure)
   - Calculate dimensions from ratios
   - Position: horizontally centered, at 45% height
   - Draw body rectangle
   - Draw roof (10% wider than body)
   - Draw door (optional asymmetry offset)
   - Draw windows (layout varies by count)

4. **Generate Environment** (foreground details)
   - Ground line at house bottom
   - Path from canvas bottom to door
   - Dog near path (probabilistic)
   - Tree beside house (left or right, probabilistic)

5. **Return PathGroups**
   - Each group contains: role, paths[], pen config

**Window Layouts:**
- 0: None
- 1: Single, centered above door
- 2: One on each side (symmetric)
- 3: Three across (evenly spaced)
- 4: 2×2 grid

**Coordinate System:**
- Origin (0,0) at top-left
- X increases rightward
- Y increases downward
- All values in millimeters

### 5. Export System (`src/export/`)

**svgExporter.ts**

```typescript
generateHomeSvg(config, pathGroups): SVGSVGElement
  // Creates DOM SVG element
  // Sets viewBox in millimeters
  // Groups paths by pen role

svgToString(svg): string
  // Serializes to XML string
  // Adds XML declaration

downloadSvg(svg, filename): void
  // Creates blob and triggers download
  // Cleans up URL after download

exportHome(config, pathGroups): void
  // Convenience function
  // Generates filename with mood-seed-timestamp
```

**SVG Structure:**
```xml
<svg viewBox="0 0 210 297" width="210mm" height="297mm">
  <metadata>Generated by HOME Generator | Seed: ... | Mood: ...</metadata>
  
  <g data-pen="background" stroke="#999" stroke-width="0.3" fill="none">
    <path d="..."/>
  </g>
  
  <g data-pen="outline" stroke="#000" stroke-width="0.8" fill="none">
    <path d="..."/>
  </g>
  
  <g data-pen="detail" stroke="#333" stroke-width="0.4" fill="none">
    <path d="..."/>
  </g>
</svg>
```

### 6. User Interface (`src/ui/`)

**controller.ts - UI State Management**

```typescript
class UIController {
  constructor(previewContainer: HTMLElement)
  generate(): void    // Regenerate and display
  download(): void    // Export current design
}
```

**Event Flow:**
1. User changes control → Event listener fires
2. Update internal config object
3. Call `generate()`
4. Create new `HouseGenerator(config)`
5. Get `pathGroups` from generator
6. Generate SVG element
7. Replace preview container contents

**Slider Management:**
- Each slider has associated value display
- Real-time updates on input event
- Values formatted to 2 decimal places

**Mood Changes:**
- Load defaults via `getMoodDefaults()`
- Merge with existing config
- Update all UI controls to reflect new values
- Auto-regenerate

## Key Design Decisions

### Why Millimeters?
- Direct correspondence to plotter coordinates
- No pixel→mm conversion errors
- SVG viewBox preserves units through export
- Industry standard for technical drawings

### Why Seeded RNG?
- Reproducibility: Same seed = same output
- Debugging: Isolate issues with known seeds
- User control: Share seeds for exact reproductions
- Series creation: Adjacent seeds for variations

### Why Path Arrays?
- Some elements may create multiple disconnected paths
- Allows line breaking without complex path string manipulation
- Easier to apply transformations to individual segments
- Groups naturally organize related elements

### Why No Fill?
- Plotter compatibility: Most plotters are stroke-only
- Cleaner aesthetic for line art
- Faster plotting (no fill hatching needed)
- Easier multi-color separation by pen role

### Jitter Implementation
1. Create perfect geometry first
2. Subdivide lines into more points (`smoothLine`)
3. Apply random offset to each point
4. Preserve endpoints (or reduce their jitter)
5. Result: Smooth hand-drawn appearance

**Why Subdivide First?**
- More control over curve smoothness
- Prevents sharp angle changes
- Better approximation of natural hand motion

## Performance Considerations

### Generation Speed
- Entire house generation: < 10ms typical
- No complex calculations (mostly arithmetic)
- RNG is fast (simple bitwise operations)
- Path string building is dominant cost

### Memory Usage
- Config objects are small (< 1KB)
- Path strings are main memory use
- Typical house: 50-200 paths × ~100 bytes = 5-20KB
- SVG DOM element: 10-50KB

### Optimization Opportunities
- Path string building could use StringBuilder pattern
- Point arrays could be reused between jitter operations
- Circle approximations could be cached

## Testing Strategy

### Manual Testing Checklist
- [ ] All moods generate without errors
- [ ] All canvas sizes produce correct viewBox
- [ ] Orientation flip works correctly
- [ ] Jitter at 0mm produces perfect lines
- [ ] Line breaks occur probabilistically
- [ ] All environment elements toggle correctly
- [ ] Same seed produces identical output
- [ ] SVG downloads correctly
- [ ] SVG opens in vector editor (Illustrator, Inkscape)
- [ ] SVG plots correctly on target plotter

### Unit Test Opportunities
- RNG determinism (same seed → same sequence)
- Canvas dimension resolution
- Point jittering (endpoints preserved)
- Path string format (valid SVG syntax)
- Mood defaults (all required fields present)

## Extension Points

### Adding New Shapes
1. Create drawing function in `geometry/primitives.ts` or `environment.ts`
2. Return `string[]` of path data
3. Accept jitter and RNG parameters
4. Call from `houseGenerator.ts` at appropriate stage

### Adding New Moods
1. Add mood name to `HomeMood` type
2. Implement in `getMoodDefaults()` switch
3. Add option to HTML select element

### Adding New Pen Roles
1. Add role to `PenRole` type
2. Add default pen to `DEFAULT_PENS`
3. Use role when calling `addPaths()` in generator

### Custom Textures/Hatching
1. Create hatching pattern generator
2. Add paths to 'hatch' role
3. Consider performance (hatching creates many paths)

### Animation
- Generate multiple frames with interpolated configs
- Export as individual SVGs
- Combine in video editor or create SVG animation

## Millimeter Calibration

**Verifying Output:**
1. Generate simple rectangle (e.g., 100mm × 100mm)
2. Set jitter to 0mm
3. Export SVG
4. Plot on test paper
5. Measure with ruler
6. Should be exactly 100mm × 100mm

**If Measurements Are Off:**
- Check plotter DPI settings
- Verify SVG import settings in plotter software
- Ensure viewBox units are interpreted correctly
- Some software may require explicit `width="100mm"` attributes

## Dependencies

```json
{
  "typescript": "^5.3.3",  // Type checking and compilation
  "vite": "^5.0.8"         // Dev server and bundling
}
```

**Zero runtime dependencies** - All functionality is self-contained.

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020 features used (optional chaining, nullish coalescing)
- SVG DOM manipulation (well-supported)
- Blob/URL APIs for downloads (universal)

**Minimum Versions:**
- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

## Future Enhancements

- [ ] Texture/hatching patterns for roof, walls
- [ ] Multiple houses in one composition
- [ ] Perspective/isometric views
- [ ] Seasonal variations (snow, leaves, etc.)
- [ ] Batch export (generate multiple at once)
- [ ] SVG optimizer integration
- [ ] Path sorting for optimal pen movement
- [ ] Custom shape library
- [ ] Animation timeline
- [ ] Preset library/gallery







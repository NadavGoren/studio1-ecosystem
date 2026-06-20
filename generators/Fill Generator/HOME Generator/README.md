# HOME Generator

A plotter-ready generative art system for creating infinite variations of archetypal houses.

## Features

- **Plotter-Ready Output**: Vector-only, stroke-based SVG exports with minimal pen-lifts
- **Millimeter-Based Units**: All coordinates and dimensions in millimeters for precise plotting
- **Multiple Canvas Sizes**: Support for A3, A4, A5, and custom dimensions
- **Mood System**: Five archetypal moods (cozy, temporary, fortress, minimal, playful) that affect visual style
- **Parametric Control**: Adjustable geometry, proportions, and styling
- **Deterministic Generation**: Seeded random number generator for reproducible results
- **Pen Organization**: SVG paths grouped by pen role (outline, detail, hatch, background)

## Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

This will start a development server at `http://localhost:3000` and open it in your browser.

### Build

```bash
npm run build
```

This will create a production build in the `dist/` directory.

## Usage

### Interactive UI

1. Open the application in your browser
2. Configure canvas size and orientation
3. Select a mood preset or customize parameters:
   - House dimensions and proportions
   - Roof height
   - Corner radius for softer edges
   - Number of windows (0-4)
   - Jitter amount for hand-drawn feel
4. Toggle environment elements (tree, dog, path, sun/moon, sky band)
5. Adjust element density
6. Set or randomize the seed for different variations
7. Click "Generate" to create a new house
8. Click "Download SVG" to export for plotting

### Programmatic Usage

```typescript
import { HouseGenerator, DEFAULT_CONFIG, getMoodDefaults } from './src/index';

// Create a custom configuration
const config = {
  ...DEFAULT_CONFIG,
  randomSeed: 42,
  style: {
    ...DEFAULT_CONFIG.style,
    ...getMoodDefaults('fortress')
  }
};

// Generate the house
const generator = new HouseGenerator(config);
const pathGroups = generator.generate();

// Export as SVG
import { generateHomeSvg, downloadSvg } from './src/export/svgExporter';
const svg = generateHomeSvg(config, pathGroups);
downloadSvg(svg, 'my-house.svg');
```

## Architecture

```
src/
├── config/          # Type definitions and default configurations
│   ├── types.ts     # TypeScript interfaces and types
│   └── defaults.ts  # Default values and mood mappings
├── geometry/        # Geometric primitives
│   ├── primitives.ts    # Basic shapes (rect, triangle, window, door)
│   └── environment.ts   # Environment elements (tree, dog, sun, path)
├── generator/       # House composition logic
│   └── houseGenerator.ts
├── export/          # SVG generation and export
│   └── svgExporter.ts
├── ui/              # User interface controller
│   └── controller.ts
├── utils/           # Utility functions
│   ├── rng.ts       # Seeded random number generator
│   ├── math.ts      # Math helpers (jitter, path generation)
│   └── canvas.ts    # Canvas dimension helpers
└── index.ts         # Main entry point
```

## Mood Presets

### Cozy
- Moderate proportions
- Soft corners
- Symmetrical windows
- Low jitter for stable appearance

### Temporary
- Smaller, thinner structure
- No corner radius
- High jitter for fragile feel
- Fewer windows
- Higher line break probability

### Fortress
- Large, solid proportions
- Thick walls (rendered via stroke width)
- Small windows
- Minimal jitter
- Strong geometry

### Minimal
- Clean lines
- No jitter
- Symmetrical layout
- Simple composition

### Playful
- Tall roof
- Rounded corners
- Many windows
- Moderate jitter
- Asymmetrical elements

## Coordinate System

All dimensions are in **millimeters**:
- SVG `viewBox` directly represents millimeter coordinates
- Example: A4 portrait → `viewBox="0 0 210 297"`
- Stroke widths are specified in mm (e.g., 0.8mm for outline pen)

## Pen Roles

The system organizes drawing elements by pen role for multi-pen plotting:

- **outline**: Main house structure, roof, ground line
- **detail**: Windows, doors, path, tree, dog
- **hatch**: Textures and hatching (reserved for future use)
- **background**: Sky band, sun/moon

Each pen role can be assigned a different physical pen with specific thickness and color.

## License

MIT

## Author

Created as a plotter-ready generative art system for series-based production.







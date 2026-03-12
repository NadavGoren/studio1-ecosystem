# HatchStudio

Professional-grade vector design tool optimized for Pen Plotters (Axidraw/iDraw). Create precise vector designs with advanced hatching capabilities, boolean operations, and pen-plotter-optimized SVG export.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Documentation

Comprehensive documentation is available in the following files:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture, tech stack, state management, and component hierarchy
- **[FEATURES.md](./FEATURES.md)** - Complete feature catalog with examples and workflows
- **[API_REFERENCE.md](./API_REFERENCE.md)** - Store API, library functions, component APIs, and type definitions
- **[HATCHING_ENGINE.md](./HATCHING_ENGINE.md)** - Deep dive into hatching algorithms and parameters
- **[BOOLEAN_OPERATIONS.md](./BOOLEAN_OPERATIONS.md)** - Boolean operation algorithms and Paper.js integration
- **[GEOMETRY_SYSTEM.md](./GEOMETRY_SYSTEM.md)** - Coordinate transformations, shape calculations, and snapping
- **[UI_COMPONENTS.md](./UI_COMPONENTS.md)** - Component catalog, UI patterns, and keyboard shortcuts
- **[EXPORT_SYSTEM.md](./EXPORT_SYSTEM.md)** - SVG export format, options, and file specifications
- **[PROJECT_MANAGEMENT.md](./PROJECT_MANAGEMENT.md)** - Save/load system, state snapshots, and storage
- **[EXTENDING_HATCHSTUDIO.md](./EXTENDING_HATCHSTUDIO.md)** - Extension points and how to add new features
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues, performance tips, and debugging

For functional specifications and UX guidelines, see **[Feature_Guide.md](./Feature_Guide.md)**.

## Tech Stack

- **Framework:** React + TypeScript + Vite
- **Styling:** Tailwind CSS (monochrome technical theme)
- **State Management:** Zustand
- **Icons:** Lucide React
- **Geometry:** Paper.js (for boolean operations)

## Critical Constraints

- **Millimeters ONLY:** All dimensions, coordinates, and properties are in millimeters (mm)
- **Coordinate System:** 1 SVG User Unit = 1 Millimeter
- **Export:** SVG output includes explicit `width="Xmm"` and `height="Ymm"` attributes
- **No Fills:** Plotters cannot do fills - all geometry must be strokes

## Key Features

### Core Capabilities

- ✅ **SVG-based canvas** with pan/zoom and infinite workspace
- ✅ **Paper presets** (A5, A4, A3) with portrait/landscape orientation
- ✅ **Shape tools:** Rectangle, Ellipse, Polygon, Line
- ✅ **Advanced hatching engine** with cross-hatch, zig-zag, and gradient support
- ✅ **Boolean operations:** Union, Subtract, Intersect, Exclude
- ✅ **Layer management** with visibility, locking, and grouping
- ✅ **Undo/Redo** with full history tracking
- ✅ **Keyboard shortcuts** for all tools and operations
- ✅ **Shape snapping** to centers, bounds, and paper margins
- ✅ **SVG export** optimized for pen plotters
- ✅ **Project save/load** with thumbnails

### Advanced Features

- **Hatching modes:** Local (rotates with shape) and World (static mask)
- **Compound paths** with hole support
- **Rounded corners** on rectangles, polygons, and boolean results
- **Alignment & distribution** tools
- **Eyedropper** for copying properties
- **Global stroke width** and color override
- **Direct point editing** for precise shape manipulation

## Project Structure

```
src/
  components/       # React components (UI)
    sidebar/        # Sidebar tab components
    ui/             # Design system components
  store/            # Zustand state management
  lib/              # Geometry utilities, SVG export, hatching
  types/            # TypeScript type definitions
  hooks/            # Custom React hooks
```

## Getting Help

- See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues
- Check [FEATURES.md](./FEATURES.md) for detailed feature documentation
- Review [API_REFERENCE.md](./API_REFERENCE.md) for development reference
- Consult [EXTENDING_HATCHSTUDIO.md](./EXTENDING_HATCHSTUDIO.md) to add new features










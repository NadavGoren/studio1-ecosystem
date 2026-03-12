# API Reference

## Overview

This document provides comprehensive API documentation for HatchStudio, including the Zustand store, library functions, component APIs, and type definitions.

## Table of Contents

1. [Store API (Zustand)](#store-api-zustand)
2. [Library Functions](#library-functions)
3. [Type Definitions](#type-definitions)
4. [Component APIs](#component-apis)

## Store API (Zustand)

The main store is accessed via `useAppStore()` hook from `src/store/index.ts`.

### State Access

```typescript
const state = useAppStore();
const { shapes, selectedShapeIds, paper } = useAppStore();
```

### Paper Settings

#### `setPaper(updates: Partial<PaperSettings>)`
Update paper settings.

```typescript
setPaper({ margin: 10, globalStrokeWidth: 0.5 });
```

#### `setPaperPreset(preset: PaperPreset)`
Set paper preset (A5, A4, A3, Custom).

```typescript
setPaperPreset('A4');
```

#### `setPaperOrientation(orientation: PaperOrientation)`
Set portrait or landscape.

```typescript
setPaperOrientation('landscape');
```

#### `setPaperMargin(margin: number)`
Set safe margin in mm.

```typescript
setPaperMargin(15);
```

#### `setPaperSize(width: number, height: number)`
Set custom paper size in mm.

```typescript
setPaperSize(200, 300);
```

### Shape Management

#### `addShape(shape: Shape)`
Add a new shape to the canvas.

```typescript
const rectangle: RectangleShape = {
  id: crypto.randomUUID(),
  type: 'rectangle',
  x: 100,
  y: 100,
  width: 50,
  height: 30,
  rotation: 0,
  visible: true,
  locked: false,
  strokeWidth: 0.4,
  color: '#000000'
};
addShape(rectangle);
```

#### `updateShape(id: string, updates: Partial<Shape>)`
Update shape properties.

```typescript
updateShape(shapeId, { x: 150, y: 200, rotation: 45 });
```

#### `deleteShape(id: string)`
Delete a single shape.

```typescript
deleteShape(shapeId);
```

#### `deleteShapes(ids: string[])`
Delete multiple shapes.

```typescript
deleteShapes([id1, id2, id3]);
```

### Selection

#### `selectShape(id: string)`
Select a single shape (deselects others).

```typescript
selectShape(shapeId);
```

#### `selectShapes(ids: string[])`
Select multiple shapes.

```typescript
selectShapes([id1, id2, id3]);
```

#### `deselectAll()`
Deselect all shapes.

```typescript
deselectAll();
```

#### `toggleSelection(id: string)`
Toggle selection state of a shape.

```typescript
toggleSelection(shapeId);
```

### View Transform

#### `setViewTransform(transform: Partial<ViewTransform>)`
Update view transform (pan/zoom).

```typescript
setViewTransform({ centerX: 150, centerY: 200, scale: 1.5 });
```

#### `resetView()`
Reset view to default (centered, scale 1.0).

```typescript
resetView();
```

#### `zoomToFit()`
Fit paper size to viewport.

```typescript
zoomToFit();
```

#### `setZoom(scale: number)`
Set zoom level (0.1 to 20.0).

```typescript
setZoom(2.0); // 200%
```

### Hatching

#### `setHatchParams(shapeId: string, params: Partial<HatchParams>)`
Update hatching parameters for a shape.

```typescript
setHatchParams(shapeId, {
  enabled: true,
  density: 2,
  angle: 45,
  crossHatchEnabled: true
});
```

### Tools

#### `setTool(tool: ToolType)`
Set active tool.

```typescript
setTool('rectangle');
// ToolType: 'select' | 'direct_select' | 'rectangle' | 'ellipse' | 
//           'polygon' | 'line' | 'eyedropper'
```

### History (Undo/Redo)

#### `pushState()`
Push current state to history (called automatically on changes).

```typescript
pushState();
```

#### `undo()`
Undo last operation.

```typescript
undo();
```

#### `redo()`
Redo last undone operation.

```typescript
redo();
```

#### `commitState()`
Commit current state to history.

```typescript
commitState();
```

### Transformations

#### `duplicateSelection(offset?: { x: number; y: number })`
Duplicate selected shapes.

```typescript
duplicateSelection({ x: 10, y: 10 });
```

#### `alignSelection(type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom')`
Align selected shapes.

```typescript
alignSelection('center');
```

#### `distributeSelection(type: 'horizontal' | 'vertical')`
Distribute selected shapes evenly.

```typescript
distributeSelection('horizontal');
```

#### `nudgeSelection(dx: number, dy: number)`
Move selection by offset.

```typescript
nudgeSelection(1, 0); // Move 1mm right
```

### Grouping

#### `groupSelection()`
Group selected shapes.

```typescript
groupSelection();
```

#### `ungroupSelection()`
Ungroup selected groups.

```typescript
ungroupSelection();
```

#### `reorderShape(draggedId: string, targetId: string, position: 'before' | 'after' | 'inside')`
Reorder shape in layer stack.

```typescript
reorderShape(shapeId, targetId, 'after');
```

### Boolean Operations

#### `performBooleanOperation(op: 'union' | 'subtract' | 'intersect' | 'exclude')`
Perform boolean operation on selected shapes.

```typescript
performBooleanOperation('union');
```

### Clipboard

#### `copyShapes(): Promise<void>`
Copy selected shapes to internal clipboard.

```typescript
await copyShapes();
```

#### `pasteShapes(): Promise<void>`
Paste shapes from clipboard.

```typescript
await pasteShapes();
```

### Project Management

#### `saveProject(name: string): Promise<void>`
Save current project.

```typescript
await saveProject('My Design');
```

#### `loadProject(id: string): Promise<void>`
Load a saved project.

```typescript
await loadProject(projectId);
```

#### `deleteProject(id: string): Promise<void>`
Delete a saved project.

```typescript
await deleteProject(projectId);
```

### UI State

#### `setEyedropperMode(mode: Partial<EyedropperMode>)`
Configure eyedropper tool.

```typescript
setEyedropperMode({ copyColor: true, copyHatch: false });
```

#### `addSwatch(color: string)`
Add color to swatches.

```typescript
addSwatch('#FF0000');
```

#### `removeSwatch(color: string)`
Remove color from swatches.

```typescript
removeSwatch('#FF0000');
```

## Library Functions

### Geometry (`src/lib/geometry.ts`)

#### `getShapeVertices(shape: Shape): { x: number; y: number }[]`
Get absolute world coordinates of shape vertices.

```typescript
const vertices = getShapeVertices(rectangle);
// Returns array of {x, y} points in mm
```

#### `getShapeBounds(shape: Shape, allShapes?: Shape[]): Bounds`
Get bounding box of shape.

```typescript
const bounds = getShapeBounds(shape);
// Returns { x, y, width, height } in mm
```

#### `shapeToPath(shape: Shape, allShapes?: Shape[]): string | null`
Convert shape to SVG path string.

```typescript
const path = shapeToPath(rectangle);
// Returns SVG path d attribute
```

#### `pointInShape(x: number, y: number, shape: Shape, allShapes: Shape[]): boolean`
Check if point is inside shape.

```typescript
const inside = pointInShape(100, 100, rectangle, shapes);
```

#### `rotatePoint(x: number, y: number, cx: number, cy: number, angle: number)`
Rotate point around center.

```typescript
const rotated = rotatePoint(10, 0, 0, 0, 90);
// Returns { x: 0, y: 10 }
```

#### `unrotatePoint(x: number, y: number, cx: number, cy: number, angle: number)`
Inverse rotation.

```typescript
const unrotated = unrotatePoint(0, 10, 0, 0, 90);
// Returns { x: 10, y: 0 }
```

#### `generateRoundedPolylinePoints(pts: Point[], cornerRadius: number): Point[]`
Generate sampled points for rounded polyline.

```typescript
const rounded = generateRoundedPolylinePoints(points, 5);
```

### Hatching (`src/lib/hatching.ts`)

#### `generateHatchLines(shape: Shape, params: HatchParams): string[]`
Generate hatch line paths for a shape.

```typescript
const lines = generateHatchLines(rectangle, hatchParams);
// Returns array of SVG path strings
```

#### `generateAllHatchLines(shape: Shape, params: HatchParams): string[]`
Generate all hatch lines including cross-hatch.

```typescript
const allLines = generateAllHatchLines(shape, params);
```

### Boolean Operations (`src/lib/boolean.ts`)

#### `computeBooleanOperation(shapes: Shape[], op: 'union' | 'subtract' | 'intersect' | 'exclude'): ResultData[]`
Perform boolean operation using Paper.js.

```typescript
const result = computeBooleanOperation([shape1, shape2], 'union');
// Returns [{ points: Point[], holes: Point[][] }]
```

### Coordinates (`src/lib/coords.ts`)

#### `screenToWorld(screenX: number, screenY: number, containerRect: DOMRect, paper: PaperSettings, viewTransform: ViewTransform)`
Convert screen coordinates to world coordinates (mm).

```typescript
const world = screenToWorld(100, 200, rect, paper, viewTransform);
// Returns { x: number, y: number } in mm
```

#### `calculateViewBoxDimensions(containerRect: { width: number; height: number }, paper: PaperSettings, viewTransform: ViewTransform)`
Calculate SVG viewBox dimensions.

```typescript
const viewBox = calculateViewBoxDimensions(rect, paper, viewTransform);
// Returns { viewBoxX, viewBoxY, viewWidthMM, viewHeightMM }
```

### Snapping (`src/lib/snapping.ts`)

#### `getNearestSnap(currentBounds: Bounds, state: ProjectState, excludeShapeIds?: string[], threshold?: number): SnapResult`
Get nearest snap point.

```typescript
const snap = getNearestSnap(bounds, state, [excludeId], 5);
// Returns { x, y, deltaX, deltaY, guides: SnapGuide[] }
```

### SVG Export (`src/lib/svg-export.ts`)

#### `exportToSVG(state: ProjectState): string`
Export project to SVG string.

```typescript
const svg = exportToSVG(state);
// Returns complete SVG XML string
```

#### `downloadSVG(svgContent: string, filename?: string): void`
Download SVG file.

```typescript
downloadSVG(svg, 'design.svg');
```

### Thumbnail (`src/lib/thumbnail.ts`)

#### `generateThumbnail(state: ProjectState): Promise<string>`
Generate thumbnail image (base64 data URL).

```typescript
const thumbnail = await generateThumbnail(state);
// Returns 'data:image/png;base64,...'
```

## Type Definitions

### Core Types

#### `Shape`
Union type for all shape types.

```typescript
type Shape = RectangleShape | EllipseShape | PolygonShape | 
             LineShape | PolylineShape | GroupShape;
```

#### `ShapeType`
Shape type identifier.

```typescript
type ShapeType = 'rectangle' | 'ellipse' | 'polygon' | 
                 'line' | 'polyline' | 'group';
```

#### `BaseShape`
Base interface for all shapes.

```typescript
interface BaseShape {
  id: string;
  name?: string;
  type: ShapeType;
  x: number;           // Center X (mm)
  y: number;           // Center Y (mm)
  rotation: number;    // Degrees (0-360)
  visible: boolean;
  locked: boolean;
  strokeWidth: number; // mm
  color: string;        // Hex color
  groupId?: string;     // Parent group ID
  isHole?: boolean;     // For compound paths
}
```

#### `RectangleShape`
Rectangle shape.

```typescript
interface RectangleShape extends BaseShape {
  type: 'rectangle';
  width: number;        // mm
  height: number;      // mm
  cornerRadius?: number; // mm
}
```

#### `EllipseShape`
Ellipse/circle shape.

```typescript
interface EllipseShape extends BaseShape {
  type: 'ellipse';
  radiusX: number;      // mm
  radiusY: number;     // mm
}
```

#### `PolygonShape`
Polygon shape.

```typescript
interface PolygonShape extends BaseShape {
  type: 'polygon';
  radius: number;       // mm
  sides: number;       // 3-12
  cornerRadius?: number; // mm
}
```

#### `LineShape`
Line shape.

```typescript
interface LineShape extends BaseShape {
  type: 'line';
  width: number;       // Line length (mm)
  height: 0;           // Always 0
}
```

#### `PolylineShape`
Polyline (from boolean operations).

```typescript
interface PolylineShape extends BaseShape {
  type: 'polyline';
  points: { x: number; y: number }[];
  holes?: { x: number; y: number }[][];
  cornerRadius?: number;
}
```

#### `GroupShape`
Group container.

```typescript
interface GroupShape extends BaseShape {
  type: 'group';
  childrenIds: string[];
  width: number;
  height: number;
}
```

### Hatching Types

#### `HatchParams`
Hatching parameters.

```typescript
interface HatchParams {
  enabled: boolean;
  density: number;              // mm
  angle: number;                // degrees (0-180)
  offset: number;                // mm
  originX: number;              // mm
  originY: number;              // mm
  gradientEnabled: boolean;
  gradientStart: number;         // mm
  gradientEnd: number;           // mm
  gradientAngle: number;        // degrees (0-360)
  crossHatchEnabled: boolean;
  crossHatchAngle: number;       // degrees
  crossHatchPerpendicular: boolean;
  zigZagEnabled: boolean;
  spaceMode: 'local' | 'world';
  renderOutline: boolean;
  fillRule: 'nonzero' | 'evenodd';
}
```

### Paper Types

#### `PaperSettings`
Paper configuration.

```typescript
interface PaperSettings {
  preset: PaperPreset;           // 'A5' | 'A4' | 'A3' | 'Custom'
  orientation: PaperOrientation;  // 'portrait' | 'landscape'
  margin: number;                 // mm
  width: number;                  // mm
  height: number;                 // mm
  globalStrokeWidth: number;     // mm
  globalColorOverride: boolean;
  globalColor: string;            // Hex color
}
```

#### `ViewTransform`
View/camera transform.

```typescript
interface ViewTransform {
  centerX: number;  // World X center (mm)
  centerY: number;  // World Y center (mm)
  scale: number;     // Zoom level (0.1 to 20.0)
}
```

### Tool Types

#### `ToolType`
Active tool.

```typescript
type ToolType = 'select' | 'direct_select' | 'rectangle' | 
                'ellipse' | 'polygon' | 'line' | 'eyedropper';
```

#### `EyedropperMode`
Eyedropper configuration.

```typescript
interface EyedropperMode {
  copyColor: boolean;
  copyStroke: boolean;
  copyHatch: boolean;
}
```

### Project Types

#### `StateSnapshot`
Complete state snapshot.

```typescript
interface StateSnapshot {
  paper: PaperSettings;
  shapes: Shape[];
  selectedShapeIds: string[];
  viewTransform: ViewTransform;
  hatchParams: Record<string, HatchParams>;
  tool: ToolType;
  snapping: SnappingConfig;
}
```

#### `SavedProject`
Saved project data.

```typescript
interface SavedProject {
  id: string;
  name: string;
  date: number;        // Timestamp
  data: StateSnapshot;
  thumbnail?: string;  // Base64 data URL
}
```

## Component APIs

### Canvas Component

**Props:** None (uses Zustand store)

**Key Features:**
- Mouse event handling
- Shape rendering
- Selection overlay
- Snap guides
- Drawing tools

### SelectionOverlay Component

**Props:**
```typescript
interface SelectionOverlayProps {
  containerRef: RefObject<HTMLDivElement>;
  paper: PaperSettings;
  viewTransform: ViewTransform;
}
```

**Features:**
- Transform handles (resize, rotate)
- Bounding box display
- Handle interaction

### RightPanel Component

**Props:** None (uses Zustand store)

**Features:**
- Properties panel (when shape selected)
- Canvas settings (when no selection)
- Hatching controls
- Transform inputs

### LeftPanel Component

**Props:** None (uses Zustand store)

**Features:**
- Layers tab (layer management)
- Projects tab (save/load)

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [FEATURES.md](./FEATURES.md) - Feature documentation
- [HATCHING_ENGINE.md](./HATCHING_ENGINE.md) - Hatching details
- [GEOMETRY_SYSTEM.md](./GEOMETRY_SYSTEM.md) - Geometry calculations


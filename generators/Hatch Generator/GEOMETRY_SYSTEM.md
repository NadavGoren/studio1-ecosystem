# Geometry System Documentation

## Overview

HatchStudio uses a millimeter-based coordinate system with precise geometric calculations for shape manipulation, transformations, and snapping. All calculations are performed in world coordinates (mm).

## Coordinate System

### Millimeter-Based System

**Critical Constraint:** All coordinates, dimensions, and calculations use millimeters.

- **1 SVG User Unit = 1 Millimeter**
- **No pixel conversion** - Direct mm to SVG mapping
- **Export includes explicit units:** `width="210mm" height="297mm"`

### Coordinate Spaces

The system handles three coordinate spaces:

1. **World Space (mm)** - Absolute coordinates on the paper
2. **Screen Space (px)** - Browser viewport pixels
3. **Shape Space (mm)** - Local coordinates relative to shape center

### Coordinate Transformations

#### Screen to World

```typescript
function screenToWorld(
  screenX: number,
  screenY: number,
  containerRect: DOMRect,
  paper: PaperSettings,
  viewTransform: ViewTransform
): { x: number; y: number }
```

**Algorithm:**
1. Calculate viewBox dimensions from viewport
2. Convert screen percentage to world coordinates
3. Apply view transform (pan/zoom)

**Example:**
```typescript
// Mouse at screen position (500, 300)
// Viewport: 1000×600px
// View transform: centerX=150, centerY=200, scale=1.5
// Result: { x: 100, y: 150 } (mm)
```

#### World to Screen

Inverse transformation for rendering:
1. Apply view transform
2. Convert world coordinates to screen percentage
3. Scale to viewport pixels

## Shape Calculations

### Vertex Extraction

#### `getShapeVertices(shape: Shape): Point[]`

Returns absolute world coordinates of shape vertices.

**Rectangle:**
```typescript
// Center: (x, y), Size: (width, height), Rotation: angle
// Returns 4 corners in world coordinates
```

**Ellipse:**
```typescript
// Center: (x, y), Radii: (radiusX, radiusY), Rotation: angle
// Returns sampled points along ellipse perimeter
```

**Polygon:**
```typescript
// Center: (x, y), Radius: r, Sides: n, Rotation: angle
// Returns n vertices in world coordinates
```

**Polyline:**
```typescript
// Points array (already in world coordinates)
// Returns points with rotation applied
```

### Bounding Box Calculation

#### `getShapeBounds(shape: Shape, allShapes?: Shape[]): Bounds`

Calculates axis-aligned bounding box.

**Algorithm:**
1. Get all vertices (including children for groups)
2. Find min/max X and Y
3. Return { x, y, width, height }

**Groups:**
- Recursively calculates bounds of all children
- Returns union of all child bounds

**Example:**
```typescript
const bounds = getShapeBounds(rectangle);
// Returns: { x: 75, y: 85, width: 50, height: 30 }
```

### Point-in-Shape Detection

#### `pointInShape(x: number, y: number, shape: Shape, allShapes: Shape[]): boolean`

Uses raycasting algorithm (even-odd rule).

**Algorithm:**
1. Cast horizontal ray from point to infinity
2. Count intersections with shape edges
3. Odd count = inside, Even = outside

**Groups:**
- Checks all children
- Returns true if point in any child

**Holes:**
- Handled automatically by even-odd rule
- Ray enters hole = outside
- Ray exits hole = inside

## Rotation and Transformation

### Point Rotation

#### `rotatePoint(x: number, y: number, cx: number, cy: number, angle: number)`

Rotate point around center.

**Formula:**
```
x' = cx + (x - cx) * cos(θ) - (y - cy) * sin(θ)
y' = cy + (y - cy) * cos(θ) + (x - cx) * sin(θ)
```

**Implementation:**
```typescript
const rad = (angle * Math.PI) / 180;
const cos = Math.cos(rad);
const sin = Math.sin(rad);
const dx = x - cx;
const dy = y - cy;
return {
  x: cx + dx * cos - dy * sin,
  y: cy + dy * cos + dx * sin
};
```

#### `unrotatePoint(x: number, y: number, cx: number, cy: number, angle: number)`

Inverse rotation (unrotate).

**Formula:**
```
Same as rotatePoint but with -angle
```

### Shape Rotation

Shapes are rotated around their center point:

1. **Get vertices** in local coordinates
2. **Apply rotation** around shape center
3. **Convert to world coordinates**

**Example:**
```typescript
// Rectangle at (100, 100), rotated 45°
// Local corners: (-25, -15), (25, -15), (25, 15), (-25, 15)
// Rotated and translated to world coordinates
```

### Centroid Calculation

For rotation, shapes use their **geometric centroid**:

**Rectangle/Ellipse:**
- Centroid = center point (x, y)

**Polygon:**
- Centroid = average of vertices

**Polyline:**
- Centroid = average of points

**Groups:**
- Centroid = average of all child centroids

## Rounded Corners

### Arc Generation

#### `generateRoundedPolylinePoints(pts: Point[], cornerRadius: number): Point[]`

Generates sampled points for rounded polyline paths.

**Algorithm:**
1. **Winding Detection** - Calculate signed area (shoelace formula)
2. **Corner Detection** - Identify corners needing rounding
3. **Arc Center Calculation** - Perpendicular bisector method
4. **Adaptive Sampling** - Generate smooth curves

### Arc Center Calculation

**Method:** Perpendicular bisector (chord-based)

**Steps:**
1. Calculate chord (line from arc start to end)
2. Find chord midpoint
3. Calculate perpendicular direction
4. Place center at distance from midpoint

**Formula:**
```
chord = arcEnd - arcStart
midpoint = (arcStart + arcEnd) / 2
perp = perpendicular(chord)
distToCenter = sqrt(r² - (chord/2)²)
center = midpoint + sign * perp * distToCenter
```

**Sign Selection:**
- Convex corners: `sign = 1`
- Concave corners: `sign = -1`

### Winding Order

**Detection:**
```typescript
let signedArea = 0;
for (let i = 0; i < n; i++) {
  const curr = pts[i];
  const next = pts[(i + 1) % n];
  signedArea += (next.x - curr.x) * (next.y + curr.y);
}
signedArea /= 2;
const isCounterclockwise = signedArea < 0;
```

**Importance:**
- Determines convex vs. concave corners
- Affects arc center placement
- Critical for unioned shapes

## Snapping System

### Snap Targets

#### Centers
- Shape centers
- Paper center
- Edge midpoints

#### Bounds
- Shape edges (top, bottom, left, right)
- Shape corners
- Paper margins

### Snap Detection

#### `getNearestSnap(currentBounds: Bounds, state: ProjectState, excludeShapeIds?: string[], threshold?: number): SnapResult`

**Algorithm:**
1. **Collect Targets** - All centers and bounds
2. **Check Distance** - Compare current bounds to targets
3. **Find Nearest** - Within threshold (default 5mm)
4. **Return Delta** - Offset to snap position

**Check Points:**
- All 4 corners
- All 4 edge midpoints
- Center point
- Additional points (mouse position, handles)

**Example:**
```typescript
const snap = getNearestSnap(bounds, state, [], 5);
// Returns: { x: 0, y: 0, deltaX: 2, deltaY: 0, guides: [...] }
// Apply: x += deltaX, y += deltaY
```

### Visual Guides

**Snap Guides:**
- Pink dashed lines
- Vertical or horizontal
- Show active snap points
- Indicate margin/center snaps

**Types:**
```typescript
interface SnapGuide {
  type: 'vertical' | 'horizontal';
  offset: number;      // Position in mm
  isMargin?: boolean;  // Paper margin
  isCenter?: boolean;  // Center line
}
```

## Path Generation

### SVG Path Conversion

#### `shapeToPath(shape: Shape, allShapes?: Shape[]): string | null`

Converts shape to SVG path `d` attribute.

**Rectangle:**
```typescript
// With rounded corners: M, L, A (arc) commands
// Without: M, L, L, L, Z
```

**Ellipse:**
```typescript
// A (arc) command for full ellipse
```

**Polygon:**
```typescript
// M, L commands for each vertex, Z to close
```

**Polyline:**
```typescript
// M, L commands for points
// Handles holes with even-odd fill rule
```

### Rounded Path Generation

#### `ptsToStrRounded(points: Point[], cornerRadius: number): string`

Generates SVG path with rounded corners.

**Algorithm:**
1. Calculate arc points for each corner
2. Generate M, L, A commands
3. Handle convex and concave corners
4. Ensure smooth transitions

**SVG Arc Command:**
```
A rx ry x-axis-rotation large-arc-flag sweep-flag x y
```

## Performance Optimizations

### Caching

- **Bounding boxes** - Cached per shape
- **Vertices** - Recalculated only when shape changes
- **Snap targets** - Computed once per frame

### Early Exits

- **Empty shapes** - Return immediately
- **Outside viewport** - Skip rendering
- **Invalid operations** - Validate before calculation

### Efficient Algorithms

- **Point-in-shape** - Raycasting (O(n))
- **Bounding box** - Linear scan (O(n))
- **Snapping** - Distance checks (O(n))

## Edge Cases

### Degenerate Shapes

- **Zero area** - Handle gracefully
- **Collinear points** - Skip arc generation
- **Single point** - Return empty

### Extreme Values

- **Very large shapes** - May cause precision issues
- **Very small shapes** - Sub-millimeter precision
- **Extreme rotations** - Normalize to 0-360°

### Numerical Precision

- **Floating point errors** - Use epsilon comparisons
- **Coordinate overflow** - Validate ranges
- **Division by zero** - Check denominators

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [HATCHING_ENGINE.md](./HATCHING_ENGINE.md) - Hatching calculations
- [API_REFERENCE.md](./API_REFERENCE.md) - Function reference
- [FEATURES.md](./FEATURES.md) - User-facing features


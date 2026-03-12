# Boolean Operations Documentation

## Overview

Boolean operations combine multiple shapes using set operations (union, subtract, intersect, exclude). HatchStudio uses Paper.js for robust boolean calculations that handle complex geometries, compound paths, and holes.

## Operations

### Union

**Operation:** Combines all selected shapes into a single outline.

**Behavior:**
- Removes overlapping boundaries
- Preserves all areas
- Result is a single shape

**Example:**
```
Two overlapping circles → Single merged shape
```

**Use Cases:**
- Combine multiple shapes
- Create complex outlines
- Merge design elements

### Subtract

**Operation:** Removes the top shape's area from the bottom shape.

**Behavior:**
- First selected shape = base
- Remaining shapes = cutting tools
- Creates holes in base shape

**Example:**
```
Large circle - Small circle = Donut shape
```

**Use Cases:**
- Create holes
- Cut out sections
- Frame effects

### Intersect

**Operation:** Keeps only the overlapping area.

**Behavior:**
- Discards non-overlapping parts
- Result is intersection of all shapes
- Can produce multiple separate shapes

**Example:**
```
Two overlapping circles → Lens shape (overlap only)
```

**Use Cases:**
- Create masks
- Extract common areas
- Complex cutouts

### Exclude

**Operation:** Keeps everything except the overlapping area.

**Behavior:**
- Removes overlapping area
- Keeps non-overlapping parts
- Creates "frame" effect

**Example:**
```
Two overlapping circles → Two circles with gap in middle
```

**Use Cases:**
- Frame effects
- Negative space patterns
- Artistic effects

## Paper.js Integration

### Library

HatchStudio uses **Paper.js 0.12** for boolean operations.

**Why Paper.js:**
- Robust path operations
- Handles complex geometries
- Compound path support
- Well-tested library

### Initialization

```typescript
// Lazy initialization
let isPaperInitialized = false;

function initPaper() {
  if (isPaperInitialized) return true;
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1000;
  paper.setup(canvas);
  isPaperInitialized = true;
  return true;
}
```

**Note:** Paper.js uses an off-screen canvas (not rendered).

### Conversion Process

**1. Convert Shapes to Paper Paths:**
```typescript
const items = shapes.map(s => {
  const vertices = getShapeVertices(s);
  const path = new paper.Path();
  vertices.forEach(pt => path.add(new paper.Point(pt.x, pt.y)));
  path.closed = true;
  return path;
});
```

**2. Perform Operation:**
```typescript
let result = items[0];
for (let i = 1; i < items.length; i++) {
  if (op === 'union') {
    result = result.unite(items[i]);
  } else if (op === 'subtract') {
    result = result.subtract(items[i]);
  } else if (op === 'intersect') {
    result = result.intersect(items[i]);
  } else if (op === 'exclude') {
    result = result.exclude(items[i]);
  }
}
```

**3. Extract Geometry:**
```typescript
// Handle compound paths (with holes)
if (result instanceof paper.CompoundPath) {
  const children = result.children.filter(isPath)
    .sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
  
  const body = children[0];  // Largest = outline
  const holes = children.slice(1);  // Rest = holes
  
  return {
    points: body.segments.map(s => ({ x: s.point.x, y: s.point.y })),
    holes: holes.map(h => h.segments.map(s => ({ x: s.point.x, y: s.point.y })))
  };
}
```

## Compound Paths

### Definition

A compound path contains multiple sub-paths:
- **Body** - Main outline (largest area)
- **Holes** - Interior cutouts (smaller areas)

### Detection

Paper.js automatically creates compound paths when:
- Subtract operation creates holes
- Multiple separate regions exist
- Self-intersecting shapes are processed

### Processing

**Algorithm:**
1. Sort paths by area (descending)
2. Largest path = body (outline)
3. Smaller paths = holes
4. Extract vertices for each

**Code:**
```typescript
const children = item.children.filter(isPath)
  .sort((a, b) => Math.abs(b.area) - Math.abs(a.area));

const body = children[0];
const holes = children.slice(1);
```

### Hatching with Holes

Hatches automatically respect holes using **even-odd fill rule**:
- Ray enters outline → inside
- Ray enters hole → outside
- Ray exits hole → inside
- Ray exits outline → outside

See [HATCHING_ENGINE.md](./HATCHING_ENGINE.md) for details.

## Property Inheritance

### Parent Shape

The **first selected shape** is the "parent" and determines:

1. **Color** - Result inherits parent color
2. **Hatch Parameters** - Result inherits parent hatch settings
3. **Corner Radius** - Preserved if parent had it
4. **Outline Rendering** - Disabled by default

### Implementation

```typescript
const parentColor = selectedShapes[0].color || '#000000';
const parentHatch = state.hatchParams[selectedShapes[0].id];
const parentCornerRadius = selectedShapes[0].cornerRadius;

const newShape: PolylineShape = {
  // ... other properties
  color: parentColor,
  cornerRadius: parentCornerRadius
};

// Copy hatch params
if (parentHatch) {
  newHatch[newShape.id] = { 
    ...parentHatch, 
    renderOutline: false 
  };
}
```

## Result Type

### Polyline Shape

All boolean operation results are **PolylineShape** type:

```typescript
interface PolylineShape extends BaseShape {
  type: 'polyline';
  points: { x: number; y: number }[];
  holes?: { x: number; y: number }[][];
  cornerRadius?: number;
}
```

**Why Polyline:**
- Flexible point arrays
- Supports holes
- Can represent any complex geometry
- Compatible with hatching engine

### Vertex Extraction

Paper.js paths are flattened before extraction:

```typescript
body.flatten(0.5);  // Flatten curves to lines (0.5mm tolerance)
const points = body.segments.map(s => ({ 
  x: s.point.x, 
  y: s.point.y 
}));
```

**Flattening:**
- Converts curves to line segments
- Tolerance: 0.5mm
- Ensures compatibility with hatching

## Corner Radius Preservation

### Challenge

When applying corner radius to boolean results, the hatching must match the rounded outline exactly.

### Solution

Uses the same arc calculation as SVG outline:

1. **Winding Detection** - Determine polygon orientation
2. **Arc Center Calculation** - Perpendicular bisector method
3. **Concave Detection** - Handle internal corners
4. **Adaptive Sampling** - Generate smooth curves

**Key Principle:** Hatching path uses EXACT same arc center as SVG outline.

See `src/lib/geometry.ts` - `generateRoundedPolylinePoints()` for implementation.

## Edge Cases

### No Overlap

**Union:**
- Returns separate shapes
- Paper.js handles gracefully

**Subtract/Intersect/Exclude:**
- May return empty result
- Check for empty before creating shape

### Self-Intersecting Shapes

**Handling:**
- Paper.js processes correctly
- Even-odd rule applies
- May create multiple regions

### Degenerate Shapes

**Cases:**
- Zero area
- Single point
- Collinear points

**Handling:**
- Check for valid result
- Return empty array if invalid
- Log errors for debugging

### Multiple Shapes

**Order Matters:**
- First shape = parent (base)
- Remaining = operands (cutting tools)

**Example:**
```
Subtract with 3 shapes:
- Shape 1 (base) - Shape 2 - Shape 3
- Result: Base with two holes
```

## Performance

### Optimization

1. **Lazy Initialization** - Paper.js only initialized when needed
2. **Path Flattening** - Balance accuracy vs. performance
3. **Cleanup** - Remove temporary Paper.js items
4. **Error Handling** - Graceful failures

### Complexity

- **Time:** O(n × m) where n, m = shape complexities
- **Space:** O(v) where v = total vertices

For typical operations:
- 2 shapes × 100 vertices each = fast
- Complex shapes may take longer

## Usage Examples

### Create Donut

```typescript
// 1. Create two circles
const largeCircle = createEllipse(100, 100, 50, 50);
const smallCircle = createEllipse(100, 100, 30, 30);

// 2. Select both (large first)
selectShapes([largeCircle.id, smallCircle.id]);

// 3. Subtract
performBooleanOperation('subtract');

// Result: Donut shape with hole
```

### Combine Shapes

```typescript
// 1. Create multiple shapes
const rect1 = createRectangle(50, 50, 40, 40);
const rect2 = createRectangle(70, 70, 40, 40);
const circle = createEllipse(60, 60, 20, 20);

// 2. Select all
selectShapes([rect1.id, rect2.id, circle.id]);

// 3. Union
performBooleanOperation('union');

// Result: Single merged shape
```

### Create Frame

```typescript
// 1. Create outer and inner rectangles
const outer = createRectangle(100, 100, 80, 80);
const inner = createRectangle(100, 100, 60, 60);

// 2. Select both (outer first)
selectShapes([outer.id, inner.id]);

// 3. Exclude
performBooleanOperation('exclude');

// Result: Frame (outer minus inner)
```

## Related Documentation

- [FEATURES.md](./FEATURES.md) - User-facing feature documentation
- [HATCHING_ENGINE.md](./HATCHING_ENGINE.md) - Hatching with holes
- [GEOMETRY_SYSTEM.md](./GEOMETRY_SYSTEM.md) - Geometry calculations
- [API_REFERENCE.md](./API_REFERENCE.md) - API details


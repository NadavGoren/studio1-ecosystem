# Export System Documentation

## Overview

HatchStudio exports designs as SVG files optimized for pen plotters. The export system ensures all dimensions are in millimeters, includes hatching paths, and produces plotter-ready output.

## SVG Format

### File Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="210mm" 
     height="297mm" 
     viewBox="0 0 210 297">
  <defs>
    <style>
      .shape { fill: none; stroke-linecap: round; stroke-linejoin: round; }
    </style>
  </defs>
  <g id="paper">
    <!-- Paper rectangle -->
    <!-- Safe margin rectangle -->
    <!-- Shape paths -->
  </g>
</svg>
```

### Critical Attributes

**Width and Height:**
- Explicit `mm` units: `width="210mm" height="297mm"`
- Matches paper settings exactly
- Required for plotter software

**ViewBox:**
- `viewBox="0 0 {width} {height}"`
- No units (user units = mm)
- Matches width/height values

## Millimeter Units

### Coordinate System

**1 SVG User Unit = 1 Millimeter**

- All coordinates in mm
- No pixel conversion
- Direct mm to SVG mapping

### Export Process

```typescript
const width = paper.width;  // mm
const height = paper.height;  // mm

// SVG header
`<svg width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">`
```

### Why Millimeters?

- **Pen plotters** work in physical units
- **Precision** - Exact dimensions
- **Compatibility** - Plotter software expects mm
- **No scaling** - Direct 1:1 mapping

## Shape Export

### Outline Paths

**Generation:**
```typescript
const path = shapeToPath(shape, shapes);
// Returns SVG path d attribute
```

**Rendering:**
```xml
<path d="M 10,10 L 50,10 L 50,30 L 10,30 Z" 
      fill="none" 
      stroke="#000000" 
      stroke-width="0.4" />
```

**Conditions:**
- Rendered if `renderOutline: true` OR
- Shape is a Line (always shows outline) OR
- Hatching is disabled

### Hatch Paths

**Generation:**
```typescript
const hatchPaths = generateAllHatchLines(shape, params);
// Returns array of SVG path strings
```

**Rendering:**
```xml
<path d="M 10,10 L 50,10" fill="none" stroke="#000000" stroke-width="0.4" />
<path d="M 10,20 L 50,20" fill="none" stroke="#000000" stroke-width="0.4" />
```

**Features:**
- Separate path elements for each line
- Zig-zag creates single continuous path
- Cross-hatch adds second pass

### Rendering Order

1. **Paper rectangle** (white background)
2. **Safe margin** (dashed line)
3. **Hatch paths** (for each shape)
4. **Outline paths** (for each shape)

**Z-order:**
- Shapes rendered in layer order
- Top of list = front (rendered last)

## Export Options

### Global Stroke Width

**Setting:**
```typescript
paper.globalStrokeWidth  // mm (0.1-5)
```

**Application:**
- Applied to all shapes
- Applied to all hatches
- Overrides individual stroke widths

**Export:**
```xml
stroke-width="${paper.globalStrokeWidth}"
```

### Global Color Override

**Setting:**
```typescript
paper.globalColorOverride  // boolean
paper.globalColor  // hex color
```

**Application:**
- When enabled, overrides all shape colors
- Useful for monochrome plotting
- Applied to outlines and hatches

**Export:**
```typescript
const color = paper.globalColorOverride 
  ? paper.globalColor 
  : shape.color;
```

### Visibility

**Rule:**
- Only visible shapes are exported
- Invisible shapes (eye icon off) are skipped
- Locked shapes are still exported (if visible)

**Export:**
```typescript
shapes.forEach(shape => {
  if (!shape.visible) return;  // Skip invisible
  // Export shape
});
```

## Path Optimization

### Zero-Length Paths

**Filtering:**
- Paths < 0.1mm are culled
- Prevents unnecessary elements
- Reduces file size

**Implementation:**
```typescript
if (Math.hypot(end.x - start.x, end.y - start.y) > 0.1) {
  segments.push({ start, end });
}
```

### Path Formatting

**Precision:**
- Coordinates rounded to 2 decimal places
- Sufficient for mm precision
- Reduces file size

**Example:**
```typescript
`M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
```

## Paper Elements

### Paper Rectangle

**Purpose:**
- Defines paper boundaries
- White background
- Light gray border

**Export:**
```xml
<rect x="0" y="0" 
      width="${width}" 
      height="${height}" 
      fill="white" 
      stroke="#ccc" 
      stroke-width="0.1"/>
```

### Safe Margin

**Purpose:**
- Visual guide for safe area
- Dashed line
- Inside paper edge

**Export:**
```xml
<rect x="${margin}" 
      y="${margin}" 
      width="${width - margin * 2}" 
      height="${height - margin * 2}" 
      fill="none" 
      stroke="#ddd" 
      stroke-width="0.1" 
      stroke-dasharray="2,2"/>
```

## Export Function

### `exportToSVG(state: ProjectState): string`

**Location:** `src/lib/svg-export.ts`

**Process:**
1. Generate SVG header
2. Add paper rectangle
3. Add safe margin
4. For each visible shape:
   - Generate hatch paths
   - Generate outline path
   - Add to SVG
5. Close SVG

**Returns:**
- Complete SVG XML string
- Ready for download or file save

### `downloadSVG(svgContent: string, filename?: string): void`

**Location:** `src/lib/svg-export.ts`

**Process:**
1. Create Blob from SVG string
2. Create object URL
3. Create download link
4. Trigger click
5. Revoke URL

**Usage:**
```typescript
const svg = exportToSVG(state);
downloadSVG(svg, 'design.svg');
```

## File Specifications

### SVG Version

- **SVG 1.1** - Standard version
- **UTF-8 encoding** - Text encoding
- **XML declaration** - Standard header

### Compatibility

**Pen Plotters:**
- Axidraw - Full compatibility
- iDraw - Full compatibility
- Other plotters - Standard SVG support

**Software:**
- Inkscape - Opens correctly
- Illustrator - Opens correctly
- Browser - Renders correctly

### File Size

**Factors:**
- Number of shapes
- Hatch density
- Path complexity

**Optimization:**
- Zero-length path culling
- Coordinate precision (2 decimals)
- Efficient path generation

## Examples

### Simple Rectangle

```xml
<svg width="210mm" height="297mm" viewBox="0 0 210 297">
  <g id="paper">
    <rect x="0" y="0" width="210" height="297" fill="white" stroke="#ccc" stroke-width="0.1"/>
    <rect x="10" y="10" width="10" height="10" fill="none" stroke="#ddd" stroke-width="0.1" stroke-dasharray="2,2"/>
    <path d="M 50,50 L 100,50 L 100,80 L 50,80 Z" fill="none" stroke="#000000" stroke-width="0.4"/>
  </g>
</svg>
```

### Hatched Shape

```xml
<svg width="210mm" height="297mm" viewBox="0 0 210 297">
  <g id="paper">
    <!-- Paper and margin -->
    <!-- Hatch paths -->
    <path d="M 50,50 L 100,50" fill="none" stroke="#000000" stroke-width="0.4"/>
    <path d="M 50,60 L 100,60" fill="none" stroke="#000000" stroke-width="0.4"/>
    <path d="M 50,70 L 100,70" fill="none" stroke="#000000" stroke-width="0.4"/>
    <!-- Outline (if enabled) -->
    <path d="M 50,50 L 100,50 L 100,80 L 50,80 Z" fill="none" stroke="#000000" stroke-width="0.4"/>
  </g>
</svg>
```

### Zig-Zag Hatch

```xml
<!-- Single continuous path -->
<path d="M 50,50 L 100,50 L 100,60 L 50,60 L 50,70 L 100,70" 
      fill="none" 
      stroke="#000000" 
      stroke-width="0.4"/>
```

## Best Practices

### For Pen Plotters

1. **Use appropriate density** - Balance detail vs. plot time
2. **Enable zig-zag** - Reduces pen-up movements
3. **Disable outlines** - If not needed (faster plotting)
4. **Check visibility** - Only export what's needed
5. **Test with plotter software** - Verify before plotting

### File Optimization

1. **Remove invisible shapes** - Clean up before export
2. **Optimize hatch density** - Not too dense (slow plotting)
3. **Use global stroke width** - Consistent line weight
4. **Check file size** - Large files may be slow to process

## Related Documentation

- [HATCHING_ENGINE.md](./HATCHING_ENGINE.md) - Hatching details
- [FEATURES.md](./FEATURES.md) - Export feature
- [API_REFERENCE.md](./API_REFERENCE.md) - Export functions


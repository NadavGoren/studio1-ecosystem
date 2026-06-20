# STL Rotation Feature Implementation

## Overview
Added a feature to rotate STL objects in 90-degree increments around X, Y, and Z axes. The object automatically "sticks to floor" after each rotation.

## Changes Made

### 1. State Management (src/loaders/stlLoader.js)
- Added rotation state variables: `stlRotationX`, `stlRotationY`, `stlRotationZ`
- Added `getSTLRotation()` function to retrieve current rotation angles
- Added `rotateSTL90(axis)` function to rotate by 90° increments
- Fixed STL size to 120mm (independent of cube size slider)

### 2. UI Controls (3d-generator.html)
Added rotation control buttons in the Model section:
- **X-Axis Rotation Button**: Rotates model 90° around X-axis
- **Y-Axis Rotation Button**: Rotates model 90° around Y-axis
- **Z-Axis Rotation Button**: Rotates model 90° around Z-axis

Each button shows a rotation icon (↻) and axis label. Buttons only appear when an STL file is loaded.

### 3. Rendering Logic (src/rendering/renderer.js)
- Import `getSTLRotation` from stlLoader
- Apply STL rotations BEFORE orbit rotation
- Re-normalize mesh after rotation to ensure it sticks to floor:
  - Find minimum Z value after rotation
  - Shift all vertices so minimum Z = 0
- Rotate face normals along with vertices for correct lighting/backface culling

### 4. Styling (3d-generator.css)
Added hover effects for rotation buttons:
- Lift effect on hover
- Rotation animation of icon on hover
- Color transition to accent color
- Subtle shadow effects

### 5. Object Size Behavior
- **Both Cube and STL Mode**: Object Size slider controls model size (20-200mm)
- STL meshes are automatically re-normalized when the size slider changes
- Original mesh is stored for efficient re-scaling

## How to Use

1. **Load an STL file**: Click or drag-drop STL file into the drop zone
2. **Rotate as needed**: Click rotation buttons to rotate in 90° increments
   - Each click rotates 90° around the selected axis
   - Rotation wraps at 360° (0° → 90° → 180° → 270° → 0°)
3. **Object stays on floor**: After each rotation, the model automatically repositions to floor level
4. **Orbit view**: Use mouse drag (Rotate tool) to orbit around the model as usual

## Technical Details

### Rotation Order
Rotations are applied in this order:
1. STL fixed rotations (X → Y → Z)
2. Floor normalization (shift to z=0)
3. Orbit rotation (horizontal spin around Z-axis)

### Stick to Floor Algorithm
```javascript
// After rotation, find minimum Z
const minZ = Math.min(...vertices.map(v => v.z));

// Shift all vertices up so minimum Z = 0
vertices = vertices.map(v => ({
  x: v.x,
  y: v.y,
  z: v.z - minZ
}));
```

### Normal Rotation
Face normals are rotated along with vertices to maintain proper lighting and back-face culling.

## Testing

To test the feature:
1. Open http://localhost:8001/3d-generator.html
2. Scroll down to "Model" section
3. Load test-cube.stl
4. Click rotation buttons and verify:
   - Object rotates 90° on each click
   - Object stays on floor after rotation
   - Lighting updates correctly
   - Can still orbit view with mouse

## Known Limitations

- Only 90° increments (by design for fixing axis-aligned export issues)
- Rotations are cumulative (stored as 0°, 90°, 180°, 270°)
- Rotations reset when clearing STL file

## Future Enhancements (Optional)

- Add rotation reset button
- Display current rotation angles
- Allow custom rotation angles (not just 90°)
- Add rotation preview/animation


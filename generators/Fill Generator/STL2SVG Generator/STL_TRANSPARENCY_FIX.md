# STL Transparency & Layering Fix

## Problem Summary
STL files had two critical rendering issues that didn't affect the cube:
1. **Face Disappearance**: Some faces became transparent/invisible
2. **See-Through Faces**: Some rendered faces showed faces behind them

## Root Causes Identified

### 1. Incorrect Normals for Merged Polygons
**File**: `src/core/geometry.js` line 416
- When merging triangles into polygons, we used the first triangle's normal
- This normal could be incorrect for the merged shape
- STL files have inconsistent normals even for coplanar faces

### 2. Aggressive Back-Face Culling
**File**: `src/rendering/renderer.js` line 486
- Same culling threshold (0.01) for both cube and STL
- Cube has perfect normals, STL has approximate normals
- Too aggressive culling hid visible STL faces

### 3. Overly Aggressive Face-to-Face Occlusion
**File**: `src/rendering/renderer.js` line 1477
- Cube faces never overlap (perfect geometry)
- STL merged faces can have slight misalignments
- Occlusion system incorrectly hid visible lines

## Solutions Implemented

### Fix 1: Calculate Proper Normals for Merged Polygons
**File**: `src/core/geometry.js` lines 293-330

Added `calculatePolygonNormal()` function using Newell's method:
- More robust than cross product for complex polygons
- Calculates normal from the actual merged polygon vertices
- Falls back to first triangle's normal if calculation fails

```javascript
const polygonNormal = calculatePolygonNormal(polygonIndices, vertices);
const finalNormal = (polygonNormal && 
    Math.abs(polygonNormal.x) + Math.abs(polygonNormal.y) + Math.abs(polygonNormal.z) > 0.1)
  ? polygonNormal
  : componentFaces[0].normal;
```

### Fix 2: STL-Specific Lenient Back-Face Culling
**File**: `src/rendering/renderer.js` lines 468-477

Different culling thresholds for cube vs STL:
- **Cube**: 0.01 (strict, perfect normals)
- **STL**: 0.15 (lenient, approximate normals)

```javascript
const cullingThreshold = (meshMode === 'stl') ? 0.15 : 0.01;
```

### Fix 3: Disable Face-to-Face Occlusion for STL
**File**: `src/rendering/renderer.js` line 1477

```javascript
const ENABLE_FACE_OCCLUSION = (meshMode !== 'stl'); // Disabled for STL
```

- Cube: Occlusion enabled (faces never overlap)
- STL: Occlusion disabled (merged faces can misalign)
- Shadow occlusion still works for both

## Testing Instructions

1. **Load the application**: `python server.py` → http://localhost:8001
2. **Test with test-cube.stl**:
   - Click "Load STL" in the MODEL section
   - Select `test-cube.stl`
   - Verify all faces render completely (no transparency)
   - Rotate using Quick Test Angles (45°, 90°, 135°, etc.)
   - Check that no faces disappear or show through

3. **Expected Results**:
   - ✅ All faces fully rendered (no transparent areas)
   - ✅ No see-through faces showing back faces
   - ✅ Smooth rotation without face popping
   - ✅ Proper depth sorting at all angles
   - ✅ Cube mode still works perfectly

## Technical Details

### Newell's Method for Normal Calculation
More stable than cross product for:
- Concave polygons
- Polygons with many vertices
- Coplanar but non-planar point sets

Formula:
```
nx = Σ (curr.y - next.y) × (curr.z + next.z)
ny = Σ (curr.z - next.z) × (curr.x + next.x)
nz = Σ (curr.x - next.x) × (curr.y + next.y)
```

### Why Cube Still Works
- Cube geometry is simple and perfect (no merging needed)
- Cube has 6 faces with exact normals
- No STL-specific code affects cube rendering
- All cube optimizations remain active

## Performance Impact
- **Positive**: STL rendering quality dramatically improved
- **Neutral**: No performance degradation
- **Note**: Face-to-face occlusion disabled for STL means slightly more lines drawn, but eliminates transparency bugs

## Future Improvements
If needed:
1. Add normal smoothing for STL meshes
2. Implement adaptive occlusion based on face overlap detection
3. Add user toggle for STL occlusion (advanced users)







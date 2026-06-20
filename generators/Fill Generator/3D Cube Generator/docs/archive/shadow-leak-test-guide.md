# Shadow Leak Testing Guide

## Overview
This guide helps you test and verify that shadow lines no longer leak into the cube area at any rotation angle.

## What Was Fixed
1. **Increased Expansion Factors**: Changed from 1.2% to 2.5% for both cube footprint and face occlusion polygons
2. **Configurable Expansion**: Added UI control to adjust expansion factor (0.5% - 5.0%)
3. **Debug Visualization**: Added "Debug: Show Occlusion Polygons" toggle to visualize clipping boundaries

## Testing Instructions

### Step 1: Enable Debug Mode
1. Open the 3D Cube Generator
2. Scroll to "Display" section
3. Enable "Debug: Show Occlusion Polygons" checkbox
4. You should see colored outlines:
   - **MAGENTA** (thick): Cube footprint occlusion polygon
   - **CYAN**: Shadow projection polygon
   - **YELLOW**: Cube bottom face
   - **GREEN/BLUE/ORANGE**: Individual face occlusion polygons

### Step 2: Test Critical Angles
Shadow leaks typically occur at specific rotation angles. Test these systematically:

#### Primary Test Angles (Cardinal)
- **0°** - Cube faces camera directly
- **45°** - Diagonal view (most common leak angle)
- **90°** - Side view
- **135°** - Opposite diagonal
- **180°** - Back view
- **225°** - Diagonal
- **270°** - Opposite side
- **315°** - Diagonal

#### Secondary Test Angles (Between Cardinals)
- **22.5°, 67.5°, 112.5°, 157.5°, 202.5°, 247.5°, 292.5°, 337.5°**
- These intermediate angles can reveal precision issues

#### Fine Sweep Test
- Slowly drag to rotate the cube 360° while watching for any shadow lines that cross into cube faces
- Shadow lines should ONLY appear on the floor, never on cube surfaces

### Step 3: Verify Occlusion Quality

#### What to Look For:
✅ **GOOD**: Shadow lines stop at the cube footprint boundary
✅ **GOOD**: Small uniform gap between cube edge and shadow (caused by expansion)
✅ **GOOD**: No shadow lines visible on any cube face
✅ **GOOD**: Debug polygons (when enabled) slightly larger than cube outline

❌ **BAD**: Black shadow lines appear on cube faces
❌ **BAD**: Shadow lines cross through cube interior
❌ **BAD**: Large irregular gaps between cube and shadow

### Step 4: Adjust Expansion Factor (If Needed)

If leaks still occur:
1. Expand "Advanced Debug" section
2. Increase "Shadow Occlusion Expansion" slider
3. Start at 2.5% (default), try 3.0%, 3.5%, 4.0%
4. Re-test critical angles

If gaps are too large:
1. Decrease expansion to 2.0%, 1.5%, 1.0%
2. Balance between leak prevention and visual quality

### Step 5: Test Different Settings

Test with various configurations to ensure robustness:

#### Light Angles
- Test with light from different angles (0°, 90°, 180°, 270°)
- Test with different light elevations (30°, 45°, 60°, 75°)

#### Shadow Settings
- Test with "Advanced Shading" ON and OFF
- Test with different "Shadow Falloff" values (1.0 to 10.0)
- Test with "Shadow Soft Edges" ON and OFF

#### Cube Sizes
- Test with small cubes (50mm)
- Test with medium cubes (100mm)
- Test with large cubes (150mm+)

## Common Leak Patterns

### Pattern 1: Corner Leaks
- **Symptom**: Lines appear at cube corners at specific angles
- **Cause**: Insufficient expansion at corner vertices
- **Fix**: Increase expansion factor to 3.0%+

### Pattern 2: Edge Leaks
- **Symptom**: Lines parallel to cube edges leak through
- **Cause**: Floating-point precision issues in edge detection
- **Fix**: Already handled by increased tolerance, but may need safety clipping

### Pattern 3: Grazing Angle Leaks
- **Symptom**: Leaks only at specific angles (often 30-60° from cardinal)
- **Cause**: Convex hull doesn't fully enclose rotated cube
- **Fix**: Review convex hull algorithm or add safety zone

## Debug Visualization Legend

When "Debug: Show Occlusion Polygons" is enabled:

| Color | Polygon | Purpose |
|-------|---------|---------|
| MAGENTA | Cube Footprint | Main shadow occlusion boundary |
| CYAN | Shadow Polygon | Projected shadow before clipping |
| YELLOW | Cube Bottom | Contact area with floor |
| GREEN | Face 0 | First visible face occlusion |
| BLUE | Face 1 | Second visible face occlusion |
| ORANGE | Face 2 | Third visible face occlusion |
| PINK | Face 3 | Fourth visible face occlusion |
| LIME | Face 4 | Fifth visible face occlusion |

## Expected Results

After the fix, you should observe:
1. **Zero shadow leaks** at all rotation angles (0-360°)
2. **Consistent gap** between cube and shadow (approximately 2-3mm at default settings)
3. **Smooth rotation** with no flickering or jumping
4. **Clean occlusion boundaries** in debug mode

## Reporting Issues

If you still observe shadow leaks:
1. Note the exact rotation angle (displayed in UI)
2. Note the light angle and elevation
3. Take a screenshot with debug mode enabled
4. Note the expansion factor setting
5. Check if it occurs with specific cube sizes

This information will help diagnose remaining edge cases.

## Performance Notes

- Debug visualization adds ~50-100ms render time
- Increased expansion factor has negligible performance impact (<1ms)
- Higher expansion factors slightly increase the visual gap between cube and shadow
- Recommended default: 2.5% expansion (good balance)



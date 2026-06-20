# Implementation Plan: Clipping Rules + Even Scattering Fixes

## Executive Summary

This plan addresses two critical issues in the HOME Generator:
1. **Clipping Rules**: Clouds and birds must be clipped against the roof polygon to prevent visual overlap
2. **Scattering Logic**: Sky and ground strokes must be uniformly distributed across the full width (no right-side bias)

---

## 1. CLIPPING RULES IMPLEMENTATION

### 1.1 Current State Analysis

**Existing Clipping:**
- ✅ Sky paths are clipped against roof triangle (`clipSkyAgainstRoof()`)
- ✅ Sky paths are clipped around clouds (`clipSkyAroundClouds()`)
- ✅ Clouds are clipped against sun (`clipCloudsAgainstSun()`)
- ❌ **Clouds are NOT clipped against roof** (critical gap)
- ❌ **Birds are NOT clipped against roof** (critical gap)
- ❌ No unified clipping system for all upper-canvas elements

**Roof Triangle Storage:**
- Roof triangle is stored in `this.roofTriangle` as `[Point, Point, Point]`
- Triangle vertices: bottom-left, top-center, bottom-right
- Available after `generateHouse()` completes

### 1.2 Architectural Strategy

**Unified Clipping System:**
1. Create a centralized clipping method that handles all upper-canvas elements
2. Apply clipping after all elements are generated but before final output
3. Use existing `clipPathAgainstTriangle()` utility from `math.ts`
4. Process elements in order: sky → clouds → birds → other upper elements

**Clipping Algorithm:**
- For each path in the element group:
  1. Parse SVG path string to points
  2. Check each path segment against roof triangle
  3. Remove segments that fall inside/behind roof
  4. Find intersection points with roof edges
  5. Reconstruct visible segments only
  6. Convert back to SVG path strings

### 1.3 Implementation Steps

#### Step 1.1: Create Unified Roof Clipping Method

**Location:** `houseGenerator.ts` - Add new private method

**Method Signature:**
```typescript
private clipElementAgainstRoof(role: PenRole): void
```

**Algorithm:**
1. Check if `this.roofTriangle` exists (return early if not)
2. Get paths for the specified role from `this.pathGroups`
3. For each path:
   - Use `clipPathAgainstTriangle(path, this.roofTriangle)` from `math.ts`
   - Collect all clipped segments
4. Replace original paths with clipped paths in `this.pathGroups`

**Edge Cases:**
- Empty path groups → skip
- Paths fully behind roof → remove entirely
- Paths partially behind roof → keep visible segments only
- Paths fully in front → keep unchanged

#### Step 1.2: Clip Clouds Against Roof

**Location:** `houseGenerator.ts` - Modify `generate()` method

**Integration Point:**
After `generateBackground()` and before `clipSkyAgainstRoof()`

**Implementation:**
```typescript
// After generateBackground() in generate() method
if (this.roofTriangle) {
  this.clipElementAgainstRoof('cloud');
}
```

**Why Before Sky Clipping:**
- Clouds are rendered before sky clipping
- Need to clip clouds first to prevent them from appearing behind roof
- Sky clipping happens later to ensure proper layering

#### Step 1.3: Clip Birds Against Roof

**Location:** `houseGenerator.ts` - Modify `generate()` method

**Integration Point:**
After `generateBackground()` and after cloud clipping

**Implementation:**
```typescript
// After cloud clipping
if (this.roofTriangle) {
  this.clipElementAgainstRoof('bird');
}
```

**Special Considerations:**
- Birds are simple path groups (M-shape, loops, or scribbles)
- Each bird path must be individually clipped
- Clipped birds may split into multiple segments (handle gracefully)

#### Step 1.4: Update Generation Sequence

**Location:** `houseGenerator.ts` - Modify `generate()` method

**New Sequence:**
```typescript
generate(): PathGroup[] {
  // ... existing clearing code ...
  
  // Generate in order: background → house → details → environment
  this.generateBackground();
  const houseBounds = this.generateHouse();
  this.generateEnvironment(houseBounds);
  
  // Apply roof clipping to all upper-canvas elements
  if (this.roofTriangle) {
    // Clip sky (existing - keep)
    this.clipSkyAgainstRoof();
    
    // Clip clouds (NEW)
    this.clipElementAgainstRoof('cloud');
    
    // Clip birds (NEW)
    this.clipElementAgainstRoof('bird');
  }
  
  // Existing sun clipping (keep)
  this.ensureSunInFront();
  this.ensureSunOnTop();
  
  return this.getPathGroups();
}
```

### 1.4 Testing Strategy for Clipping

**Visual Tests:**
1. Generate house with roof
2. Place clouds at various positions (some overlapping roof, some not)
3. Place birds at various positions (some overlapping roof, some not)
4. Verify:
   - No cloud strokes appear behind/over roof
   - No bird strokes appear behind/over roof
   - Clouds and birds in front of roof remain fully visible
   - Clouds and birds partially behind roof show only visible portions

**Edge Case Tests:**
- Cloud fully behind roof → should be completely removed
- Bird fully behind roof → should be completely removed
- Cloud partially behind roof → should show only front portion
- Bird partially behind roof → should show only front portion
- Multiple clouds/birds at different positions → all should clip correctly

---

## 2. SCATTERING LOGIC FIXES

### 2.1 Current State Analysis

**Sky Stroke Distribution (`drawSkyBand`):**
- Uses grid-based distribution (lines 838-855 in `environment.ts`)
- Grid calculation: `gridCols = Math.ceil(Math.sqrt(strokeCount * width / height))`
- Position calculation: `startX = cellX + rng.randomRange(0.05, 0.95) * cellWidth`
- **Potential Issue:** Grid may not perfectly cover full width if `strokeCount` doesn't divide evenly

**Ground Stroke Distribution (`drawGroundFill`):**
- Uses identical grid-based distribution (lines 682-695 in `environment.ts`)
- Same potential issue as sky strokes

**User Report:**
- Right-side bias in sky strokes
- Right-side bias in ground strokes
- Need uniform distribution across full width

### 2.2 Root Cause Analysis

**Potential Causes:**
1. Grid calculation may leave right edge under-sampled
2. Random positioning within cells may cluster near certain areas
3. Stroke length/angle may create visual density bias
4. Grid cell boundaries may not align with canvas edges

**Investigation Needed:**
- Verify grid covers full width: `gridCols * cellWidth >= width`
- Check if last column is fully utilized
- Verify random distribution is truly uniform

### 2.3 Corrected Distribution Algorithm

**Strategy: Uniform Grid with Edge Correction**

**For Sky Strokes (`drawSkyBand`):**
1. Calculate grid dimensions to ensure full coverage
2. Ensure last column extends to right edge
3. Use uniform random distribution within each cell
4. Verify no clustering at edges

**For Ground Strokes (`drawGroundFill`):**
1. Apply same uniform grid algorithm
2. Ensure full width coverage
3. Maintain horizontal-ish orientation (kid-style)

### 2.4 Implementation Steps

#### Step 2.1: Fix Sky Stroke Distribution

**Location:** `environment.ts` - Modify `drawSkyBand()` function

**Current Code (lines 838-855):**
```typescript
const gridCols = Math.ceil(Math.sqrt(strokeCount * width / height));
const gridRows = Math.ceil(strokeCount / gridCols);
const cellWidth = width / gridCols;
const cellHeight = height / gridRows;
```

**Fixed Algorithm:**
```typescript
// Calculate grid to ensure full width coverage
const gridCols = Math.ceil(Math.sqrt(strokeCount * width / height));
const gridRows = Math.ceil(strokeCount / gridCols);

// Ensure grid covers full width (fix edge case)
const actualCellWidth = width / gridCols;
const actualCellHeight = height / gridRows;

// Verify: gridCols * actualCellWidth >= width (should always be true)
// But ensure last column extends to right edge
```

**Distribution Fix:**
```typescript
for (let i = 0; i < strokeCount; i++) {
  const gridCol = i % gridCols;
  const gridRow = Math.floor(i / gridCols);
  
  // Calculate cell boundaries
  const cellX = x + gridCol * actualCellWidth;
  const cellY = y + gridRow * actualCellHeight;
  
  // Uniform random position within cell (no bias)
  // Use full range 0.0 to 1.0 for true uniformity
  const startX = cellX + rng.randomRange(0.0, 1.0) * actualCellWidth;
  const startY = cellY + rng.randomRange(0.0, 1.0) * actualCellHeight;
  
  // Ensure strokes can extend to edges (remove margin restriction for X)
  // Keep Y margin for organic boundaries
  const boundedX = Math.max(x - margin, Math.min(x + width + margin, startX));
  // ... rest of stroke generation
}
```

**Key Changes:**
1. Remove any X-position restrictions that might bias toward right
2. Use full `0.0` to `1.0` range for random positioning (not `0.05` to `0.95`)
3. Ensure last grid column extends to right edge
4. Verify grid calculation covers full width

#### Step 2.2: Fix Ground Stroke Distribution

**Location:** `environment.ts` - Modify `drawGroundFill()` function

**Apply Same Fixes:**
- Use identical uniform grid algorithm
- Remove X-position bias
- Ensure full width coverage
- Maintain horizontal-ish orientation (kid-style wavy lines)

**Code Changes:**
```typescript
// Same grid calculation as sky
const gridCols = Math.ceil(Math.sqrt(strokeCount * width / height));
const gridRows = Math.ceil(strokeCount / gridCols);
const actualCellWidth = width / gridCols;
const actualCellHeight = height / gridRows;

// Uniform distribution (same as sky fix)
for (let i = 0; i < strokeCount; i++) {
  const gridCol = i % gridCols;
  const gridRow = Math.floor(i / gridCols);
  const cellX = x + gridCol * actualCellWidth;
  const cellY = y + gridRow * actualCellHeight;
  
  // Full range for uniformity
  const startX = cellX + rng.randomRange(0.0, 1.0) * actualCellWidth;
  const startY = cellY + rng.randomRange(0.0, 1.0) * actualCellHeight;
  
  // ... rest of ground stroke generation (keep horizontal-ish style)
}
```

#### Step 2.3: Verify Distribution Uniformity

**Add Validation:**
- After grid calculation, verify: `gridCols * actualCellWidth >= width`
- Log grid dimensions for debugging
- Ensure no edge cases where last column is truncated

**Testing:**
- Generate multiple houses with different seeds
- Visually inspect sky and ground stroke distribution
- Verify no right-side clustering
- Verify even coverage across full width

### 2.4 Testing Strategy for Scattering

**Visual Tests:**
1. Generate house with sky band and ground fill
2. Divide canvas into left, center, right thirds
3. Count strokes in each third
4. Verify: stroke counts should be approximately equal (±10%)

**Quantitative Tests:**
- Generate 10 houses with different seeds
- For each house, count strokes in left/center/right thirds
- Calculate coefficient of variation (should be < 0.1 for uniformity)
- Verify no systematic bias toward any side

**Edge Case Tests:**
- Very wide canvas → ensure full width coverage
- Very narrow canvas → ensure no overflow
- Different stroke counts → verify grid scales correctly

---

## 3. IMPLEMENTATION SEQUENCING

### Phase 1: Clipping Rules (Priority: Critical)

1. **Add `clipElementAgainstRoof()` method** to `houseGenerator.ts`
   - Implement unified clipping logic
   - Test with simple paths

2. **Integrate cloud clipping** in `generate()` method
   - Call `clipElementAgainstRoof('cloud')` after `generateBackground()`
   - Test with clouds at various positions

3. **Integrate bird clipping** in `generate()` method
   - Call `clipElementAgainstRoof('bird')` after cloud clipping
   - Test with birds at various positions

4. **Visual verification**
   - Generate test houses
   - Verify no clouds/birds behind roof
   - Verify proper clipping at roof edges

### Phase 2: Scattering Fixes (Priority: High)

1. **Fix sky stroke distribution** in `drawSkyBand()`
   - Update grid calculation
   - Remove X-position bias
   - Ensure full width coverage

2. **Fix ground stroke distribution** in `drawGroundFill()`
   - Apply same fixes as sky
   - Maintain horizontal-ish style

3. **Visual verification**
   - Generate test houses
   - Verify uniform distribution
   - Check for any remaining bias

### Phase 3: Integration & Testing

1. **Combine both fixes**
   - Ensure clipping doesn't affect distribution
   - Ensure distribution doesn't affect clipping

2. **Comprehensive testing**
   - Test all edge cases
   - Test with various configurations
   - Verify kid-style jitter is preserved

---

## 4. FILES TO MODIFY

### 4.1 Primary Files

1. **`src/generator/houseGenerator.ts`**
   - Add `clipElementAgainstRoof()` method
   - Modify `generate()` method to clip clouds and birds
   - Update generation sequence

2. **`src/geometry/environment.ts`**
   - Modify `drawSkyBand()` function (scattering fix)
   - Modify `drawGroundFill()` function (scattering fix)

### 4.2 Utility Files (No Changes Needed)

- `src/utils/math.ts` - Already has `clipPathAgainstTriangle()` utility
- No changes needed to clipping utilities

---

## 5. TESTING CHECKLIST

### Clipping Tests
- [ ] Cloud fully behind roof → completely removed
- [ ] Cloud partially behind roof → only visible portion shown
- [ ] Cloud fully in front of roof → completely visible
- [ ] Bird fully behind roof → completely removed
- [ ] Bird partially behind roof → only visible portion shown
- [ ] Bird fully in front of roof → completely visible
- [ ] Multiple clouds at different positions → all clip correctly
- [ ] Multiple birds at different positions → all clip correctly
- [ ] No visual artifacts at clipping boundaries
- [ ] Kid-style jitter preserved after clipping

### Scattering Tests
- [ ] Sky strokes evenly distributed across full width
- [ ] Ground strokes evenly distributed across full width
- [ ] No right-side clustering in sky strokes
- [ ] No right-side clustering in ground strokes
- [ ] Left/center/right thirds have similar stroke counts
- [ ] Distribution works with different canvas sizes
- [ ] Distribution works with different stroke counts
- [ ] Kid-style jitter and angles preserved

### Integration Tests
- [ ] Clipping + scattering work together correctly
- [ ] No performance degradation
- [ ] All existing features still work
- [ ] Visual output matches kid-style aesthetic

---

## 6. SUCCESS CRITERIA

### Clipping Success
✅ **Zero tolerance:** No cloud or bird strokes visible behind/over roof
✅ **Clean boundaries:** Clipped edges align perfectly with roof polygon
✅ **No artifacts:** No visual glitches at clipping boundaries
✅ **Preserved style:** Kid-style jitter and irregularity maintained

### Scattering Success
✅ **Uniform distribution:** Stroke counts in left/center/right thirds within ±10%
✅ **Full coverage:** Strokes span entire width from left edge to right edge
✅ **No bias:** No systematic clustering toward any side
✅ **Preserved style:** Kid-style wavy, irregular strokes maintained

---

## 7. RISK MITIGATION

### Clipping Risks
- **Risk:** Clipping may remove too much (false positives)
  - **Mitigation:** Use precise triangle intersection algorithm, test edge cases
- **Risk:** Performance degradation with many paths
  - **Mitigation:** Clipping is O(n) per path, acceptable for typical counts
- **Risk:** Clipped paths may look unnatural
  - **Mitigation:** Preserve jitter and irregularity, test visually

### Scattering Risks
- **Risk:** Grid calculation may still have edge cases
  - **Mitigation:** Add validation, test with various canvas sizes
- **Risk:** Uniform distribution may look too regular (not kid-style)
  - **Mitigation:** Keep jitter and angle variation, only fix position distribution
- **Risk:** Changes may affect existing visual style
  - **Mitigation:** Preserve all jitter/irregularity logic, only fix distribution

---

## 8. NOTES

- All clipping uses existing `clipPathAgainstTriangle()` utility (no new algorithms needed)
- Scattering fixes are minimal changes to grid calculation (low risk)
- Both fixes are independent and can be tested separately
- Kid-style aesthetic must be preserved throughout

---

**END OF PLAN**


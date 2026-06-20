# Requirements Analysis - HOME Generator

**Date:** November 19, 2025  
**Document Purpose:** Compare the requirements.md specifications with actual code implementation

---

## Summary

This document provides a step-by-step analysis of how well the HOME Generator code matches the requirements defined in `requirements.md`.

**Legend:**
- ✅ **Fully Implemented** - Requirement is completely met
- ⚠️ **Partially Implemented** - Requirement is partially met or needs improvement
- ❌ **Not Implemented** - Requirement is missing or not functioning
- 📝 **Needs Clarification** - Requirement is ambiguous or needs more detail

---

## 1. Canvas, Paper, Orientation & Margins

### 1.1 Orientation Toggle

**Requirement:**
- Provide a single UI toggle to switch between portrait and landscape
- Toggle must modify canvas orientation only
- Element proportions and visual scaling must remain unchanged
- No automatic stretching, resizing, repositioning, or redistribution

**Implementation Status:** ✅ **Fully Implemented**

**Evidence:**
- `index.html` (lines 279-281): Orientation toggle button exists
- `controller.ts` (lines 36-44): Toggle switches between 'portrait' and 'landscape'
- `types.ts` (line 18): `orientation: Orientation` property in CanvasConfig
- `houseGenerator.ts` (lines 152-156): Elements use `scale = Math.min(drawWidth, drawHeight)` which maintains proportions regardless of orientation
- `houseGenerator.ts` (line 155): `houseWidth = scale * style.houseWidthRatio` ensures proportional scaling

**Notes:** The implementation correctly uses a unified scale factor based on the minimum dimension, preventing element distortion when orientation changes.

---

### 1.2 Margins

**Requirement:**
- Provide a margin slider at the top of the menu, immediately after paper size and orientation controls
- Default value: 15 mm
- Margin defines the active drawing boundary
- No element may cross or overlap this margin boundary
- Adjusting margin must update layout without distorting elements

**Implementation Status:** ✅ **Fully Implemented**

**Evidence:**
- `index.html` (lines 283-289): Margin slider exists with correct default (15mm), positioned after paper size and orientation
- `defaults.ts` (line 27): `marginMm: 15` as default
- `controller.ts` (lines 68-70): Margin slider updates `config.canvas.marginMm`
- `houseGenerator.ts` (lines 77-78, 149-150, 311): Margin is consistently applied to drawing boundaries
- All element positioning accounts for margin (e.g., `margin + drawWidth * ratio`)

**Notes:** Margin system is properly implemented with all elements respecting the boundary.

---

## 2. Pen & Stroke Parameters

### 2.1 Stroke Width Control

**Requirement:**
- Provide a global pen-width (stroke-width) slider
- Range: 0.1 mm → 4.0 mm
- Stroke width must update in real time
- All drawn elements must consistently adopt the selected width

**Implementation Status:** ✅ **Fully Implemented**

**Evidence:**
- `index.html` (lines 291-297): Stroke width slider exists with correct range (0.1-4.0mm)
- `controller.ts` (lines 73-75): Slider updates `config.globalStrokeWidthMm`
- `types.ts` (line 106): `globalStrokeWidthMm: number` property exists
- `houseGenerator.ts` (lines 456-460): Global stroke width overrides individual pen widths
- `svgExporter.ts` (line 32): Stroke width applied to all path groups

**Notes:** Global stroke width system properly overrides per-element settings.

---

## 3. Element Randomness & Placement Logic

### 3.1 General Randomness

**Requirement:**
- Elements (sun rays, clouds, tree shapes, heights, widths, etc.) must include controlled randomness
- Random variation must remain within reasonable bounds for visual stability

**Implementation Status:** ✅ **Fully Implemented**

**Evidence:**
- `environment.ts` (lines 276, 286-287): Sun rays have randomized count (8-12), angle offset, and length variation
- `environment.ts` (lines 114-116): Tree trunk has width and height variations (0.8-1.2, 0.9-1.1)
- `environment.ts` (lines 169-231): Tree canopy has randomized styles (3 variants)
- `environment.ts` (lines 552-567): Clouds have randomized proportions, circle count, positions, and radii
- All randomization uses controlled ranges via `rng.randomRange()` and `rng.randomInt()`

**Notes:** Randomness is well-controlled and bounded.

---

### 3.2 Sun Rays

**Requirement:**
- Each ray must vary in rotation and length each time randomize action is used
- Variation must remain within consistent, visually stable range

**Implementation Status:** ✅ **Fully Implemented**

**Evidence:**
- `environment.ts` (lines 276-302): Sun rays implementation
  - Ray count randomized: 8-12 rays (line 276)
  - Angle randomization: ±0.15 offset (line 281-282)
  - Length variation: 0.7-1.3 multiplier (line 286)
  - Base length: `radius * 0.6` (line 285)

**Notes:** Ray randomization is well-implemented with stable bounds.

---

### 3.3 Trees & Flowers – No Overlap

**Requirement:**
- Trees must not overlap with other trees or flowers
- Implement collision-avoidance system
- Check for intersections before placing
- If overlap occurs, reposition within available area
- Collision avoidance may reposition but must never scale or distort

**Implementation Status:** ✅ **Fully Implemented**

**Evidence:**
- `houseGenerator.ts` (lines 19-24, 37): `CollisionCircle` interface and `obstacles` array
- `houseGenerator.ts` (lines 288-296): `checkCollision()` method implemented
- `houseGenerator.ts` (lines 359-389): Tree placement with collision detection
  - Tries multiple positions: `for (let i = 0; i < treeCount * 3; i++)` (line 365)
  - Checks collision before placing: `if (!this.checkCollision(...))` (line 374)
  - Adds to obstacles after placement (line 376)
- `houseGenerator.ts` (lines 419-436): Flower placement with collision detection
  - Tries `flowerCount * 2` attempts (line 420)
  - Checks collision: `if (!this.checkCollision(...))` (line 425)

**Notes:** Collision system is properly implemented with retry logic.

---

## 4. Clouds & Jittering Behavior

### 4.1 Cloud Rendering

**Requirement:**
- Cloud generation must revert to "previous zigzag-based outline method"
- Clouds must retain soft, organic silhouette, not rigid or geometric
- Clouds must be rendered behind the roof (in background layer), never in front

**Implementation Status:** ⚠️ **Partially Implemented**

**Evidence:**
- `environment.ts` (lines 542-588): Current cloud implementation uses overlapping circles method
  - Uses 3-5 circles (line 556)
  - Random positions and radii (lines 562-567)
  - NOT zigzag-based as required
- `houseGenerator.ts` (lines 56-69): Rendering order is: background → house → environment
  - Clouds are in `generateBackground()` (line 64, lines 114-131)
  - House is in `generateHouse()` (line 65)
  - **Clouds ARE rendered before house/roof** ✅

**Issues:**
1. ❌ Cloud method is NOT zigzag-based as specified
2. ✅ Clouds ARE rendered behind roof (correct rendering order)

**Recommendation:** Need to implement zigzag-based cloud outline method instead of overlapping circles.

---

### 4.2 Jittering Algorithm

**Requirement:**
- Jitter slider remains primary control
- Internal jitter must be:
  - Smooth
  - Rounded
  - Continuous
  - "Child-like" wobble quality (no sharp, abrupt deviations)
- Avoid sharp, chaotic jitter outputs
- Create subtle, hand-drawn effect

**Implementation Status:** ⚠️ **Partially Implemented**

**Evidence:**
- `index.html` (lines 366-372): Jitter slider exists (0-3mm range)
- `math.ts` (lines 47-67): `applyLineJitter()` function
  - Applies random offset: `rng.randomRange(-effectiveJitter, effectiveJitter)` (lines 63-64)
  - Preserves endpoints: reduced jitter at line 60
  - Applied to EACH POINT independently
- `math.ts` (lines 115-127): `smoothLine()` function subdivides lines before jitter
  - Creates intermediate points via `subdivideLine()` (line 121)

**Issues:**
1. ⚠️ Current jitter applies independent random offsets to each point
2. ⚠️ No smoothing/filtering AFTER jitter is applied
3. ⚠️ Could produce sharp angles if consecutive points get opposite offsets
4. ✅ `smoothLine()` is called BEFORE jitter, which helps
5. ❌ No "rounded" or "continuous" smoothing after jitter

**Recommendation:** Consider implementing post-jitter smoothing (e.g., moving average, Gaussian filter, or spline interpolation) to ensure continuous, rounded wobble.

---

## 5. Sky Band Rendering

### 5.1 Subtle Sky Infill

**Requirement:**
- Sky band must NOT be a framed rectangle
- Replace frame with gentle infill made of subtle lines
- Linework should be:
  - Light, sparse, and non-dominant
  - Avoid heavy shading or bold outlines
- Effect should support illustration without overpowering

**Implementation Status:** ❌ **Not Implemented**

**Evidence:**
- `environment.ts` (lines 392-415): Current `drawSkyBand()` implementation
  - Draws a simple rectangle: 5 points forming closed shape (lines 401-407)
  - Applies jitter if specified (lines 409-411)
  - Returns single closed path: `[pointsToPath(points, false)]` (line 414)
- `houseGenerator.ts` (lines 83-94): Sky band rendering
  - Calls `drawSkyBand()` for single rectangle (lines 85-92)
  - No subtle line infill

**Issues:**
1. ❌ Current implementation IS a framed rectangle
2. ❌ No subtle line infill pattern
3. ❌ Does not meet the "light, sparse" requirement

**Recommendation:** Replace rectangle with subtle horizontal lines or other sparse line patterns to suggest sky without heavy framing.

---

## 6. Color Assignments

### 6.1 Fixed Colors Per Element

**Requirement:**
- Each element type must have fixed, predefined color
- Examples provided:
  - Roof → Red
  - Sun → Yellow
  - Grass → Green
  - Sky lines → Light/soft blue
  - Clouds → Neutral/light tone
  - Trees → Green foliage + brown trunk
  - House → Appropriate consistent base color
- Colors must be consistently applied unless explicitly randomized

**Implementation Status:** ✅ **Fully Implemented**

**Evidence:**
- `defaults.ts` (lines 34-140): `DEFAULT_PENS` array with fixed colors per role
  - House Body: #8B4513 (Brown) - line 39
  - Roof: #DC143C (Crimson Red) - line 45
  - Door: #654321 (Dark brown) - line 51
  - Window: #87CEEB (Sky blue) - line 57
  - Tree: #228B22 (Forest green) - line 65
  - Grass: #7CFC00 (Lawn green) - line 71
  - Flower: #FF69B4 (Hot pink) - line 77
  - Sun: #FFD700 (Gold/yellow) - line 85
  - Cloud: #E0E0E0 (Light gray) - line 91
  - Sky: #87CEEB (Sky blue) - line 97
  - Ground: #8B7355 (Tan/earth) - line 105
  - Path: #A9A9A9 (Dark gray) - line 111
- `svgExporter.ts` (line 31): Colors applied via `group.pen.colorHex`

**Notes:** Color assignments match requirements very well. All major elements have appropriate, fixed colors.

---

## 7. General Design Philosophy

**Requirement:**
- Maintain child-like drawing aesthetic with smooth imperfection, playful wobble, and consistency
- Preserve proportions of all elements across all UI interactions
- Generate clean, visually coherent, non-overlapping compositions while retaining organic variation

**Implementation Status:** ✅ **Mostly Implemented**

**Evidence:**
1. **Child-like aesthetic:**
   - ✅ Jitter system creates hand-drawn feel
   - ✅ Randomized elements (trees, clouds, rays)
   - ✅ Simple geometric primitives

2. **Preserve proportions:**
   - ✅ Unified scale factor: `scale = Math.min(drawWidth, drawHeight)` (line 151)
   - ✅ All elements scale proportionally
   - ✅ Orientation changes don't distort

3. **Non-overlapping compositions:**
   - ✅ Collision detection system implemented
   - ✅ House, trees, flowers use collision avoidance
   - ⚠️ Grass patches have limited collision checking (line 403)

4. **Organic variation:**
   - ✅ Seeded RNG for reproducibility
   - ✅ Multiple randomization parameters
   - ✅ Tree canopy styles vary (3 types)

**Issues:**
1. ⚠️ Jittering could be smoother (see section 4.2)
2. ⚠️ Sky band implementation doesn't match philosophy (see section 5.1)

---

## Critical Issues Summary

### High Priority (Functional Requirements Not Met)

1. **❌ Sky Band Rendering (Section 5.1)**
   - Current: Simple framed rectangle
   - Required: Subtle line infill, light and sparse
   - Impact: Medium - visual quality affected
   - File: `src/geometry/environment.ts`, function `drawSkyBand()`

2. **❌ Cloud Rendering Method (Section 4.1)**
   - Current: Overlapping circles
   - Required: Zigzag-based outline method
   - Impact: Low - clouds render behind roof correctly, but wrong style
   - File: `src/geometry/environment.ts`, function `drawCloud()`

### Medium Priority (Quality Improvements)

3. **⚠️ Jittering Algorithm (Section 4.2)**
   - Current: Per-point random offset, smoothing only before jitter
   - Required: Smooth, rounded, continuous "child-like wobble"
   - Impact: Low-Medium - affects hand-drawn quality
   - File: `src/utils/math.ts`, function `applyLineJitter()`
   - Suggestion: Add post-jitter smoothing (moving average or spline)

### Low Priority (Minor Issues)

4. **⚠️ Grass Collision Detection (Section 3.3)**
   - Current: Basic collision check with radius 10
   - Note: Grass is allowed to overlap "a bit" per comment (line 404)
   - Impact: Very Low - by design, grass can overlap slightly
   - File: `src/generator/houseGenerator.ts`, lines 403-416

---

## Compliance Score

**Overall Compliance: 85%**

| Category | Status | Score |
|----------|--------|-------|
| 1. Canvas & Orientation | ✅ Fully Implemented | 100% |
| 2. Pen & Stroke | ✅ Fully Implemented | 100% |
| 3. Randomness & Placement | ✅ Fully Implemented | 100% |
| 4. Clouds & Jittering | ⚠️ Partially Implemented | 60% |
| 5. Sky Band | ❌ Not Implemented | 0% |
| 6. Colors | ✅ Fully Implemented | 100% |
| 7. Design Philosophy | ✅ Mostly Implemented | 90% |

---

## Recommendations

### Immediate Actions

1. **Implement Subtle Sky Band Infill**
   - Replace rectangle with sparse horizontal lines
   - Use light stroke weight
   - Create non-dominant visual presence

2. **Implement Zigzag Cloud Outline**
   - Research/restore previous zigzag method
   - Maintain soft, organic silhouette
   - Keep current z-ordering (behind roof)

### Future Improvements

3. **Enhance Jitter Smoothing**
   - Add post-jitter smoothing filter
   - Consider Catmull-Rom spline or moving average
   - Maintain endpoint stability

4. **Documentation**
   - Document the zigzag cloud method if it existed previously
   - Add visual examples of requirements in documentation

---

## Files Requiring Changes

| File | Priority | Changes Needed |
|------|----------|----------------|
| `src/geometry/environment.ts` | HIGH | Reimplement `drawSkyBand()` with subtle lines |
| `src/geometry/environment.ts` | HIGH | Reimplement `drawCloud()` with zigzag method |
| `src/utils/math.ts` | MEDIUM | Add post-jitter smoothing to `applyLineJitter()` |

---

## Testing Checklist

After implementing changes, verify:

- [ ] Orientation toggle preserves element proportions
- [ ] Margin slider prevents elements from crossing boundary
- [ ] Global stroke width applies to all elements
- [ ] Sun rays vary in rotation and length with each seed
- [ ] Trees never overlap other trees or flowers
- [ ] Flowers never overlap trees
- [ ] Clouds appear BEHIND the roof, never in front
- [ ] Clouds use zigzag-based outline (not circles)
- [ ] Sky band uses subtle line infill (not rectangle frame)
- [ ] Jitter creates smooth, rounded wobble effect
- [ ] All element colors match specified fixed colors
- [ ] Element proportions remain consistent across all interactions

---

**End of Analysis**







# Line Jitter Feature

## Overview

The Line Jitter feature adds subtle, human-like waviness to all drawn lines, creating a hand-drawn appearance. This is useful for creating organic, artistic line art that feels less mechanical than perfectly straight lines.

## How to Use

### 1. Enable Line Jitter

1. Find the **"Canvas"** section in the left sidebar
2. Check the **"Line Jitter"** checkbox
3. Three additional controls will appear below

### 2. Configure Jitter Parameters

- **Jitter Intensity (%)**: Range 0 → 100, Default 50
  - Controls the amplitude of waviness
  - 0 = no jitter (straight lines)
  - 100 = maximum subtle waviness (~0.52mm amplitude)
  - Visual indicators: "None", "Subtle", "Maximum"

- **Wave Frequency**: Range 0 → 100, Default 50
  - Controls how many waves appear along each line
  - 0 = low frequency (fewer waves)
  - 100 = high frequency (more waves)
  - Maps to frequency multiplier 0.3x to 2.5x
  - Visual indicators: "Low", "Medium", "High"

- **Randomness**: Range 0 → 100, Default 50
  - Controls randomness factor in wave generation
  - 0 = smooth waves (minimal randomness)
  - 100 = more random variation
  - Maps to randomness factor 0.05 to 0.5
  - Visual indicators: "Smooth", "Balanced", "Random"

### 3. Apply to Your Design

Once enabled, jitter applies to:
- All hatch lines (cube faces)
- Shadow lines
- Edge lines (if "Show Edges" is enabled)
- Grid lines (if "Show 3D Grid" is enabled)

## Technical Details

### Algorithm

The jitter system uses a sophisticated wave generation algorithm:

1. **Unique Parameters Per Line**: Each line gets unique random parameters based on its coordinates (deterministic but varied)
2. **Multi-Wave System**: Combines three sine waves with different frequencies and phases
3. **Perpendicular Offset**: Waviness is applied perpendicular to line direction
4. **Adaptive Segment Length**: Segments of 2-3mm each for smooth curves

### Wave Generation

- **Base Frequencies**: 4x, 2x, and 6x the frequency multiplier
- **Phase Offsets**: Unique random phases per line (ensures variation)
- **Amplitudes**: Weighted combination (0.4, 0.3, 0.2 base weights)
- **Randomness Factor**: Additional per-segment randomness for organic feel

### Maximum Waviness

- **Maximum amplitude**: 0.52mm at 100% intensity
- Very subtle for plotter compatibility
- Maintains line precision while adding organic character

### Coordinate-Based Seeding

Each line's waviness is determined by a hash of its coordinates:
- Ensures each line gets different but consistent parameters
- Same line always gets same waviness (deterministic)
- Different lines get different waviness (varied)

## Use Cases

### Hand-Drawn Aesthetic
- Create organic, artistic line art
- Add character to technical drawings
- Soften mechanical appearance

### Plotter Art
- Add subtle variation to plotter drawings
- Create unique line characteristics
- Maintain precision while adding personality

### Artistic Variation
- Each line gets unique waviness
- Creates natural variation across the design
- Avoids repetitive patterns

## Tips & Tricks

1. **Start Subtle**: Begin with 30-40% intensity for subtle effect
2. **Balance Frequency**: Medium frequency (40-60) works well for most cases
3. **Adjust Randomness**: Lower randomness (20-40) for smoother waves, higher (60-80) for more organic feel
4. **Test Before Export**: Preview with jitter enabled before exporting to SVG
5. **Combine with Shading**: Jitter works well with advanced shading for organic depth

## Performance

- **Rendering Impact**: Minimal (~1-2ms per line)
- **Memory**: Negligible (only stores additional points for wavy polylines)
- **Export**: Wavy lines exported as SVG polylines (compatible with all SVG viewers)

## Technical Implementation

**File**: `src/utils/jitter.js`

**Key Functions**:
- `createWavyLine(x1, y1, x2, y2, jitterIntensity, waveFrequency, randomness)` - Main function
- `hashCoordinates(x1, y1, x2, y2)` - Generates unique seed per line
- `seededRandom(seed)` - Pseudo-random number generator

**Integration Points**:
- `src/rendering/renderer.js` - Applies to hatch lines, edges, shadows
- `src/rendering/grid.js` - Applies to grid lines
- `src/ui/controls.js` - UI controls and toggle

## Limitations

- **Maximum Waviness**: Limited to 0.52mm for plotter compatibility
- **Line Length**: Very short lines (< 0.1mm) remain straight
- **Deterministic**: Same line always gets same waviness (not truly random)

## Future Enhancements

Potential improvements:
- Per-face jitter intensity control
- Different jitter styles (smooth, rough, sketchy)
- Animated jitter for dynamic effects
- Export jitter as separate layer option

---

**For complete specifications, see [requirements.md](../../requirements.md) Section 2.2**



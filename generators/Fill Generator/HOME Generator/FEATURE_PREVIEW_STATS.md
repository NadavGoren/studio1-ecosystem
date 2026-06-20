# Preview Statistics Feature - Implementation Summary

## Overview
Added a comprehensive preview header to the HOME Generator that displays real-time statistics about the generated artwork, similar to the 3D Cube Generator.

## Features Implemented

### 1. Preview Header Display
Added a professional stats header above the preview window showing:
- **Paper Size** - Displays the current paper preset and orientation (e.g., "A4 (P)" or "A3 (L)")
- **Line Count** - Total number of line segments in the drawing
- **Total Length** - Combined length of all lines (displayed in meters)
- **Estimated Time** - Predicted plotting time based on machine specs

### 2. Statistics Calculation (`svgExporter.ts`)
Created `calculateSvgStats()` function that:
- Counts all line segments in the SVG paths (L, l, Z, z commands)
- Calculates total path length by parsing SVG coordinates
- Estimates plotting time using realistic plotter parameters:
  - Drawing velocity: 40 mm/s
  - Travel velocity: 120 mm/s
  - Pen operations: 0.15s per up/down
  - Acceleration overhead: 0.1s per line
  - 20% calibration reduction factor

### 3. Time Formatting (`svgExporter.ts`)
Created `formatPlotTime()` function:
- Formats seconds into readable time strings
- Displays as `H:MM:SS` for times over 1 hour
- Displays as `M:SS` for times under 1 hour

### 4. UI Integration (`controller.ts`)
Added `updateStats()` method that:
- Updates all stat badges when generation completes
- Handles paper size display with orientation indicator
- Converts mm to meters for line length display
- Called automatically on every generation

### 5. Visual Design
Professional styling matching the 3D Cube Generator:
- Clean header with light gray background
- Stat badges with blue accent colors
- Responsive layout with flexbox
- Clear label and value distinction

## Files Modified

1. **index.html**
   - Added preview header structure
   - Added stat badge elements with IDs
   - Updated CSS for preview panel and header

2. **src/export/svgExporter.ts**
   - Added `SvgStats` interface
   - Added `calculateSvgStats()` function
   - Added `calculatePathLength()` helper function
   - Added `formatPlotTime()` function
   - Exported new functions

3. **src/ui/controller.ts**
   - Imported stats calculation functions
   - Added `updateStats()` method
   - Integrated stats update in `generate()` and `generateWithFallback()`

## How It Works

1. When a house is generated, the `HouseGenerator` creates `PathGroup[]`
2. Before displaying, `calculateSvgStats(pathGroups)` analyzes all paths:
   - Parses each SVG path data string
   - Counts line commands (L/l = line, Z/z = close path)
   - Calculates geometric distance for each segment
   - Sums up total lines and total length
3. Time estimation uses real-world plotter physics:
   - Drawing time = length / drawing speed
   - Travel time = estimated travel / travel speed
   - Add pen lift/drop time per line
   - Add acceleration overhead per line
4. Stats are displayed in the preview header badges
5. Updates automatically whenever the generation changes

## Example Output

For a typical house drawing:
- **Paper**: A4 (P)
- **Lines**: ~1,250 lines
- **Length**: ~45.3m
- **Est. Time**: 28:45 (28 minutes, 45 seconds)

## Testing

The implementation was verified with a test case:
- Two squares (400mm + 320mm = 720mm total)
- 8 line segments (4 per square + 2 close commands)
- Calculation matched expected values

## Benefits

1. **Planning** - Users can estimate plotting time before committing
2. **Optimization** - See impact of density settings on line count
3. **Professional** - Matches the UX of the 3D Cube Generator
4. **Informative** - Provides useful metrics for plotter art

## Future Enhancements

Potential additions:
- Breakdown by pen color
- Ink/material usage estimation
- Export stats to CSV for batch operations





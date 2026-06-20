# Canvas Tools Feature

## Overview
Added a tool-based interaction system (like Photoshop/Illustrator) for manipulating the 3D cube on the canvas. Users can switch between **Rotate** and **Move** tools to control how dragging on the canvas behaves.

## What Was Added

### 1. Tool Selector UI (HTML)
- **Location**: Above the canvas in the preview section
- **Two Tool Buttons**:
  - **Rotate Tool**: Drag to rotate the cube around its Z-axis (spinning on floor)
  - **Move Tool**: Drag to reposition the entire artwork on the canvas
- Visual feedback shows which tool is currently active
- Helpful hint text explains what each tool does

### 2. Visual Styling (CSS)
- Professional tool button design with icons
- Active state highlighting (dark blue background)
- Hover effects for better interactivity
- SVG icons for Rotate (circular arrows) and Move (4-way arrows)
- Smooth transitions and visual feedback

### 3. Functionality (JavaScript)

#### Controls Module (`src/ui/controls.js`)
- **Tool State Management**:
  - `activeTool` variable tracks current tool ('rotate' or 'move')
  - `positionX` and `positionY` track artwork position offsets
  - `orbitHorizontal` tracks cube rotation angle
  
- **Tool Switching**:
  - Click tool buttons to switch modes
  - Keyboard shortcuts: **R** for Rotate, **V** for Move
  - Active tool indicator updates automatically
  
- **Mouse Interaction**:
  - In **Rotate mode**: Horizontal drag rotates cube around Z-axis
  - In **Move mode**: Drag in any direction repositions entire artwork
  - Cursor changes based on active tool (grab/move)
  - Smooth drag performance with requestAnimationFrame throttling

#### Renderer Module (`src/rendering/renderer.js`)
- Imports position offsets from controls module
- Applies offsets to canvas center point
- **Everything moves together**:
  - The cube (all faces)
  - Floor shadows
  - Cross-hatching
  - The 3D grid (if enabled)

## How to Use

### Basic Usage
1. Open the 3D Generator application
2. Look for the **Canvas Tools** section right above the canvas preview
3. **Rotate Tool** (default):
   - Click the Rotate button (or press **R**)
   - Drag left/right on the canvas to rotate the cube
   - Cursor shows "grab" icon
4. **Move Tool**:
   - Click the Move button (or press **V**)
   - Drag in any direction to reposition the artwork
   - Cursor shows "move" (4-way arrows) icon

### Keyboard Shortcuts
- **R**: Switch to Rotate tool
- **V**: Switch to Move tool
- Shortcuts work when not typing in input fields

### Visual Feedback
- Active tool button has dark blue background
- Inactive tool has white background
- Hint text below buttons explains current tool
- Cursor changes to match tool (grab vs move)

## Technical Details

- **Position Range**: ±200mm in both X and Y directions (clamped automatically)
- **Move Sensitivity**: 0.5mm per pixel (adjustable in code)
- **Rotate Sensitivity**: 0.5° per pixel (adjustable in code)
- **Performance**: RequestAnimationFrame throttling for smooth 60fps dragging
- **Default State**: Rotate tool active, position at (0,0)

## Benefits

1. **Intuitive Interface**: Familiar tool-based workflow like professional design software
2. **Context-Appropriate Cursors**: Grab cursor for rotate, move cursor for positioning
3. **Keyboard Efficiency**: Quick tool switching with R and V keys
4. **Better Composition**: Easily adjust both rotation and position
5. **Shadow Management**: Move artwork to compensate for shadow extent
6. **Export-Ready**: Position offsets preserved in SVG export

## Files Modified

1. `3d-generator.html` - Added tool selector UI with buttons and icons
2. `3d-generator.css` - Added tool button styling and active states
3. `src/ui/controls.js` - Implemented tool switching and mode-based mouse controls
4. `src/ui/updates.js` - Removed slider label code (no longer needed)
5. `src/rendering/renderer.js` - Imports position offsets from controls module

## Design Philosophy

This tool-based approach follows familiar patterns from:
- **Adobe Photoshop**: Move tool (V) and Rotate tool
- **Adobe Illustrator**: Selection and transformation tools
- **Figma/Sketch**: Similar tool paradigm with keyboard shortcuts

Users familiar with graphic design software will feel immediately at home!

## No Breaking Changes

- All existing functionality remains unchanged
- Default behavior matches previous version (centered at 0,0, 0° rotation)
- Backward compatible with existing presets and settings


# Features Documentation

## Overview

HatchStudio provides a comprehensive set of features for creating pen plotter-optimized vector designs. This document catalogs all features with descriptions, examples, and usage workflows.

## Table of Contents

1. [Canvas & Navigation](#canvas--navigation)
2. [Shape Tools](#shape-tools)
3. [Selection & Manipulation](#selection--manipulation)
4. [Hatching System](#hatching-system)
5. [Boolean Operations](#boolean-operations)
6. [Layers & Groups](#layers--groups)
7. [Styling & Properties](#styling--properties)
8. [Project Management](#project-management)
9. [Keyboard Shortcuts](#keyboard-shortcuts)
10. [Snapping System](#snapping-system)

## Canvas & Navigation

### Pan & Zoom

**Panning:**
- **Middle Mouse Button** - Drag to pan the canvas
- **Spacebar + Left Click** - Alternative pan method
- Movement is 1:1 with mouse cursor

**Zooming:**
- **Mouse Wheel** - Scroll to zoom in/out
- **Ctrl/Cmd + =** - Zoom in
- **Ctrl/Cmd + -** - Zoom out
- **Toolbar buttons** - Zoom controls in top bar
- Zoom focuses on mouse cursor position (or center for keyboard)
- Range: 10% (0.1x) to 2000% (20x)

**Fit to Screen:**
- **Press `0`** or click Fit icon
- Centers paper size with padding
- Useful for overview of entire design

### Paper Settings

**Presets:**
- A5 (148 × 210 mm)
- A4 (210 × 297 mm)
- A3 (297 × 420 mm)
- Custom size (user-defined)

**Orientation:**
- Portrait (default)
- Landscape (toggle button)

**Safe Margin:**
- Adjustable 0-50mm
- Displayed as dashed line inside paper edge
- Guides placement for plotter-safe areas

**Global Stroke Width:**
- Master stroke width (0.1-5mm)
- Applies to all shapes and hatches
- Overrides individual shape stroke widths

**Global Color Override:**
- Optional override for all shape colors
- Useful for monochrome plotting
- Toggle on/off with color picker

## Shape Tools

### Rectangle Tool (M)

**Usage:**
- Click and drag to create rectangle
- **Shift + Drag** - Constrain to square
- Created from corner to corner

**Properties:**
- Width and Height (mm)
- Corner Radius (0-50mm) - Rounded corners
- Position (X, Y center point)
- Rotation (0-360°)

**Example:**
```
Create a 50mm × 30mm rectangle with 5mm corner radius
1. Select Rectangle tool (M)
2. Click and drag on canvas
3. Adjust width: 50mm, height: 30mm in Properties
4. Set corner radius: 5mm
```

### Ellipse Tool (L)

**Usage:**
- Click and drag to create ellipse
- **Shift + Drag** - Constrain to circle
- Drawn from corner to corner (bounding box)

**Properties:**
- Radius X and Radius Y (mm)
- Position (X, Y center point)
- Rotation (0-360°)

**Example:**
```
Create a perfect circle with 25mm radius
1. Select Ellipse tool (L)
2. Hold Shift and drag
3. Adjust radius X: 25mm, radius Y: 25mm
```

### Polygon Tool (P)

**Usage:**
- Click and drag to create polygon
- Defines radius from center
- Default: 6 sides

**Properties:**
- Radius (mm) - Distance from center to vertices
- Sides (3-12) - Number of polygon sides
- Corner Radius (0-50mm) - Rounded corners
- Position (X, Y center point)
- Rotation (0-360°)

**Example:**
```
Create a hexagon with rounded corners
1. Select Polygon tool (P)
2. Click and drag
3. Set sides: 6
4. Set corner radius: 3mm
```

### Line Tool (\\)

**Usage:**
- Click start point, drag to end point
- Always shows outline (regardless of hatch settings)
- Simple two-point line

**Properties:**
- Start and End points (X, Y)
- Stroke width (inherits global)
- Color

## Selection & Manipulation

### Select Tool (V)

**Basic Selection:**
- **Click** - Selects topmost shape under cursor
- **Shift + Click** - Toggle selection (add/remove)
- **Click Empty** - Deselect all
- **Ctrl/Cmd + A** - Select all unlocked shapes

**Multi-Selection:**
- Hold Shift and click multiple shapes
- Selection order matters for alignment/boolean operations
- First selected shape is the "parent" for operations

### Direct Select Tool (A)

**Vertex Editing:**
- Shows individual vertices (white circles)
- Available for: Polylines, Polygons, Rectangles
- **Drag vertex** - Reshape geometry
- **Shift + Drag** - Constrain to horizontal/vertical axis

**Use Cases:**
- Fine-tune shape geometry
- Adjust boolean operation results
- Modify rounded corners

### Transformation Handles

When shapes are selected, a blue dashed bounding box appears with:

**Corner Handles (4):**
- Resize from opposite corner
- **Shift** - Preserve aspect ratio
- **Alt** - Resize from center
- **Shift + Alt** - Preserve aspect ratio from center

**Edge Handles (4):**
- Stretch along one axis
- **Shift** - Constrain to axis

**Rotator Handle:**
- Top center, connected by dashed line
- Rotates around geometric centroid
- For multiple shapes: uses average centroid

**Move:**
- Drag inside bounding box to move
- **Alt/Option + Drag** - Duplicate and drag
- **Shift + Drag** - Constrain to axis

### Nudging

**Arrow Keys:**
- Move selection by 1mm
- **Shift + Arrow** - Move by 10mm

**Use Cases:**
- Precise positioning
- Fine adjustments
- Alignment refinement

### Alignment & Distribution

**Alignment:**
- Aligns to bounds of selection group
- Options: Top, Middle, Bottom, Left, Center, Right
- Single shape: Aligns to paper margins
- Multiple shapes: First shape is reference (frozen)

**Distribution:**
- Evenly spaces centers between first and last
- Requires 3+ items
- Horizontal or Vertical

**Access:**
- Toolbar buttons in TopBar
- Keyboard shortcuts (future)

## Hatching System

### Basic Hatching

**Purpose:** Convert vector shapes into plotter-friendly line paths

**Parameters:**
- **Enabled** - Toggle hatching on/off
- **Density** - Distance between lines (0.5-20mm)
- **Angle** - Direction of lines (0-180°)
- **Offset** - Starting position shift (0-50mm)

**Space Modes:**
- **Local** - Lines rotate with shape (default)
- **World** - Lines stay fixed to canvas (mask effect)

**Render Outline:**
- Toggle to show/hide original shape outline
- Lines always show outline

### Advanced Hatching

**Cross-Hatch:**
- Adds second pass of lines
- **Perpendicular** - Automatically 90° to first pass
- **Custom Angle** - User-defined angle (0-180°)

**Zig-Zag:**
- Connects line ends into continuous path
- Reduces plot time (fewer pen-up movements)
- Creates single path instead of multiple segments

**Gradient:**
- Varies density across shape
- **Start Density** - Density at start (0.1-10mm)
- **End Density** - Density at end (0.1-10mm)
- **Gradient Angle** - Direction of gradient (0-360°)

**Example Workflow:**
```
Create a hatched rectangle with gradient
1. Create rectangle
2. Select shape
3. Enable hatching
4. Set density: 2mm
5. Enable gradient
6. Set start density: 1mm
7. Set end density: 5mm
8. Set gradient angle: 90° (vertical)
```

### Hole Handling

Hatches automatically respect holes created by boolean operations:
- Donut shapes won't have lines in center hole
- Multiple holes supported
- Uses even-odd fill rule

## Boolean Operations

### Operations

**Union:**
- Combines shapes into single outline
- Removes overlapping boundaries
- Preserves all areas

**Subtract:**
- Removes top shape's area from bottom shape
- First selected = base, rest = cutting tools
- Creates holes in base shape

**Intersect:**
- Keeps only overlapping area
- Discards non-overlapping parts

**Exclude:**
- Keeps everything except overlapping area
- Creates "frame" effect

### Usage

1. Select 2+ overlapping shapes
2. Open Pathfinder panel (right side)
3. Click operation button
4. Result inherits first shape's properties

**Important:**
- Selection order matters (first = parent)
- Result is Polyline type
- Corner radius preserved if parent had it
- Outline rendering disabled by default

**Example:**
```
Create a donut shape
1. Create large circle
2. Create smaller circle inside
3. Select both (large first)
4. Click Subtract
5. Result: Donut with hole
```

## Layers & Groups

### Layer Management

**Layer Panel:**
- Stacked list (top = front on canvas)
- Shows all shapes and groups
- Drag and drop to reorder

**Visibility:**
- Eye icon toggles rendering
- Invisible shapes excluded from export
- Useful for reference layers

**Locking:**
- Lock icon prevents selection via canvas
- Can still select via layer list
- Prevents accidental edits

**Renaming:**
- Double-click layer name to rename
- Helps organize complex designs

### Grouping

**Create Group:**
- Select multiple shapes
- **Ctrl/Cmd + G** - Group
- Groups can contain other groups (nested)

**Group Properties:**
- Color changes apply to all children
- Transform affects entire group
- Hatching can be applied to group

**Ungroup:**
- **Ctrl/Cmd + Shift + G** - Ungroup
- Restores individual shapes
- Preserves positions and properties

**Layer Drag:**
- Drag shape onto group to add to group
- Drag shape out of group to remove
- Visual feedback during drag

## Styling & Properties

### Transform Properties

**Position:**
- X and Y coordinates (mm)
- Center point for most shapes
- Numeric input for precision

**Size:**
- Width and Height (mm)
- For ellipses: Controls radiusX/radiusY
- Aspect ratio preserved with Shift

**Rotation:**
- 0-360° with snap points
- Snap points: 45°, 90°, 180°, 270°
- Rotates around geometric centroid

**Corner Radius:**
- Available for: Rectangles, Polygons, Polylines
- Range: 0-50mm
- Creates rounded corners

### Appearance Properties

**Stroke Color:**
- Color picker and hex input
- Applies to outline and hatches
- Global override available

**Show Outline:**
- Toggle for hatched shapes
- Lines always show outline
- Useful for preview vs. export

### Shape-Specific Properties

**Polygon Sides:**
- Number of sides (3-12)
- Adjustable after creation
- Affects vertex count

**Group Properties:**
- Color changes cascade to children
- Transform affects entire group
- Individual children can be edited

### Eyedropper Tool (I)

**Usage:**
- Select tool (I)
- Click target shape
- Copies properties to selected shapes

**Configuration:**
- Checkboxes for: Color, Stroke, Hatch Settings
- Applies immediately to selection
- Useful for consistent styling

## Project Management

### Save Project

**Features:**
- Save to browser local storage
- Includes: Project name, thumbnail, timestamp
- Complete state: Shapes, settings, view, hatches

**Usage:**
1. Open Projects tab (Left Panel)
2. Enter project name
3. Click Save button
4. Thumbnail generated automatically

**Storage:**
- Browser localStorage
- Key: `hatchstudio-saved-projects`
- JSON format

### Load Project

**Features:**
- Load any saved project
- Confirmation if unsaved changes exist
- Restores complete state

**Usage:**
1. Open Projects tab
2. Click "Load Project" on desired project
3. Confirm if needed
4. State restored

### Delete Project

**Features:**
- Remove from storage
- Confirmation dialog
- Permanent deletion

### Thumbnails

**Generation:**
- Automatic on save
- 200×200px PNG (base64)
- Maintains aspect ratio
- White background

**Display:**
- Shown in Projects tab
- Fallback icon if generation fails
- Helps identify projects

## Keyboard Shortcuts

### Tools

| Key | Action |
|-----|--------|
| **V** | Select Tool |
| **A** | Direct Select Tool |
| **M** | Rectangle Tool |
| **L** | Ellipse Tool |
| **P** | Polygon Tool |
| **\\** | Line Tool |
| **I** | Eyedropper |

### Navigation

| Key | Action |
|-----|--------|
| **Space (Hold)** | Pan Canvas |
| **0 (Zero)** | Zoom to Fit |
| **Ctrl/Cmd + =** | Zoom In |
| **Ctrl/Cmd + -** | Zoom Out |

### Selection & Manipulation

| Key | Action |
|-----|--------|
| **Delete / Backspace** | Delete Selection |
| **Arrows** | Nudge (1mm) |
| **Shift + Arrows** | Nudge (10mm) |
| **Ctrl/Cmd + A** | Select All (unlocked) |
| **Shift + Click** | Toggle selection |

### Transformation

| Key | Action |
|-----|--------|
| **Alt/Option + Drag** | Duplicate and drag |
| **Shift + Drag** | Constrain to axis |
| **Shift + Resize** | Preserve aspect ratio |
| **Alt + Resize** | Resize from center |
| **Shift + Alt + Resize** | Preserve aspect ratio from center |

### Grouping & Operations

| Key | Action |
|-----|--------|
| **Ctrl/Cmd + G** | Group |
| **Ctrl/Cmd + Shift + G** | Ungroup |
| **Ctrl/Cmd + C** | Copy |
| **Ctrl/Cmd + V** | Paste |
| **Ctrl/Cmd + D** | Duplicate |

### History

| Key | Action |
|-----|--------|
| **Ctrl/Cmd + Z** | Undo |
| **Ctrl/Cmd + Shift + Z** | Redo |
| **Ctrl/Cmd + Y** | Redo (alternative) |

## Snapping System

### Snap Targets

**Centers:**
- Shape centers
- Paper center
- Midpoints of edges

**Bounds:**
- Shape edges and corners
- Paper margins
- Bounding box edges

**Visual Feedback:**
- Pink dashed guide lines
- Appears when within threshold (5mm)
- Shows active snap points

### Configuration

**Settings:**
- Toggle snap to centers
- Toggle snap to bounds
- Available in Canvas Settings (Right Panel)

**Threshold:**
- 5mm snap distance
- Configurable (future)

**Use Cases:**
- Precise alignment
- Centering shapes
- Margin alignment
- Consistent spacing

## Related Documentation

- [HATCHING_ENGINE.md](./HATCHING_ENGINE.md) - Detailed hatching algorithms
- [BOOLEAN_OPERATIONS.md](./BOOLEAN_OPERATIONS.md) - Boolean operation details
- [UI_COMPONENTS.md](./UI_COMPONENTS.md) - UI component reference
- [API_REFERENCE.md](./API_REFERENCE.md) - Programmatic API


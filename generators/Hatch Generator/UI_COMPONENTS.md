# UI Components Documentation

## Overview

HatchStudio uses a modular React component architecture with a consistent design system. This document catalogs all UI components, their responsibilities, and usage patterns.

## Component Hierarchy

```
App
├── ErrorBoundary
│   └── App (main layout)
│       ├── TopBar
│       ├── LeftPanel
│       │   ├── LayersTab
│       │   └── ProjectsTab
│       ├── Canvas
│       │   └── SelectionOverlay
│       ├── RightPanel
│       │   ├── Properties (when selected)
│       │   └── CanvasSettings (when no selection)
│       ├── ColorPanel
│       └── PathfinderPanel
```

## Core Components

### App Component

**Location:** `src/components/App.tsx`

**Responsibilities:**
- Main application layout
- Component composition
- Keyboard shortcuts hook

**Structure:**
```tsx
<div className="flex flex-col h-full">
  <TopBar />
  <div className="flex flex-1">
    <LeftPanel />
    <main><Canvas /></main>
    <RightPanel />
  </div>
  <ColorPanel />
  <PathfinderPanel />
</div>
```

### TopBar Component

**Location:** `src/components/TopBar.tsx`

**Responsibilities:**
- Tool selection
- Alignment tools
- Undo/Redo
- Zoom controls
- Export button

**Features:**
- Tool buttons (Select, Direct Select, Rectangle, Ellipse, Polygon, Line)
- Alignment buttons (Left, Center, Right, Top, Middle, Bottom)
- Zoom controls with percentage display
- Export SVG button

**Keyboard Shortcuts:**
- Tool keys (V, A, M, L, P, \)
- Zoom (Ctrl/Cmd + =, -)
- Fit to screen (0)

### LeftPanel Component

**Location:** `src/components/LeftPanel.tsx`

**Responsibilities:**
- Tab navigation (Layers/Projects)
- Layer management UI
- Project save/load UI

**Tabs:**
- **Layers Tab** - Shape list, visibility, locking, reordering
- **Projects Tab** - Save current, load saved projects

**Features:**
- Drag-and-drop reordering
- Project thumbnails
- Project metadata (date, shape count)

### Canvas Component

**Location:** `src/components/Canvas.tsx`

**Responsibilities:**
- SVG rendering
- Mouse event handling
- Shape drawing
- Selection
- Pan/zoom

**Key Features:**
- SVG viewport with viewBox
- Shape rendering (outlines + hatches)
- Mouse interaction (click, drag, wheel)
- Drawing tools
- Selection overlay integration
- Snap guides rendering

**Event Handlers:**
- `handleMouseDown` - Start drawing/selection
- `handleMouseMove` - Update drawing/transformation
- `handleMouseUp` - Complete operation
- `handleWheel` - Zoom

### RightPanel Component

**Location:** `src/components/RightPanel.tsx`

**Responsibilities:**
- Properties panel (when shape selected)
- Canvas settings (when no selection)
- Hatching controls

**Conditional Rendering:**
- **No Selection:** Canvas settings (paper, snapping, global)
- **Selection:** Properties (transform, appearance, hatching)

**Sections:**
- Transform (position, size, rotation, corner radius)
- Appearance (color, outline)
- Hatching (all parameters)

### SelectionOverlay Component

**Location:** `src/components/SelectionOverlay.tsx`

**Responsibilities:**
- Transform handles
- Bounding box display
- Handle interaction

**Handles:**
- 4 corner handles (resize)
- 4 edge handles (stretch)
- 1 rotator handle (top center)

**Features:**
- Blue dashed bounding box
- Handle dragging
- Modifier key support (Shift, Alt)
- Snap integration

### Sidebar Tabs

**Location:** `src/components/sidebar/`

The sidebar tab components are used by LeftPanel for layer management:

#### LayersTab

**Location:** `src/components/sidebar/LayersTab.tsx`

**Features:**
- Shape list
- Drag-and-drop reordering
- Visibility toggle
- Lock toggle
- Rename (double-click)

**Note:** GeometryTab and HatchTab are no longer used. Their functionality has been integrated into RightPanel.

### ColorPanel Component

**Location:** `src/components/ColorPanel.tsx`

**Responsibilities:**
- Color picker
- Swatches
- Color input

**Features:**
- Hex color input
- Color swatches
- Eyedropper integration

### PathfinderPanel Component

**Location:** `src/components/PathfinderPanel.tsx`

**Responsibilities:**
- Boolean operation buttons

**Operations:**
- Union
- Subtract
- Intersect
- Exclude

**Features:**
- Only visible when 2+ shapes selected
- Operation buttons with icons
- Result inherits first shape properties

### ErrorBoundary Component

**Location:** `src/components/ErrorBoundary.tsx`

**Responsibilities:**
- Error catching
- Error display
- Fallback UI

**Features:**
- Catches React errors
- Displays error message
- Prevents app crash


## Design System

### DesignSystem Component

**Location:** `src/components/ui/DesignSystem.tsx`

**Components:**
- `Section` - Collapsible section
- `Label` - Form label
- `Input` - Text input
- `Slider` - Range slider
- `Switch` - Toggle switch

**Usage:**
```tsx
<Section title="Transform" defaultOpen={false}>
  <Label>X Position</Label>
  <Input type="number" value={x} onChange={handleChange} />
  <Slider label="Rotation" min={0} max={360} value={rotation} />
  <Switch label="Enable" checked={enabled} onChange={setEnabled} />
</Section>
```

## UI Patterns

### Controlled Components

All form inputs are controlled by Zustand state:

```tsx
const value = useAppStore(state => state.paper.width);
const setValue = useAppStore(state => state.setPaperSize);

<Input value={value} onChange={(e) => setValue(Number(e.target.value))} />
```

### Conditional Rendering

Components render conditionally based on state:

```tsx
{hasSelection ? (
  <RightPanel /> // Shows properties
) : (
  <RightPanel /> // Shows canvas settings
)}
```

### Event Handling

Mouse events use refs and callbacks:

```tsx
const handleMouseDown = useCallback((e: React.MouseEvent) => {
  const worldPoint = screenToWorld(e.clientX, e.clientY);
  // Handle interaction
}, [dependencies]);
```

## Keyboard Shortcuts

### Implementation

**Location:** `src/hooks/useKeyboardShortcuts.ts`

**Hook:** `useKeyboardShortcuts()`

### Shortcut Reference

#### Tools
- **V** - Select Tool
- **A** - Direct Select Tool
- **M** - Rectangle Tool
- **L** - Ellipse Tool
- **P** - Polygon Tool
- **\\** - Line Tool
- **I** - Eyedropper

#### Navigation
- **Space (Hold)** - Pan Canvas
- **0** - Zoom to Fit
- **Ctrl/Cmd + =** - Zoom In
- **Ctrl/Cmd + -** - Zoom Out

#### Selection & Manipulation
- **Delete/Backspace** - Delete Selection
- **Arrow Keys** - Nudge (1mm)
- **Shift + Arrow** - Nudge (10mm)
- **Ctrl/Cmd + A** - Select All
- **Shift + Click** - Toggle Selection

#### Transformation
- **Alt/Option + Drag** - Duplicate and Drag
- **Shift + Drag** - Constrain to Axis
- **Shift + Resize** - Preserve Aspect Ratio
- **Alt + Resize** - Resize from Center

#### Grouping & Operations
- **Ctrl/Cmd + G** - Group
- **Ctrl/Cmd + Shift + G** - Ungroup
- **Ctrl/Cmd + C** - Copy
- **Ctrl/Cmd + V** - Paste
- **Ctrl/Cmd + D** - Duplicate

#### History
- **Ctrl/Cmd + Z** - Undo
- **Ctrl/Cmd + Shift + Z** - Redo
- **Ctrl/Cmd + Y** - Redo (alternative)

### Implementation Details

**Input Filtering:**
- Ignores shortcuts when typing in inputs
- Checks for modifier keys
- Prevents default browser behavior

**Example:**
```typescript
if ((e.target as HTMLElement).tagName === 'INPUT') {
  return; // Ignore when typing
}
```

## Styling

### Tailwind CSS

All components use Tailwind CSS utility classes.

**Theme:**
- Monochrome technical theme
- Gray scale colors
- Blue accents for selection
- Consistent spacing and typography

### Color Scheme

- **Background:** White/Gray-100
- **Borders:** Gray-200
- **Text:** Gray-900
- **Selection:** Blue-600
- **Hover:** Gray-100

### Layout

- **Fixed Panels:** Left (272px), Right (288px)
- **Flexible Canvas:** Remaining space
- **Top Bar:** Fixed height (56px)

## Component Communication

### State Management

Components communicate via Zustand store:

```tsx
// Read state
const shapes = useAppStore(state => state.shapes);

// Update state
const updateShape = useAppStore(state => state.updateShape);
updateShape(id, { x: 100 });
```

### Event Flow

```
User Action → Component → Store Action → State Update → Re-render
```

### Props

Minimal prop passing - most communication via store:

```tsx
// Minimal props
<SelectionOverlay containerRef={ref} paper={paper} viewTransform={viewTransform} />
```

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [FEATURES.md](./FEATURES.md) - Feature documentation
- [API_REFERENCE.md](./API_REFERENCE.md) - Component APIs


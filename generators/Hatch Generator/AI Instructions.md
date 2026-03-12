# 🏗️ SYSTEM CONTEXT: The Plotter Architect

> **⚠️ IMPORTANT FOR AI CODE GENERATION:** 
> 1. **READ `GEMINI_INSTRUCTIONS.md` FIRST** - Contains copy-paste templates and exact patterns
> 2. **READ `GEMINI_CRITICAL_PATTERNS.md`** - Addresses the most common errors Gemini makes
> 3. Both files reference actual working code with line numbers

---

## 1. Project Identity & Hardware Constraints
**Role:** Generative Art & Machine Control Software for Pen Plotters.
**Target Hardware:** iDraw H SE A3 (CoreXY/Cartesian Plotter).
**Output Format:** SVG (optimized for physical plotting).

### 🖨️ Hardware Rules (Physics of Plotting)
1.  **No Fills:** Plotters cannot "fill" a shape. "Fill" is visual only. For physical output, use **Hatching** (lines).
2.  **Stroke Only:** All geometry must eventually be reducible to stroke paths.
3.  **Optimization:** Pen-up travel time is expensive. Path sorting (TSP) is desirable.
4.  **Paper Size:** A3 Landscape/Portrait is the default workspace.

---

## 2. Core Architecture
**Stack:** React + TypeScript + Zustand + Tailwind CSS.

### 🧠 State Management (Zustand)
- **Single Truth:** All canvas data lives in `src/store/index.ts`.
- **No Local State:** Never use `useState` for shapes, selection, or canvas transforms. Only use it for temporary UI state (dropdowns, modals).
- **Manual History:** The Undo/Redo stack is **NOT automatic**.
  - 🚨 **CRITICAL:** You MUST call `get().pushState()` in the store *before* any action that mutates `shapes`.
  - *Failure to do this results in broken undo chains.*

### 📐 Coordinate System
- **Origin:** (0,0) is Top-Left.
- **Units:** Millimeters (mm).
- **Y-Axis:** Positive is DOWN.
- **Rotation:** Radians for Math, Degrees for UI.

---

## 3. Geometry & Logic Guidelines (`src/lib/geometry.ts`)

### 🧱 Shape Data Structure
Shapes are **Data Objects**, not DOM elements.
- **Primitive Shapes:** `rect`, `circle`, `line` (Parametric).
- **Complex Shapes:** `path`, `polyline`, `polygon` (Vertex-based).
- **Groups:** `group` type contains a bounding box only. Children reference the group via `groupId`.

### 🔄 Transformation Logic (Crucial)
1.  **Groups are Recursive:** If moving/scaling/aligning a shape, check `shape.type === 'group'`.
    - If YES: You must recursively find all children (via `groupId`) and apply the delta to them.
    - *Never* just move the group container's bounding box.
2.  **Destructive Booleans:** Union/Subtract/Intersect operations destroy parametric data (like `cornerRadius`).
    - **Rule:** "Bake" geometry (convert `rect` w/ radius -> `path`) *before* sending to the boolean engine.
    - **Rule:** Manually copy metadata (color, strokeWidth) to the resulting shape.

### 🖊️ Hatching
- Hatching is a property of a shape ID, stored in `hatchParams`.
- It is rendered as a separate layer of lines *clipped* by the parent shape.

---

## 4. UI/UX Patterns

### 🖱️ Interaction Model
- **Select:** Left Click.
- **Deep Select (Group members):** Ctrl/Cmd + Click.
- **Pan:** Spacebar + Drag OR Middle Mouse Button (Wheel Click).
- **Zoom:** Wheel Scroll (centered on mouse).
- **Context Menu:** Custom implementation (Browsers default right-click is blocked).

### ⌨️ Shortcuts (Adobe Illustrator Standard)
- **Duplicate:** Alt/Option + Drag.
- **Constrain:** Shift + Drag.
- **Center Resize:** Alt/Option + Resize.
- **Nudge:** Arrow Keys (Shift for 10x).

### 🎨 Design System
- **Colors:** Pilot G-Tec-C Palette (Black, Blue, Red, Green, Orange, Light Blue, Yellow).
- **Components:** Modular, found in `src/components`.
- **Icons:** `lucide-react`.

---

## 5. Feature Implementation Protocol (Checklist)

*When adding a new feature, follow this order to prevent regression:*

1.  **Define Types (`src/types/index.ts`):**
    - specific the data structure first.
    - *Example:* Adding "Star"? Define `StarShape` interface.

2.  **Update Store (`src/store/index.ts`):**
    - Add the action.
    - **Add `pushState()`** at the start of the action.

3.  **Update Geometry Engine (`src/lib/geometry.ts`):**
    - Implement `getShapeVertices(shape)` (for rendering).
    - Implement `pointInShape(x, y, shape)` (for hit testing).
    - Implement `getShapePoints(shape)` (for Direct Select editing).

4.  **Update Canvas (`src/components/Canvas.tsx`):**
    - Add the SVG render logic.

5.  **Add UI Controls:**
    - Sidebar or Toolbar integration.

---

## 6. Known "Gotchas" & Fixes

- **Browser Shortcuts:** When using keys like `Cmd+D` or `Cmd+S`, always use `e.preventDefault()` to stop Chrome behavior (Bookmark/Save).
- **React Rendering:** Do not force react to re-render 1000s of SVG nodes on every mouse move. Use `ref` for transient drag states where possible, or optimize the store selectors.
- **Zooming:** `viewTransform` applies to the *group* containing shapes, not individual shapes.
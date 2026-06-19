# Studio 1 — Generator Development Blueprint

> **One rule:** every generator produces stroke-only SVGs for pen plotting on Nadav's **iDraw pen plotters (A3 and A2)** — A3 is the default, A2 (420 × 594 mm) is the max.
> This document is the single source of truth. Point Claude here and say *"build me a generator that does X"*.

---

## 1. SVG Output Spec

Every generator must produce SVGs that conform to this spec. No exceptions.

### Paper

| Size | Width | Height | Orientation |
|------|-------|--------|-------------|
| A3 (default) | 297 mm | 420 mm | Portrait |
| A3 landscape | 420 mm | 297 mm | Landscape |
| A2 (max) | 420 mm | 594 mm | Portrait |
| A2 landscape | 594 mm | 420 mm | Landscape |

### Root `<svg>` element

```xml
<svg xmlns="http://www.w3.org/2000/svg"
     width="297mm" height="420mm"
     viewBox="0 0 297 420">
```

- `width` / `height` — always with `mm` unit suffix
- `viewBox` — unitless, but **1 unit = 1 mm**
- Coordinates: origin top-left, Y grows downward

### Paths and strokes

```xml
<path d="M 10,10 L 50,80 L 90,10"
      fill="none"
      stroke="#000000"
      stroke-width="0.4"
      stroke-linecap="round"
      stroke-linejoin="round" />
```

| Attribute | Rule |
|-----------|------|
| `fill` | Always `none` — no filled shapes |
| `stroke` | Hex color — each color = one pen/layer |
| `stroke-width` | 0.3–0.4 mm default. Range: 0.1–2.0 mm. Unitless (mm implied by viewBox) |
| `stroke-linecap` | `round` |
| `stroke-linejoin` | `round` |

### Layers (multi-pen)

Group paths by pen color in `<g>` elements:

```xml
<g id="layer-black" stroke="#000000" fill="none"
   stroke-width="0.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="..." />
  <path d="..." />
</g>
<g id="layer-red" stroke="#e91e63" fill="none"
   stroke-width="0.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="..." />
</g>
```

### Forbidden

- No `<rect>`, `<circle>`, `<ellipse>` with fills
- No `<image>`, `<text>`, `<filter>`, `<mask>`, `<clipPath>`
- No raster data, gradients, or opacity
- No CSS `fill` overrides — plotter ignores fills entirely

### Margin

Keep a safe margin of **10–15 mm** from all edges to avoid the plotter's physical limits.

### Allowed elements

`<path>`, `<line>`, `<polyline>` — all stroked, no fill.

---

## 2. Architecture Patterns

### Decision tree

```
Need Python for heavy processing (images, MIDI, STL, math)?
├── Yes → need complex interactive UI (real-time 3D, canvas, drag)?
│   ├── Yes → Pattern 2 (Vite+React) frontend + Pattern 1 (Flask) backend
│   └── No  → Pattern 1 (Flask + JS)
└── No
    ├── Complex interactive UI needed? → Pattern 2 (Vite + React + TS)
    ├── Quick prototype, no server? → Pattern 3 (Standalone HTML)
    └── Desktop-only tool? → Pattern 5 (Desktop App)
```

---

### Pattern 1: Flask + JS

*Used by: Flow Field, Midi, Ribbon, Image Processor (backend), Plotter UI*

```
my-generator/
├── app.py
├── requirements.txt
├── static/
│   ├── css/style.css
│   └── js/app.js
└── templates/
    └── index.html
```

**Start:** `python3 app.py`
**When:** Python-heavy processing, file conversion, backend logic with a simple UI.

**Starter `app.py`:**

```python
from flask import Flask, render_template, request, jsonify, send_file
import io

app = Flask(__name__)

A3_W, A3_H = 297, 420
MARGIN = 15
STROKE_W = 0.4

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/generate', methods=['POST'])
def generate():
    params = request.get_json() or {}
    # ... generate paths from params ...
    paths = []
    return jsonify({'paths': paths})

@app.route('/api/export', methods=['POST'])
def export():
    data = request.get_json() or {}
    svg = build_svg(data)
    return send_file(
        io.BytesIO(svg.encode('utf-8')),
        mimetype='image/svg+xml',
        as_attachment=True,
        download_name='output.svg'
    )

def build_svg(data):
    paths_svg = '\n'.join(
        f'  <path d="{p}" fill="none" stroke="#000" '
        f'stroke-width="{STROKE_W}" stroke-linecap="round" stroke-linejoin="round"/>'
        for p in data.get('paths', [])
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{A3_W}mm" height="{A3_H}mm" viewBox="0 0 {A3_W} {A3_H}">\n'
        f'{paths_svg}\n</svg>'
    )

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=PORT, debug=True)
```

**Starter `requirements.txt`:**

```
Flask==3.0.0
```

Common additions: `svgwrite`, `numpy`, `opencv-python`, `mido`, `noise`, `shapely`

---

### Pattern 2: Vite + React + TypeScript

*Used by: Hatch, STL Generator, Image Processor (frontend)*

```
my-generator/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── components/
    │   ├── Sidebar.tsx
    │   └── Preview.tsx
    ├── lib/
    │   ├── generator.ts
    │   └── svg-export.ts
    └── store/
        └── index.ts
```

**Start:** `npm run dev`
**When:** Complex interactive UI, real-time parameter controls, canvas/3D rendering.

**Key dependencies:**

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "zustand": "^4",
    "lucide-react": "^0.300"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4",
    "tailwindcss": "^3",
    "autoprefixer": "^10",
    "postcss": "^8",
    "typescript": "^5"
  }
}
```

**Starter `vite.config.ts`:**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: PORT },
  resolve: { alias: { '@': '/src' } }
})
```

**Starter SVG export (`src/lib/svg-export.ts`):**

```typescript
const A3_W = 297;
const A3_H = 420;

export function buildSVG(paths: string[], strokeWidth = 0.4): string {
  const content = paths
    .map(d => `  <path d="${d}" fill="none" stroke="#000" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${A3_W}mm" height="${A3_H}mm"
     viewBox="0 0 ${A3_W} ${A3_H}">
${content}
</svg>`;
}

export function downloadSVG(svgContent: string, filename: string): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

### Pattern 3: Standalone HTML/JS

*Used by: Snake, Weaving Generator*

```
my-generator/
├── index.html
├── app.js
├── style.css
└── [extra-modules].js
```

**Start:** Open `index.html` in browser. No server needed.
**When:** Single-purpose tools, quick prototypes, no backend, no build step.

**Starter `index.html`:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Generator — Studio 1</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <aside id="controls">
    <h1>My Generator</h1>
    <fieldset>
      <legend>Parameters</legend>
      <label>Density <output id="val-density">50</output></label>
      <input type="range" id="density" min="1" max="100" value="50">
    </fieldset>
    <div class="actions">
      <button id="btn-generate">Generate</button>
      <button id="btn-export">Export SVG</button>
    </div>
  </aside>
  <main>
    <svg id="artboard" xmlns="http://www.w3.org/2000/svg"
         width="297mm" height="420mm" viewBox="0 0 297 420"
         preserveAspectRatio="xMidYMid meet">
    </svg>
  </main>
  <script src="app.js"></script>
</body>
</html>
```

**Starter `app.js`:**

```javascript
const A3_W = 297, A3_H = 420, MARGIN = 15, STROKE_W = 0.4;

function generate() {
  const svg = document.getElementById('artboard');
  svg.innerHTML = '';
  // ... generate paths, append to svg ...
}

function exportSVG() {
  const svg = document.getElementById('artboard');
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'output.svg';
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('btn-generate').addEventListener('click', generate);
document.getElementById('btn-export').addEventListener('click', exportSVG);
document.getElementById('density').addEventListener('input', e => {
  document.getElementById('val-density').textContent = e.target.value;
  generate();
});

generate();
```

---

### Pattern 4: Python HTTP Server + Static Frontend

*Used by: Fill Generator (STL2SVG)*

```
my-generator/
├── server.py
├── index.html
├── app.js
├── style.css
└── lib/
    └── processing.py
```

**Start:** `python3 server.py`
**When:** Need Python processing but Flask is overkill. Serves static files with a few API endpoints.

---

### Pattern 5: Desktop App (Tkinter)

*Used by: Music Viz (Data Weaver)*

```
my-generator/
├── app.py
└── requirements.txt
```

**Start:** `python3 app.py`
**When:** Desktop-only GUI, no browser needed, Tkinter/PyQt interface. Rare — prefer web-based.

---

## 3. UI Conventions

All web-based generators follow the same UX pattern:

### Layout

```
┌─────────────────────────────────────────────┐
│  [Header / Toolbar — optional]              │
├──────────────┬──────────────────────────────┤
│  Sidebar     │  Preview Area                │
│  (~300px)    │  (SVG or Canvas)             │
│              │                              │
│  [Controls]  │  ┌────────────────────────┐  │
│  [Sliders]   │  │  A3 Paper Preview      │  │
│  [Sections]  │  │  (white, with margin)  │  │
│              │  └────────────────────────┘  │
│              │                              │
│  [Generate]  │                              │
│  [Export]    │                              │
└──────────────┴──────────────────────────────┘
```

### Controls

- Group related parameters in **fieldsets** or collapsible **sections**
- Every slider shows its **current value** next to the label
- Use `<input type="range">` with a `<output>` or `<span>` for the value
- Debounce parameter changes: **150–300ms** before regenerating preview

### Buttons

- **Generate / Regenerate** — primary action, prominent styling
- **Export SVG / Download SVG** — secondary action
- If the generator uses randomness, show a **seed** and provide **Randomize**

### Preview area

- White background representing the paper
- A3 aspect ratio (297:420 portrait or 420:297 landscape)
- SVG or Canvas element, `preserveAspectRatio="xMidYMid meet"`
- Optional: zoom controls, fit-to-view button

### Styling

- **Standalone HTML:** Custom CSS with CSS variables (`--bg`, `--accent`, `--panel-w`)
- **React apps:** Tailwind CSS, `lucide-react` for icons
- **Flask apps:** Custom CSS in `static/css/style.css`
- Sidebar has a subtle border or shadow separating it from preview

---

## 4. SVG Export Patterns

### Client-side (JavaScript)

Used by standalone HTML and React generators:

```javascript
function downloadSVG(svgContent, filename) {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Server-side (Flask)

Used when SVG is built in Python:

```python
from flask import send_file
import io

def export_svg(svg_string):
    return send_file(
        io.BytesIO(svg_string.encode('utf-8')),
        mimetype='image/svg+xml',
        as_attachment=True,
        download_name='output.svg'
    )
```

### Python SVG libraries

- **`svgwrite`** — high-level, used by Midi and Image Processor
- **`xml.etree.ElementTree`** — low-level, used by Flow Field

`svgwrite` example:

```python
import svgwrite

dwg = svgwrite.Drawing(size=('297mm', '420mm'))
dwg.viewbox(0, 0, 297, 420)
dwg.add(dwg.path(d='M 10,10 L 50,80', fill='none', stroke='#000',
                  stroke_width=0.4, stroke_linecap='round', stroke_linejoin='round'))
svg_string = dwg.tostring()
```

---

## 5. Port Allocation

| Port | App | Pattern | Notes |
|------|-----|---------|-------|
| 3000 | Studio-OS | Next.js | |
| 4000 | Hatch Generator | Vite+React | |
| 5001 | Plotter UI | Flask | |
| 5050 | Midi Project | Flask | |
| 5173 | *(Vite default)* | — | **Avoid** — used as fallback by STL Gen and Image Processor FE |
| 5500 | Image Processor (Backend) | Flask | |
| 7777 | Dashboard Launcher | Python HTTP | |
| 8000 | Flow Field Generator | Flask | **Conflicts with Ribbon** — run one at a time |
| 8000 | Ribbon Generator | Flask | **Conflicts with Flow Field** — run one at a time |
| 8001 | Fill Generator (STL2SVG) | Python HTTP | |

### Next available ports

Pick from these for new generators: **4001, 5002, 5051, 6000–6999, 8002, 9000–9999**

---

## 6. Dashboard Integration

When a new generator is created, register it in the dashboard:

### Step A — Add to `dashboard/launcher.py`

Add an entry to the `APPS` dict:

```python
"my-generator": {
    "name": "My Generator",
    "cwd": os.path.join(REPO, "generators", "My Generator"),
    "cmd": ["python3", "app.py"],       # or ["npm", "run", "dev"]
    "port": 6000,                        # pick an unused port
    "url": "http://localhost:6000",
},
```

### Step B — Add card to `dashboard/index.html`

Add inside the `<!-- GENERATORS -->` app-grid div:

```html
<div class="app-card" data-app="my-generator">
  <div>
    <h3>My Generator</h3>
    <p class="desc">One-line description of what this generator does.</p>
  </div>
  <div class="card-footer">
    <span class="tag tag-flask">Flask</span>  <!-- or tag-vite, tag-html -->
    <div class="btn-group">
      <button class="launch-btn" onclick="launchApp('my-generator')">Launch</button>
      <button class="stop-btn" onclick="stopApp('my-generator')" style="display:none">Stop</button>
    </div>
  </div>
  <div class="launch-info">localhost:6000</div>
</div>
```

For standalone HTML apps (no server), use a direct link instead:

```html
<a class="launch-btn" href="../generators/My Generator/index.html" target="_blank">Open</a>
```

### Step C — Add URL mapping

In the `APP_URLS` object in `dashboard/index.html` script:

```javascript
'my-generator': 'http://localhost:6000',
```

### Step D — Update port table

Add the port to Section 5 of this document and remove it from "next available."

### Tag classes

| Tag | CSS class |
|-----|-----------|
| Flask | `tag-flask` |
| Vite+React | `tag-vite` |
| Standalone HTML | `tag-html` |
| Next.js | `tag-nextjs` |
| Tkinter/Desktop | `tag-tkinter` |

---

## 7. How to Request a New Generator

Use this template when asking Claude to build a generator:

```
Build a new generator called [NAME].

- What it does: [describe the visual output — what does the plotter draw?]
- Input: [none / file upload (type) / image / data / paste]
- Pattern: [Flask / Vite+React / Standalone HTML]
- Port: [pick from available in Section 5]
- Key parameters: [list the sliders and controls you want]
- Special needs: [layers? randomness/seed? animation preview? 3D? file parsing?]

Reference: GENERATORS.md
```

**Example:**

```
Build a new generator called Voronoi Generator.

- What it does: generates Voronoi diagrams from random or placed points,
  draws cell edges as pen-plotter paths on A3
- Input: none (random points) + optional click-to-place
- Pattern: Standalone HTML
- Port: none (no server)
- Key parameters: point count, margin, stroke width, cell relaxation iterations
- Special needs: seed display, randomize button, layers for cell edges vs points

Reference: GENERATORS.md
```

Claude will:
1. Scaffold the app from the matching pattern, with the SVG spec baked in
2. Wire up all parameters with live preview
3. Add it to `dashboard/launcher.py` and `dashboard/index.html`
4. Update the port table in this document

---

## 8. All Apps

| App | Pattern | Port | Entry | Notes |
|-----|---------|------|-------|-------|
| Flow Field Generator | Flask + JS | 8000 | `python3 app.py` | Shares port with Ribbon |
| Hatch Generator | Vite+React | 4000 | `npm run dev` | |
| Image Processor (Backend) | Flask | 5500 | `python3 app.py` | API only, no UI |
| Image Processor (Frontend) | Vite+React | 5173 | `npm run dev` | Talks to backend on 5500 |
| Midi Project | Flask + JS | 5050 | `python3 app.py` | |
| STL Generator | Vite+React | 5173 | `npm run dev` | |
| Fill Generator (STL2SVG) | Python HTTP | 8001 | `python3 server.py` | |
| Snake | Standalone HTML | — | `index.html` | |
| Weaving Generator | Standalone HTML | — | `index.html` | |
| Hershey Hebrew Generator | Python HTTP | 8095 | `python3 server.py` | Single-line Miriam Libre Hebrew font; type Hebrew → plotter SVG. Glyph editor saves to `font/overrides.json`. Font built by `tools/build_font.py` |
| Modular Generator | Standalone HTML | — | `index.html` | Modular geometric riso/Bauhaus compositions. 4 modes (Modular Pack, Motif Grid, Pixel Field, Grid Composition), fixed 10-pen Pilot palette (per-pen on/off), stroke-only multi-pen layers, A6–A2 (A2 default) |
| Rietveld Lattice | Vite+React | 6060 | `npm run dev` | Axonometric 3D lattice (Rietveld-derived) → plotter SVG; Three.js viewport + custom SVG projector; seeded, IndexedDB favourites |
| Ribbon Generator | Flask + JS | 8000 | `python3 app.py` | Shares port with Flow Field |
| Music Viz (Data Weaver) | Tkinter Desktop | — | `python3 Buu.py` | |
| Plotter UI | Flask + JS | 5001 | `python3 app.py` | Tool, not generator |
| Studio-OS | Next.js | 3000 | `npm run dev` | Tool, not generator |
| Dashboard Launcher | Python HTTP | 7777 | `python3 launcher.py` | Infrastructure |

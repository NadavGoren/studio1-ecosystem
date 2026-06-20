# Generator Template

A reusable base for building new plotter-art SVG generators.
Every generator in this ecosystem starts from a copy of this folder.

---

## Stack

| Layer    | Tech |
|----------|------|
| Backend  | Python · Flask |
| Frontend | Vanilla JS (ES modules) · HTML · CSS |
| Output   | Plotter-ready SVG · A3 · mm units |

---

## Creating a New Generator

### 1 — Copy this folder

```bash
cp -r generators/_template generators/My\ New\ Generator
cd generators/My\ New\ Generator
```

### 2 — Rename things

| File | What to change |
|------|----------------|
| `app.py` | `GENERATOR_NAME`, `PORT` (pick next free above 5100) |
| `templates/index.html` | `<title>` and `<h1>` in the sidebar header |

**Ports in use:**
| Generator | Port |
|-----------|------|
| Midi Project | 5050 |
| Image Processor | 5500 |
| Flow Field | 8000 |
| _template_ | 5100 |
| _next available_ | 5101, 5102, … |

### 3 — Write your algorithm

Open `app.py` and replace the placeholder body inside `generate(params)`.
The function receives a plain dict of all sidebar parameters and must return
a complete SVG string.

```python
def generate(params: dict) -> str:
    seed  = int(params.get('seed', 0))
    rng   = np.random.default_rng(seed)

    dwg = svgwrite.Drawing(size=("297mm","420mm"), profile="full")
    dwg.viewbox(0, 0, 297, 420)
    # ... your art here ...
    return dwg.tostring()
```

### 4 — Add your sliders

Open `templates/index.html`. Every `<input>` with a `data-param` attribute
is automatically collected by `main.js` and sent to `/generate`.

**Add a slider:**
```html
<div class="control-row">
  <div class="control-label">
    <span>Grid Size</span>
    <span class="control-value" id="val-grid-size">20</span>
  </div>
  <input type="range" id="grid-size"
    min="5" max="80" step="1" value="20"
    data-param="gridSize" />
</div>
```

That's it — `params['gridSize']` will arrive in Python automatically.

**Available input types:**

| HTML element | `data-param` value in Python |
|---|---|
| `<input type="range">` | `float` |
| `<input type="number">` | `float` |
| `<input type="checkbox">` | `bool` |
| `<input type="color">` | `str` hex e.g. `"#ff0000"` |
| `<select>` | `str` |

### 5 — Run it

```bash
pip install -r requirements.txt
python app.py
# open http://localhost:PORT
```

---

## File Structure

```
_template/
├── app.py                  # Flask server + generator algorithm
├── requirements.txt        # Python dependencies
├── README.md               # This file
├── templates/
│   └── index.html          # Sidebar UI + preview area
└── static/
    ├── css/
    │   └── style.css       # Dark theme, sidebar, sliders
    └── js/
        ├── main.js         # UI wiring: sliders → fetch → preview → export
        └── utils.js        # A3 constants, seeded RNG, SVG download helper
```

---

## Conventions (shared across all generators)

- SVG dimensions: `width="297mm" height="420mm"`, `viewBox="0 0 297 420"`
- Stroke widths in mm (e.g. `stroke-width="0.3"`)
- Inkscape layer groups:
  ```xml
  <g inkscape:label="Layer 1" inkscape:groupmode="layer" id="layer1">
  ```
- Seed embedded in SVG: `<desc>seed:0a1b2c3d</desc>`
- Export filename: `{generator-name}-{seed-hex}.svg`
- One Flask app per generator, its own port, no shared server

---

## Keyboard Shortcuts (in the browser)

| Key | Action |
|-----|--------|
| `Space` | Generate |
| `Cmd/Ctrl + S` | Export SVG |

---

## utils.js — quick reference

```js
import { A3, mulberry32, randFloat, downloadSVG, buildSVGWrapper, inkscapeLayer, lerp, clamp, map } from './utils.js';

// Paper dimensions
A3.portrait   // { width: 297, height: 420 }
A3.landscape  // { width: 420, height: 297 }

// Seeded RNG
const rand = mulberry32(seed);
rand()                        // float in [0, 1)
randFloat(rand, 10, 50)       // float in [10, 50)
randInt(rand, 1, 100)         // integer in [1, 100]

// SVG helpers
buildSVGWrapper(297, 420, innerSVG, { seed, generatorName })
inkscapeLayer("Layer 1", "layer1", pathElements)
downloadSVG(svgString, "my-gen-0a1b2c3d.svg")

// Math helpers
lerp(a, b, t)
clamp(v, lo, hi)
map(v, inMin, inMax, outMin, outMax)
```

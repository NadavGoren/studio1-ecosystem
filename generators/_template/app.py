"""
app.py — Generator Template
============================
Flask server for a plotter-art SVG generator.

Quickstart
----------
    pip install -r requirements.txt
    python app.py
    open http://localhost:5100

Customizing
-----------
1.  Rename this folder to your generator name.
2.  Change PORT below to the next free port above 5100.
3.  Replace the `generate()` function body with your algorithm.
4.  Add/remove parameters in `index.html` (any [data-param] input is
    automatically sent to this endpoint by main.js).
5.  Update the title in `templates/index.html`.
"""

from flask import Flask, render_template, request, jsonify
import svgwrite
import numpy as np
import random
import math

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Config — edit these
# ---------------------------------------------------------------------------

PORT          = 5100          # ← change when creating a new generator
GENERATOR_NAME = "My Generator"  # ← change to your generator's name

# A3 paper dimensions in mm
WIDTH_MM  = 297
HEIGHT_MM = 420


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/generate', methods=['POST'])
def generate_route():
    """
    Receive JSON params from the browser, run the generator,
    return { "svg": "<svg...>" }.
    """
    params = request.get_json(force=True) or {}
    try:
        svg_string = generate(params)
        return jsonify({"svg": svg_string})
    except Exception as e:
        app.logger.exception("Generation failed")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Core generator — REPLACE THIS with your algorithm
# ---------------------------------------------------------------------------

def generate(params: dict) -> str:
    """
    Build and return a plotter-ready SVG string.

    `params` is a plain dict of everything the sidebar sends.
    All keys match the [data-param] attributes in index.html.

    Default keys always present (from the template UI):
        seed          (int)   – seeded RNG value, 32-bit unsigned
        lineCount     (float) – example slider
        noiseScale    (float) – example slider
        stepLength    (float) – example slider
        orientation   (str)   – "portrait" | "landscape"
        margin        (float) – margin in mm
        strokeWidth   (float) – pen stroke width in mm
        strokeColor   (str)   – hex color, e.g. "#000000"
        showMargin    (bool)  – draw margin rectangle?

    Return: complete SVG markup as a string (what the browser will display
    and what gets saved to disk on Export).
    """

    # ------------------------------------------------------------------
    # 1.  Unpack & validate params
    # ------------------------------------------------------------------
    seed         = int(params.get('seed', 0)) & 0xFFFFFFFF
    orientation  = params.get('orientation', 'portrait')
    margin       = float(params.get('margin', 15))
    stroke_width = float(params.get('strokeWidth', 0.3))
    stroke_color = params.get('strokeColor', '#000000')
    show_margin  = bool(params.get('showMargin', False))
    line_count   = int(params.get('lineCount', 80))

    # Paper size
    if orientation == 'landscape':
        w, h = HEIGHT_MM, WIDTH_MM
    else:
        w, h = WIDTH_MM, HEIGHT_MM

    # Drawable area
    x0 = margin
    y0 = margin
    x1 = w - margin
    y1 = h - margin

    # ------------------------------------------------------------------
    # 2.  Seed the RNG
    #     Use numpy's default_rng for reproducible results;
    #     fall back to random.seed for stdlib functions.
    # ------------------------------------------------------------------
    rng = np.random.default_rng(seed)
    random.seed(seed)

    # ------------------------------------------------------------------
    # 3.  Build SVG with svgwrite
    # ------------------------------------------------------------------
    dwg = svgwrite.Drawing(
        filename   = "output.svg",
        size       = (f"{w}mm", f"{h}mm"),
        profile    = "full",
    )
    dwg.viewbox(0, 0, w, h)
    dwg.attribs['xmlns:inkscape'] = 'http://www.inkscape.org/namespaces/inkscape'

    # Embed seed for reproducibility
    dwg.add(dwg.desc(f"seed:{seed:08x}"))

    # Optional margin rectangle (useful for alignment)
    if show_margin:
        dwg.add(dwg.rect(
            insert = (x0, y0),
            size   = (x1 - x0, y1 - y0),
            fill   = 'none',
            stroke = stroke_color,
            **{'stroke-width': stroke_width * 0.3}
        ))

    # ------------------------------------------------------------------
    # 4.  YOUR ALGORITHM GOES HERE
    #
    #     Below is a minimal placeholder: random horizontal lines.
    #     Delete everything in this section and replace with your art.
    # ------------------------------------------------------------------

    layer = dwg.g(
        id                    = "layer1",
        **{
            'inkscape:label':     "Layer 1",
            'inkscape:groupmode': "layer",
        }
    )

    for _ in range(line_count):
        y   = float(rng.uniform(y0, y1))
        lx0 = float(rng.uniform(x0, x0 + (x1 - x0) * 0.3))
        lx1 = float(rng.uniform(x1 - (x1 - x0) * 0.3, x1))
        layer.add(dwg.line(
            start  = (lx0, y),
            end    = (lx1, y),
            stroke = stroke_color,
            **{'stroke-width': stroke_width, 'stroke-linecap': 'round'}
        ))

    dwg.add(layer)

    # ------------------------------------------------------------------
    # 5.  Return SVG string
    # ------------------------------------------------------------------
    return dwg.tostring()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    print(f"\n  {GENERATOR_NAME}")
    print(f"  Running at http://localhost:{PORT}\n")
    app.run(debug=True, port=PORT)

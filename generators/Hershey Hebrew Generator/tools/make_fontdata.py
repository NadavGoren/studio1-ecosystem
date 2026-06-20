#!/usr/bin/env python3
"""Bundle the two font JSONs into font-data.js (a file:// page can't fetch JSON)."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)

def load(name):
    with open(os.path.join(PROJ, "font", name), encoding="utf-8") as f:
        return json.load(f)

bundle = {"faithful": load("miriam-singleline.json"),
          "clean":    load("miriam-singleline-clean.json")}

# Bake permanent hand-edits: drop an editor-exported overrides.json into font/ and
# they get merged into both variants here, surviving build_font.py rebuilds.
ovp = os.path.join(PROJ, "font", "overrides.json")
if os.path.exists(ovp):
    with open(ovp, encoding="utf-8") as f:
        ov = json.load(f)
    for variant in ("faithful", "clean"):
        for ch, gd in ov.items():
            if ch in bundle[variant]["glyphs"]:
                bundle[variant]["glyphs"][ch]["strokes"] = gd["strokes"]
                if gd.get("advance") is not None:
                    bundle[variant]["glyphs"][ch]["advance"] = gd["advance"]
    print(f"merged {len(ov)} baked override(s) from overrides.json")

out = os.path.join(PROJ, "font-data.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("window.HEBREW_FONTS = " + json.dumps(bundle, ensure_ascii=False) + ";\n")
print("wrote", out, os.path.getsize(out), "bytes")

# quick look at how a few niqqud are stored (advance + x-range), to center them
g = bundle["faithful"]["glyphs"]
for cp, label in [("05B7", "patah"), ("05B4", "hiriq"), ("05B9", "holam"),
                  ("05BC", "dagesh"), ("05C1", "shin-dot")]:
    ch = chr(int(cp, 16)); gd = g.get(ch)
    if not gd:
        print(label, "missing"); continue
    xs = [p[0] for st in gd["strokes"] for p in st]
    ys = [p[1] for st in gd["strokes"] for p in st]
    rng = (round(min(xs), 1), round(max(xs), 1), round(min(ys), 1), round(max(ys), 1)) if xs else None
    print(f"{label:9} adv={gd['advance']:4} npts={sum(len(s) for s in gd['strokes'])} xy[min/max]={rng}")

#!/usr/bin/env python3
"""Render sample Hebrew words from the single-line JSON to a PNG (RTL).
Proves the stroke data drives a text renderer end to end."""
import os, json
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
data = json.load(open(os.path.join(PROJ, "font", "miriam-singleline.json")))
G = data["glyphs"]

LINES = ["סטודיו 1", "שלום עולם", "נדב גורן", "אבגדהוזחט 2026"]
PX_PER_EM = 130
PAD = 40
LINE_GAP = 60
EM_TOP, EM_BOT = 820, -260          # drawing band in font units

def layout(s):
    """Right-to-left placement; returns (char, x_origin) and line width."""
    pen, placed = 0.0, []
    for ch in s:
        gd = G.get(ch)
        adv = gd["advance"] if gd else 300
        if adv == 0:                 # combining mark: overlay, no advance
            placed.append((ch, pen)); continue
        pen -= adv
        placed.append((ch, pen))
    return placed, -pen

s = PX_PER_EM / 1000.0
maxW = max(layout(l)[1] for l in LINES)
W = int(maxW * s) + 2 * PAD                  # right edge of every line aligns (RTL)
band = (EM_TOP - EM_BOT) * s
H = int(len(LINES) * band + (len(LINES) - 1) * LINE_GAP) + 2 * PAD
img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)

for i, line in enumerate(LINES):
    placed, lw = layout(line)
    base_y = PAD + i * (band + LINE_GAP) + EM_TOP * s
    for ch, ox in placed:                    # ox in [-lw, 0]; map so right edge -> maxW
        gd = G.get(ch)
        if not gd:
            continue
        for st in gd["strokes"]:
            if len(st) == 1:
                x, y = st[0]
                px, py = PAD + (maxW + ox + x) * s, base_y - y * s
                d.ellipse([px-2, py-2, px+2, py+2], fill="black")
            else:
                d.line([(PAD + (maxW + ox + x) * s, base_y - y * s) for x, y in st],
                       fill="black", width=2, joint="curve")

out = os.path.join(PROJ, "font", "sample.png")
img.save(out)
print("wrote", out, img.size)

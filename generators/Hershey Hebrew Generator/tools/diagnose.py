#!/usr/bin/env python3
"""Diagnostic overlay for problem glyphs: original outline (gray) + extracted
centerline (black) + endpoints (green) + junctions (blue). Reveals corner
pull-back and junction tangles at the connection points."""
import os, math, argparse
import numpy as np
import freetype
from skimage.morphology import skeletonize
from scipy.ndimage import distance_transform_edt
from PIL import Image, ImageDraw
import build_font as B

HERE = os.path.dirname(os.path.abspath(__file__))
CHARS = list("אבגדזמעצ14")
CELL, COLS, MARGIN = 340, 5, 26

ap = argparse.ArgumentParser()
ap.add_argument("--extend", type=float, default=B.EXTEND_FACTOR)
ap.add_argument("--out", default="diagnose.png")
A = ap.parse_args()

face = freetype.Face(os.path.join(HERE, "fonts", "MiriamLibre-Regular.ttf"))
face.set_pixel_sizes(0, B.EM_PX)

def glyph_data(ch):
    r = B.rasterize(face, ch)
    if r is None:
        return None
    buf, left, top = r
    binary = np.pad(buf >= B.THRESH, B.PAD)
    skel = skeletonize(binary)
    dist = distance_transform_edt(binary)
    rr, cc = np.where(skel)
    sw = float(2 * np.median(dist[rr, cc])) if len(rr) else 3.0
    S = B.prune(set(zip(rr.tolist(), cc.tolist())), max(B.PRUNE_FACTOR * sw, 3.0), B.PRUNE_PASSES)
    polys = B.trace(S)
    if A.extend > 0:
        polys = B.extend_endpoints(polys, S, binary, sw, A.extend)
    _, deg = B._degmap(S)
    ends = [p for p in S if deg[p] == 1]
    juncs = [p for p in S if deg[p] >= 3]
    return binary, polys, ends, juncs, sw

rows = math.ceil(len(CHARS) / COLS)
img = Image.new("RGB", (COLS * CELL, rows * CELL), "white")
d = ImageDraw.Draw(img)

for i, ch in enumerate(CHARS):
    gd = glyph_data(ch)
    cx, cy = (i % COLS) * CELL, (i // COLS) * CELL
    d.rectangle([cx, cy, cx + CELL - 1, cy + CELL - 1], outline=(225, 225, 225))
    if gd is None:
        continue
    binary, polys, ends, juncs, sw = gd
    H, W = binary.shape
    s = (CELL - 2 * MARGIN) / max(H, W)
    ox = cx + (CELL - W * s) / 2
    oy = cy + (CELL - H * s) / 2
    px = lambda c: ox + c * s
    py = lambda r: oy + r * s

    # gray filled glyph
    ys, xs = np.where(binary)
    for r, c in zip(ys.tolist(), xs.tolist()):
        d.rectangle([px(c), py(r), px(c) + s, py(r) + s], fill=(228, 230, 234))
    # extracted centerline (black)
    for pl in polys:
        if len(pl) == 1:
            r, c = pl[0]; d.ellipse([px(c)-3, py(r)-3, px(c)+3, py(r)+3], fill="black")
        else:
            d.line([(px(c), py(r)) for r, c in pl], fill=(15, 15, 15), width=3, joint="curve")
    # endpoints (green) + junctions (blue)
    for r, c in ends:
        d.ellipse([px(c)-6, py(r)-6, px(c)+6, py(r)+6], outline=(20, 170, 90), width=3)
    for r, c in juncs:
        d.ellipse([px(c)-7, py(r)-7, px(c)+7, py(r)+7], outline=(40, 110, 240), width=3)

out = os.path.join(os.path.dirname(HERE), "font", A.out)
img.save(out)
print("wrote", out, img.size, "| order:", " ".join(CHARS))

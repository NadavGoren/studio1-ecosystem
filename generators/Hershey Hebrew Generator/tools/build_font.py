#!/usr/bin/env python3
"""
Build a single-line (Hershey-style) Hebrew font from Miriam Libre's outlines.

Pipeline, per glyph:
  rasterize outline (freetype) -> binarize -> skeletonize (medial axis)
  -> trace skeleton into polylines (junctions / loops / disjoint parts)
  -> prune short corner spurs (relative to stroke width)
  -> simplify (Douglas-Peucker) -> map pixels to font units (y-up, baseline=0)

Outputs into ../font/:
  miriam-singleline.json   stroke data the generator consumes
  preview.png              raster QA sheet (read this to judge quality)
  preview.svg              vector QA sheet

No manual centerlines are drawn; everything here is automatic. The knobs at the
top (and the matching CLI flags) are the only things we tune.
"""
import os, json, math, argparse
import numpy as np
import freetype
from skimage.morphology import skeletonize
from scipy.ndimage import distance_transform_edt
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw
import svgwrite

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)

# ---- tunable parameters (overridable via CLI) -------------------------------
EM_PX         = 512    # raster resolution: pixels per em
PAD           = 6      # px padding so the skeleton never touches the border
THRESH        = 128    # ink threshold (0-255)
PRUNE_FACTOR  = 1.4    # spurs shorter than PRUNE_FACTOR * stroke_width are removed
PRUNE_PASSES  = 3
SIMPLIFY_TOL  = 6.0    # Douglas-Peucker tolerance, font units
EXTEND_FACTOR = 1.6    # push free endpoints out to the glyph edge, up to N*stroke_width (0=off)
DOT_FACTOR    = 2.0    # blobs with diag < DOT_FACTOR * stroke_width collapse to a dot
DOT_FLOOR     = 60.0   # ...but never below this many font units

N8 = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]


# ---- skeleton graph tracing -------------------------------------------------
def _neighbors(p, S):
    r, c = p
    return [(r+dr, c+dc) for dr, dc in N8 if (r+dr, c+dc) in S]

def _degmap(S):
    nb = {p: _neighbors(p, S) for p in S}
    return nb, {p: len(nb[p]) for p in S}

def _arclen(path):
    s = 0.0
    for i in range(1, len(path)):
        s += math.hypot(path[i][0]-path[i-1][0], path[i][1]-path[i-1][1])
    return s

def trace(S):
    """Decompose a set of skeleton pixels into polylines."""
    if not S:
        return []
    nb, deg = _degmap(S)
    nodes = {p for p in S if deg[p] != 2}      # endpoints + junctions
    polys, used = [], set()
    # edges anchored at nodes
    for n in nodes:
        for m in nb[n]:
            if (n, m) in used:
                continue
            used.add((n, m))
            path, prev, cur = [n], n, m
            while True:
                path.append(cur)
                if deg[cur] != 2:              # hit another node/endpoint
                    used.add((cur, prev))
                    break
                nxts = [q for q in nb[cur] if q != prev]
                if not nxts:
                    break
                prev, cur = cur, nxts[0]
            polys.append(path)
    # pure loops (no node anywhere on the cycle, e.g. closed counters of ם / ס)
    covered = set()
    for pl in polys:
        covered.update(pl)
    rem = {p for p in S if p not in covered}
    while rem:
        start = next(iter(rem)); rem.discard(start)
        loop, prev, cur = [start], None, start
        while True:
            nxt = None
            for q in nb[cur]:
                if q != prev and q in rem:
                    nxt = q; break
            if nxt is None:
                break
            loop.append(nxt); rem.discard(nxt); prev, cur = cur, nxt
        if len(loop) >= 3:
            loop.append(loop[0])               # close it
        polys.append(loop)
    return polys

def prune(S, thresh_px, passes):
    """Remove short dead-end spurs (skeletonization artifacts at corners)."""
    for _ in range(passes):
        polys = trace(S)
        _, deg = _degmap(S)
        remove = set()
        for pl in polys:
            a, b = pl[0], pl[-1]
            if a == b:                          # closed loop, keep
                continue
            da, db = deg.get(a, 0), deg.get(b, 0)
            leaf = (da == 1) != (db == 1)       # exactly one true endpoint
            if leaf and _arclen(pl) < thresh_px:
                junction = b if da == 1 else a
                for p in pl:
                    if p != junction:
                        remove.add(p)
        if not remove:
            break
        S = S - remove
    return S


def extend_endpoints(polys, S, binary, sw_px, factor):
    """Push each free (degree-1) endpoint outward along its tangent to the glyph
    edge, fixing the half-stroke-width pull-back at terminals and corners.
    Junction ends are left alone; ends facing into empty space don't move."""
    _, deg = _degmap(S)
    H, W = binary.shape
    maxlen = factor * sw_px
    k = max(3, int(round(sw_px * 0.8)))            # tangent lookback (~1 stroke width)

    def inside(y, x):
        iy, ix = int(round(y)), int(round(x))
        return 0 <= iy < H and 0 <= ix < W and binary[iy, ix]

    out = []
    for pl in polys:
        pl = list(pl); n = len(pl)
        if n >= 2:
            for which in (0, 1):
                end = pl[0] if which == 0 else pl[-1]
                if deg.get(end, 0) != 1:           # only genuine free terminals
                    continue
                ref = pl[min(k, n - 1)] if which == 0 else pl[max(0, n - 1 - k)]
                dy, dx = end[0] - ref[0], end[1] - ref[1]
                m = math.hypot(dy, dx)
                if m < 1e-6:
                    continue
                dy, dx = dy / m, dx / m
                ly, lx, dist = float(end[0]), float(end[1]), 0.0
                while dist < maxlen:
                    ny, nx = ly + dy * 0.5, lx + dx * 0.5
                    if not inside(ny, nx):
                        break
                    ly, lx, dist = ny, nx, dist + 0.5
                if dist >= 1.0:
                    pl.insert(0, (ly, lx)) if which == 0 else pl.append((ly, lx))
        out.append(pl)
    return out


# ---- per-glyph extraction ---------------------------------------------------
def rasterize(face, ch):
    face.load_char(ch, freetype.FT_LOAD_RENDER)
    g = face.glyph; bmp = g.bitmap
    if bmp.rows == 0 or bmp.width == 0:
        return None
    buf = np.array(bmp.buffer, dtype=np.uint8).reshape(bmp.rows, bmp.pitch)[:, :bmp.width]
    return buf, g.bitmap_left, g.bitmap_top

def extract_glyph(face, ch, scale):
    r = rasterize(face, ch)
    if r is None:
        return [], 0.0
    buf, left, top = r
    binary = np.pad(buf >= THRESH, PAD)
    skel = skeletonize(binary)
    if not skel.any():
        return [], 0.0
    dist = distance_transform_edt(binary)
    rr, cc = np.where(skel)
    sw_px = float(2 * np.median(dist[rr, cc]))
    S = set(zip(rr.tolist(), cc.tolist()))
    S = prune(S, max(PRUNE_FACTOR * sw_px, 3.0), PRUNE_PASSES)
    polys = trace(S)
    if EXTEND_FACTOR > 0:
        polys = extend_endpoints(polys, S, binary, sw_px, EXTEND_FACTOR)

    def to_fu(p):                               # pixel -> font units, y-up, baseline=0
        pr, pc = p
        return ((left + (pc - PAD) + 0.5) / scale,
                (top  - (pr - PAD) - 0.5) / scale)

    return [[to_fu(p) for p in pl] for pl in polys], sw_px / scale

def clean_glyph(strokes):
    """Clean-monoline pass: drop serif-dot remnants on letters/digits.
    Niqqud & punctuation (all-short glyphs) are left untouched so their dots survive."""
    def L(st):
        return 0.0 if len(st) < 2 else sum(
            math.hypot(st[i][0]-st[i-1][0], st[i][1]-st[i-1][1]) for i in range(1, len(st)))
    if max((L(st) for st in strokes), default=0) < 200:   # niqqud / punctuation
        return strokes
    return [st for st in strokes if len(st) >= 2 and L(st) >= 45]


def simplify_strokes(strokes, sw_fu):
    from shapely.geometry import LineString
    dot_thresh = max(DOT_FACTOR * sw_fu, DOT_FLOOR)
    out = []
    for pts in strokes:
        if not pts:
            continue
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        diag = math.hypot(max(xs) - min(xs), max(ys) - min(ys))
        if diag < dot_thresh:                   # niqqud dot / tiny blob -> single dab
            out.append([(round(sum(xs)/len(xs), 1), round(sum(ys)/len(ys), 1))])
            continue
        if len(pts) < 2:
            out.append([(round(xs[0], 1), round(ys[0], 1))])
            continue
        sp = [(round(x, 1), round(y, 1))
              for x, y in LineString(pts).simplify(SIMPLIFY_TOL, preserve_topology=False).coords]
        if len(sp) >= 2:
            out.append(sp)
    return out


# ---- character set ----------------------------------------------------------
def build_charset(cmap):
    cps = list(range(0x05D0, 0x05EB))                                   # letters + finals
    cps += [c for c in list(range(0x05B0, 0x05BE)) + [0x05BF, 0x05C1, 0x05C2, 0x05C7]]  # niqqud
    cps += [0x05BE, 0x05F3, 0x05F4]                                     # maqaf, geresh, gershayim
    cps += list(range(0x30, 0x3A))                                      # digits
    cps += [0x20, 0x2E, 0x2C, 0x21, 0x3F, 0x3A, 0x3B, 0x27, 0x22, 0x2D, 0x28, 0x29]  # space + punct
    seen, out = set(), []
    for cp in cps:
        if cp in seen or cp not in cmap:
            continue
        seen.add(cp); out.append(cp)
    return out


# ---- previews ---------------------------------------------------------------
def _layout(glyphs, cell, cols):
    items = list(glyphs.items())
    rows = math.ceil(len(items) / cols)
    return items, rows, cols * cell, rows * cell

def render_png(glyphs, path, cell=150, cols=10):
    items, rows, W, H = _layout(glyphs, cell, cols)
    img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
    s = cell * 0.66 / 1000.0
    for i, (ch, gd) in enumerate(items):
        cx, cy = (i % cols) * cell, (i // cols) * cell
        baseY = cy + cell * 0.78
        adv = gd["advance"] or 500
        ox = cx + (cell - adv * s) / 2
        d.rectangle([cx+1, cy+1, cx+cell-1, cy+cell-1], outline=(232, 232, 232))
        d.line([cx+6, baseY, cx+cell-6, baseY], fill=(224, 224, 240))
        for st in gd["strokes"]:
            if len(st) == 1:
                x, y = st[0]; px, py = ox + x*s, baseY - y*s
                d.ellipse([px-2.5, py-2.5, px+2.5, py+2.5], fill="black")
            else:
                d.line([(ox + x*s, baseY - y*s) for x, y in st], fill="black", width=2, joint="curve")
    img.save(path)

def render_svg(glyphs, path, cell=150, cols=10):
    items, rows, W, H = _layout(glyphs, cell, cols)
    dwg = svgwrite.Drawing(path, size=(W, H), viewBox=f"0 0 {W} {H}")
    dwg.add(dwg.rect((0, 0), (W, H), fill="white"))
    s = cell * 0.66 / 1000.0
    for i, (ch, gd) in enumerate(items):
        cx, cy = (i % cols) * cell, (i // cols) * cell
        baseY = cy + cell * 0.78
        adv = gd["advance"] or 500
        ox = cx + (cell - adv * s) / 2
        dwg.add(dwg.rect((cx+1, cy+1), (cell-2, cell-2), fill="none", stroke="#eaeaea"))
        for st in gd["strokes"]:
            if len(st) == 1:
                x, y = st[0]
                dwg.add(dwg.circle((ox + x*s, baseY - y*s), 1.6, fill="black"))
            else:
                pts = [(ox + x*s, baseY - y*s) for x, y in st]
                dwg.add(dwg.polyline(pts, fill="none", stroke="black",
                                     stroke_width=1.4, stroke_linecap="round", stroke_linejoin="round"))
    dwg.save()


# ---- main -------------------------------------------------------------------
def main():
    global EM_PX, PRUNE_FACTOR, SIMPLIFY_TOL, EXTEND_FACTOR
    ap = argparse.ArgumentParser()
    ap.add_argument("--weight", default="Regular", choices=["Regular", "Medium", "SemiBold"])
    ap.add_argument("--empx", type=int, default=EM_PX)
    ap.add_argument("--prune", type=float, default=PRUNE_FACTOR)
    ap.add_argument("--simplify", type=float, default=SIMPLIFY_TOL)
    ap.add_argument("--clean", action="store_true", help="strip serif-dot remnants on letters")
    ap.add_argument("--extend", type=float, default=EXTEND_FACTOR, help="endpoint extension factor (0=off)")
    ap.add_argument("--suffix", default="")
    a = ap.parse_args()

    EM_PX, PRUNE_FACTOR, SIMPLIFY_TOL, EXTEND_FACTOR = a.empx, a.prune, a.simplify, a.extend

    ttf = os.path.join(HERE, "fonts", f"MiriamLibre-{a.weight}.ttf")
    tt = TTFont(ttf)
    upm = tt["head"].unitsPerEm
    cmap = tt.getBestCmap(); hmtx = tt["hmtx"]
    asc, desc = tt["hhea"].ascent, tt["hhea"].descent

    face = freetype.Face(ttf); face.set_pixel_sizes(0, EM_PX)
    scale = EM_PX / upm

    glyphs = {}
    for cp in build_charset(cmap):
        ch = chr(cp); gname = cmap[cp]; adv = hmtx[gname][0]
        if cp == 0x20:
            glyphs[ch] = {"cp": f"{cp:04X}", "advance": adv, "strokes": []}
            continue
        strokes, sw = extract_glyph(face, ch, scale)
        strokes = simplify_strokes(strokes, sw)
        strokes = [[[x, y] for x, y in st] for st in strokes]
        if a.clean:
            strokes = clean_glyph(strokes)
        glyphs[ch] = {"cp": f"{cp:04X}", "advance": adv, "strokes": strokes}

    data = {"source": f"Miriam Libre {a.weight}", "variant": "clean" if a.clean else "faithful",
            "unitsPerEm": upm, "ascent": asc, "descent": desc, "direction": "rtl",
            "params": {"EM_PX": EM_PX, "PRUNE_FACTOR": PRUNE_FACTOR, "SIMPLIFY_TOL": SIMPLIFY_TOL},
            "glyphs": glyphs}

    os.makedirs(os.path.join(PROJ, "font"), exist_ok=True)
    out_json = os.path.join(PROJ, "font", f"miriam-singleline{a.suffix}.json")
    with open(out_json, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    render_png(glyphs, os.path.join(PROJ, "font", f"preview{a.suffix}.png"))
    render_svg(glyphs, os.path.join(PROJ, "font", f"preview{a.suffix}.svg"))

    nstrokes = sum(len(g["strokes"]) for g in glyphs.values())
    print(f"weight={a.weight} empx={EM_PX} prune={PRUNE_FACTOR} simplify={SIMPLIFY_TOL}")
    print(f"glyphs={len(glyphs)} total_strokes={nstrokes}")
    print(f"wrote {out_json}")


if __name__ == "__main__":
    main()

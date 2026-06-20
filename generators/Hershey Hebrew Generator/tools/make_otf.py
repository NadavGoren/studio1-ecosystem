#!/usr/bin/env python3
"""Build an installable TTF from the single-line strokes.

A font fills closed shapes, so each open centerline stroke is given a thin width
(shapely buffer) -> a hairline outline that looks single-line. Great for typing /
design in Illustrator; for plotting use the generator's true single-line SVG.

  python3 make_otf.py [--variant clean|faithful] [--pen 22] [--name "Studio1 SingleLine"]
"""
import os, json, argparse, math
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from shapely.geometry import LineString, Point
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)


def load_glyphs(variant):
    fn = "miriam-singleline-clean.json" if variant == "clean" else "miriam-singleline.json"
    with open(os.path.join(PROJ, "font", fn), encoding="utf-8") as f:
        data = json.load(f)
    glyphs = data["glyphs"]
    ovp = os.path.join(PROJ, "font", "overrides.json")           # bake hand-edits
    if os.path.exists(ovp):
        with open(ovp, encoding="utf-8") as f:
            ov = json.load(f)
        for ch, gd in ov.items():
            if ch in glyphs:
                glyphs[ch]["strokes"] = gd["strokes"]
                if gd.get("advance") is not None:
                    glyphs[ch]["advance"] = gd["advance"]
        print(f"baked {len(ov)} override(s)")
    return data, glyphs


def dedupe(pts):
    out = []
    for p in pts:
        if not out or abs(p[0] - out[-1][0]) > 1e-6 or abs(p[1] - out[-1][1]) > 1e-6:
            out.append((p[0], p[1]))
    return out


def outline(strokes, w):
    geoms = []
    for st in strokes:
        pts = dedupe(st)
        if len(pts) == 1:
            geoms.append(Point(pts[0]).buffer(w / 2.0, quad_segs=8))
        elif len(pts) >= 2:
            geoms.append(LineString(pts).buffer(w / 2.0, cap_style=1, join_style=1, quad_segs=8))
    return unary_union(geoms) if geoms else None


def rings(geom):
    if geom is None or geom.is_empty:
        return []
    polys = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
    out = []
    for p in polys:
        if p.is_empty:
            continue
        out.append(list(p.exterior.coords))
        out.extend(list(h.coords) for h in p.interiors)
    return out


def stroke_contours(strokes):
    """Single-line 'there-and-back' contours: each open stroke is traced forward
    then back so the font's mandatory closing has zero offset. Create Outlines in
    Illustrator then yields a single line (no parallel double), drawn retraced."""
    out = []
    for st in strokes:
        pts = dedupe(st)
        if len(pts) == 1:                                  # niqqud dab -> tiny diamond
            x, y = pts[0]; r = 7
            out.append([(x, y - r), (x + r, y), (x, y + r), (x - r, y)])
        elif len(pts) >= 2:
            out.append(pts + pts[-2:0:-1])                 # forward + reversed middle
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", default="clean", choices=["clean", "faithful"])
    ap.add_argument("--mode", default="outline", choices=["outline", "stroke"],
                    help="outline = filled hairline (visible); stroke = single-line retrace for Create Outlines")
    ap.add_argument("--pen", type=float, default=22.0, help="outline mode: stroke thickness, font units")
    ap.add_argument("--name", default=None)
    a = ap.parse_args()
    FAMILY = a.name or ("Studio1 SingleLine Stroke" if a.mode == "stroke" else "Studio1 SingleLine")

    data, glyphs = load_glyphs(a.variant)
    upm, asc, desc = data["unitsPerEm"], int(data["ascent"]), int(data["descent"])

    order, cmap, glyf, metrics = [".notdef"], {}, {}, {}
    pen = TTGlyphPen(None)                                        # .notdef: a box
    box = [(60, 0), (440, 0), (440, 680), (60, 680)]
    pen.moveTo(box[0]); [pen.lineTo(p) for p in box[1:]]; pen.closePath()
    glyf[".notdef"] = pen.glyph(); metrics[".notdef"] = (500, 60)

    for ch, gd in glyphs.items():
        cp = ord(ch); name = "uni%04X" % cp
        order.append(name); cmap[cp] = name
        pen = TTGlyphPen(None); xs = []
        contours = stroke_contours(gd["strokes"]) if a.mode == "stroke" \
            else rings(outline(gd["strokes"], a.pen))
        for ring in contours:
            pts = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring
            pts = [(int(round(x)), int(round(y))) for x, y in pts]
            if len(pts) < 3:
                continue
            pen.moveTo(pts[0])
            for q in pts[1:]:
                pen.lineTo(q)
            pen.closePath()
            xs += [q[0] for q in pts]
        glyf[name] = pen.glyph()
        metrics[name] = (int(gd["advance"]), min(xs) if xs else 0)

    fb = FontBuilder(upm, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyf)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=asc, descent=desc)
    ps = FAMILY.replace(" ", "") + "-Regular"
    fb.setupNameTable({
        "familyName": FAMILY, "styleName": "Regular",
        "uniqueFontIdentifier": f"{FAMILY} Regular; 1.0",
        "fullName": f"{FAMILY} Regular", "psName": ps, "version": "1.0",
        "manufacturer": "Studio 1", "designer": "derived from Miriam Libre (OFL)",
    })
    fb.setupOS2(sTypoAscender=asc, sTypoDescender=desc, sTypoLineGap=0,
                usWinAscent=asc, usWinDescent=abs(desc),
                ulUnicodeRange1=(1 << 0) | (1 << 11),               # Basic Latin + Hebrew
                ulCodePageRange1=(1 << 0) | (1 << 5))               # Latin1 + Hebrew
    fb.setupPost()

    out = os.path.join(PROJ, "font", ps + ".ttf")
    fb.save(out)
    print(f"wrote {out}  ({len(glyphs)} glyphs, mode={a.mode}, variant={a.variant})")
    return out


if __name__ == "__main__":
    main()

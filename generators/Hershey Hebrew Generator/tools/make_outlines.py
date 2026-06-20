#!/usr/bin/env python3
"""Export each glyph's filled outline (flattened to polygons) as outlines.js,
so the glyph editor can show Miriam Libre's real shape under the centerline.
Coordinates match the stroke data: font units, y-up, baseline=0."""
import os, json
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
import build_font as B

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)

class FlattenPen(BasePen):
    def __init__(self, glyphSet, steps=6):
        super().__init__(glyphSet); self.contours = []; self.steps = steps
    def _moveTo(self, p): self.contours.append([(p[0], p[1])])
    def _lineTo(self, p): self.contours[-1].append((p[0], p[1]))
    def _curveToOne(self, p1, p2, p3):
        p0 = self.contours[-1][-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps; m = 1 - t
            self.contours[-1].append((
                m*m*m*p0[0] + 3*m*m*t*p1[0] + 3*m*t*t*p2[0] + t*t*t*p3[0],
                m*m*m*p0[1] + 3*m*m*t*p1[1] + 3*m*t*t*p2[1] + t*t*t*p3[1]))
    def _qCurveToOne(self, p1, p2):
        p0 = self.contours[-1][-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps; m = 1 - t
            self.contours[-1].append((
                m*m*p0[0] + 2*m*t*p1[0] + t*t*p2[0],
                m*m*p0[1] + 2*m*t*p1[1] + t*t*p2[1]))
    def _closePath(self):
        c = self.contours[-1]
        if len(c) > 1 and c[0] != c[-1]:
            c.append(c[0])

ttf = os.path.join(HERE, "fonts", "MiriamLibre-Regular.ttf")
tt = TTFont(ttf); gs = tt.getGlyphSet(); cmap = tt.getBestCmap()

out = {}
for cp in B.build_charset(cmap):
    pen = FlattenPen(gs)
    try:
        gs[cmap[cp]].draw(pen)
    except Exception:
        pass
    out[chr(cp)] = [[[round(x, 1), round(y, 1)] for x, y in c] for c in pen.contours]

dst = os.path.join(PROJ, "outlines.js")
with open(dst, "w", encoding="utf-8") as f:
    f.write("window.HEBREW_OUTLINES = " + json.dumps(out, ensure_ascii=False) + ";\n")
print("wrote", dst, os.path.getsize(dst), "bytes |",
      "sample contours:", {c: len(out[c]) for c in ["א", "ב", "ם", "ש"] if c in out})

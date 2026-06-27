/* modes.js — the four composition languages. Each takes the drawing
   `area` (inner rect, already inset by the margin) and a `ctx`, and
   returns an array of {color, d} strokes. */
(function () {
  window.MOD = window.MOD || {};
  const G = MOD.geom;
  const apply = MOD.applyPattern;
  const PATTERN_SET = MOD.PATTERN_SET;

  // ---------------------------------------------------------------------------
  // 1) MODULAR PACK — recursive rectangular subdivision (BSP), each leaf cell
  //    filled with a random stroke pattern. The signature riso-print look.
  // ---------------------------------------------------------------------------
  function snapCut(value, origin, unit, lo, hi, minSize) {
    let cut = origin + Math.round((value - origin) / unit) * unit;
    if (cut - lo < minSize) cut = lo + minSize;
    if (hi - cut < minSize) cut = hi - minSize;
    return cut;
  }

  function subdivide(area, ctx) {
    const rh = ctx.rh, p = ctx.params;
    let leaves = [{ ...area }];
    let guard = 0;
    while (leaves.length < p.cells && guard++ < 4000) {
      const cand = leaves.filter((r) => Math.min(r.w, r.h) >= p.minCell * 2);
      if (!cand.length) break;
      cand.sort((a, b) => b.w * b.h - a.w * a.h);
      const r = cand[rh.int(0, Math.min(2, cand.length - 1))]; // bias to larger
      const idx = leaves.indexOf(r);
      const vert = r.w > r.h ? true : r.h > r.w ? false : rh.chance(0.5);
      const ratio = rh.range(0.35, 0.65);
      if (vert) {
        const cut = snapCut(r.x + r.w * ratio, area.x, p.snap, r.x, r.x + r.w, p.minCell);
        leaves.splice(idx, 1,
          { x: r.x, y: r.y, w: cut - r.x, h: r.h },
          { x: cut, y: r.y, w: r.x + r.w - cut, h: r.h });
      } else {
        const cut = snapCut(r.y + r.h * ratio, area.y, p.snap, r.y, r.y + r.h, p.minCell);
        leaves.splice(idx, 1,
          { x: r.x, y: r.y, w: r.w, h: cut - r.y },
          { x: r.x, y: cut, w: r.w, h: r.y + r.h - cut });
      }
    }
    return leaves;
  }

  function modular(area, ctx) {
    const rh = ctx.rh, p = ctx.params;
    const cells = subdivide(area, ctx);
    const strokes = [];
    for (const cell of cells) {
      if (rh.chance(p.blank)) continue; // leave bare paper for breathing room
      const color = rh.pick(ctx.colors);
      const pat = rh.pick(PATTERN_SET);
      strokes.push(...apply(pat, G.inset(cell, 0.4), color, ctx));
    }
    return strokes;
  }

  // ---------------------------------------------------------------------------
  // 2) MOTIF GRID — a repeating small motif tiled on a grid, sprinkled with
  //    solid accent squares. Quilt / cross-stitch feel.
  // ---------------------------------------------------------------------------
  function motifShape(kind, rect, color, ctx) {
    const ds = [];
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    const R = Math.min(rect.w, rect.h);
    const sp = Math.max(0.6, ctx.strokeW * 1.7);
    if (kind === 'plus') {
      const n = 3, cw = rect.w / n, ch = rect.h / n;
      const gap = Math.min(cw, ch) * 0.14;
      for (const [i, j] of [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]) {
        const sub = { x: rect.x + i * cw + gap, y: rect.y + j * ch + gap, w: cw - 2 * gap, h: ch - 2 * gap };
        for (const d of G.fillRect(sub, 0, sp)) ds.push(d);
      }
    } else if (kind === 'ring') {
      ds.push(G.circleD(cx, cy, R * 0.34));
    } else if (kind === 'diamond') {
      const r = R * 0.4;
      ds.push(`M${G.f(cx)},${G.f(cy - r)} L${G.f(cx + r)},${G.f(cy)} L${G.f(cx)},${G.f(cy + r)} L${G.f(cx - r)},${G.f(cy)} Z`);
    } else if (kind === 'x') {
      const r = R * 0.32;
      ds.push(G.lineD(cx - r, cy - r, cx + r, cy + r));
      ds.push(G.lineD(cx - r, cy + r, cx + r, cy - r));
    } else if (kind === 'dot') {
      const sub = G.inset(rect, R * 0.34);
      for (const d of G.fillRect(sub, 0, sp)) ds.push(d);
    } else {
      ds.push(G.rectD(rect.x + R * 0.28, rect.y + R * 0.28, rect.w - R * 0.56, rect.h - R * 0.56));
    }
    return ds.map((d) => ({ color, d }));
  }

  function motif(area, ctx) {
    const rh = ctx.rh, p = ctx.params;
    const cell = p.cell;
    const cols = Math.max(1, Math.floor(area.w / cell));
    const rows = Math.max(1, Math.floor(area.h / cell));
    const ox = area.x + (area.w - cols * cell) / 2;
    const oy = area.y + (area.h - rows * cell) / 2;
    const base = ctx.base;
    const strokes = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const rect = { x: ox + i * cell, y: oy + j * cell, w: cell, h: cell };
        if (rh.chance(p.accent)) {
          const col = rh.pick(ctx.colors);
          strokes.push(...apply('solid', G.inset(rect, cell * 0.18), col, ctx));
        } else if (rh.chance(p.blank)) {
          // bare cell
        } else {
          strokes.push(...motifShape(p.motif, rect, base, ctx));
        }
      }
    return strokes;
  }

  // ---------------------------------------------------------------------------
  // 3) PIXEL FIELD — fine grid coloured by value-noise + accent scatter.
  // ---------------------------------------------------------------------------
  function makeValueNoise(cols, rows, rh, scale) {
    const gw = Math.max(2, Math.ceil(cols / scale) + 2);
    const gh = Math.max(2, Math.ceil(rows / scale) + 2);
    const grid = [];
    for (let j = 0; j < gh; j++) {
      const r = [];
      for (let i = 0; i < gw; i++) r.push(rh.next());
      grid.push(r);
    }
    return function (i, j) {
      const gx = i / scale, gy = j / scale;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const x1 = Math.min(x0 + 1, gw - 1), y1 = Math.min(y0 + 1, gh - 1);
      const fx = gx - x0, fy = gy - y0;
      const a = grid[y0][x0], b = grid[y0][x1], c = grid[y1][x0], d = grid[y1][x1];
      const top = a + (b - a) * fx, bot = c + (d - c) * fx;
      return top + (bot - top) * fy;
    };
  }

  function pixel(area, ctx) {
    const rh = ctx.rh, p = ctx.params;
    const cell = p.cell;
    const cols = Math.max(1, Math.floor(area.w / cell));
    const rows = Math.max(1, Math.floor(area.h / cell));
    const ox = area.x + (area.w - cols * cell) / 2;
    const oy = area.y + (area.h - rows * cell) / 2;
    const noise = makeValueNoise(cols, rows, rh, p.noiseScale);
    const base = ctx.base;
    const sp = Math.max(ctx.strokeW * 1.7, cell * 0.24);
    const strokes = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        let col = null;
        if (noise(i, j) > 1 - p.fill) col = base;     // organic base field
        if (rh.chance(p.accent)) col = rh.pick(ctx.colors); // speckle accents
        if (!col) continue;
        const sub = G.inset({ x: ox + i * cell, y: oy + j * cell, w: cell, h: cell }, cell * 0.12);
        for (const d of G.fillRect(sub, 0, sp)) strokes.push({ color: col, d });
      }
    return strokes;
  }

  // ---------------------------------------------------------------------------
  // 4) GRID COMPOSITION — visible graph grid + checker fields + bold crossing
  //    bars + thin accent lines. Bauhaus feel.
  // ---------------------------------------------------------------------------
  function grid(area, ctx) {
    const rh = ctx.rh, p = ctx.params;
    const cell = p.cell;
    const cols = Math.max(2, Math.floor(area.w / cell));
    const rows = Math.max(2, Math.floor(area.h / cell));
    const ox = area.x + (area.w - cols * cell) / 2;
    const oy = area.y + (area.h - rows * cell) / 2;
    const W = cols * cell, H = rows * cell;
    const strokes = [];

    // one slider controls the line spacing inside every filled cell / bar
    const fillSp = Math.max(0.4, p.fillSpacing != null ? p.fillSpacing : 1.2);
    ctx.solidSpacing = fillSp;

    // 1) base graph grid
    const gridColor = ctx.resolvePen(p.gridLineColor);
    for (let i = 0; i <= cols; i++)
      strokes.push({ color: gridColor, d: G.lineD(ox + i * cell, oy, ox + i * cell, oy + H) });
    for (let j = 0; j <= rows; j++)
      strokes.push({ color: gridColor, d: G.lineD(ox, oy + j * cell, ox + W, oy + j * cell) });

    const cellRect = (ci, cj, cw, ch) => ({ x: ox + ci * cell, y: oy + cj * cell, w: cw * cell, h: ch * cell });

    // Overlap of two cell-rects as a fraction of the smaller one's area. Each
    // obstacle can be inflated by `gap` empty cells to force breathing room
    // (used both for field-vs-field spacing and bar-vs-field clearance).
    const overlapFrac = (a, b, gap) => {
      const ix = Math.max(0, Math.min(a.ci + a.cw, b.ci + b.cw + gap) - Math.max(a.ci, b.ci - gap));
      const iy = Math.max(0, Math.min(a.cj + a.ch, b.cj + b.ch + gap) - Math.max(a.cj, b.cj - gap));
      const minA = Math.min(a.cw * a.ch, b.cw * b.ch) || 1;
      return (ix * iy) / minA;
    };

    // The set of already-placed checker fields that later elements (more
    // fields, then bars) must keep clear of.
    const placed = [];

    // 2) checker fields — count, size and colour are user-controlled. The
    //    "Field overlap" value is a HARD ceiling on how much a field may
    //    overprint the fields already placed: 0 = never overlap (a 1-cell
    //    breathing gap is kept) → composed; 1 = may land anywhere → busy. A
    //    field that can't fit is shrunk, then skipped if there's still no room,
    //    so at low overlap the field count is a maximum.
    const fSize = p.fieldSize != null ? p.fieldSize : 10;
    const spread = Math.max(2, Math.round(fSize * 0.28));
    const fLo = Math.max(2, fSize - spread), fHi = fSize + spread;
    const budget = p.fieldOverlap != null ? p.fieldOverlap : 0.3;
    const fieldGap = budget <= 0 ? 1 : 0;
    const fits = (cand) => {
      for (const q of placed) if (overlapFrac(cand, q, fieldGap) > budget) return false;
      return true;
    };
    for (let fld = 0; fld < p.fields; fld++) {
      let cw = Math.min(cols, rh.int(fLo, fHi));
      let ch = Math.min(rows, rh.int(fLo, fHi));
      let field = null;
      for (let attempt = 0; attempt < 3 && !field; attempt++) {
        for (let t = 0; t < 40; t++) {
          const cand = { ci: rh.int(0, Math.max(0, cols - cw)), cj: rh.int(0, Math.max(0, rows - ch)), cw, ch };
          if (fits(cand)) { field = cand; break; }
        }
        if (!field) { cw = Math.max(fLo, Math.round(cw * 0.7)); ch = Math.max(fLo, Math.round(ch * 0.7)); }
      }
      if (!field) continue; // no room within the overlap budget — skip this field
      placed.push(field);
      const col = ctx.resolvePen(p.fieldColor);
      for (let j = 0; j < field.ch; j++)
        for (let i = 0; i < field.cw; i++)
          if ((i + j) % 2 === 0) {
            const sub = { x: ox + (field.ci + i) * cell, y: oy + (field.cj + j) * cell, w: cell, h: cell };
            for (const d of G.fillRect(G.inset(sub, cell * 0.04), 0, fillSp)) strokes.push({ color: col, d });
          }
    }

    // 3) bold crossing bars (thick rects, filled solid). "Bar–field gap" > 0
    //    turns on no-intersect mode: every bar keeps at least that many empty
    //    cells from each checker field, so they never overprint. At 0 bars
    //    place freely and may cross fields as before.
    const clearance = Math.max(0, p.barClearance != null ? p.barClearance : 0);
    const obstacles = clearance > 0 ? placed : []; // placed = all checker fields
    const barThick = Math.max(1, p.barThick);
    const barIsClear = (rect) => {
      for (const o of obstacles) if (overlapFrac(rect, o, clearance) > 0) return false;
      return true;
    };
    for (let b = 0; b < p.bars; b++) {
      const col = ctx.resolvePen(p.barColor);
      const horiz = rh.chance(0.5);
      let rect = null;
      for (let t = 0; t < 40; t++) {
        if (horiz) {
          const len = rh.int(Math.floor(cols * 0.4), cols);
          rect = { ci: rh.int(0, Math.max(0, cols - len)), cj: rh.int(0, Math.max(0, rows - barThick)), cw: len, ch: barThick };
        } else {
          const len = rh.int(Math.floor(rows * 0.4), rows);
          rect = { ci: rh.int(0, Math.max(0, cols - barThick)), cj: rh.int(0, Math.max(0, rows - len)), cw: barThick, ch: len };
        }
        if (clearance <= 0 || barIsClear(rect)) break;
        rect = null; // too close to a field — try another spot, else skip this bar
      }
      if (rect) strokes.push(...apply('solid', cellRect(rect.ci, rect.cj, rect.cw, rect.ch), col, ctx));
    }

    // 4) thin accent lines spanning the grid
    for (let a = 0; a < p.accentLines; a++) {
      const col = ctx.resolvePen(p.accentColor);
      if (rh.chance(0.5)) {
        const cj = rh.int(0, rows);
        strokes.push({ color: col, d: G.lineD(ox, oy + cj * cell, ox + W, oy + cj * cell) });
      } else {
        const ci = rh.int(0, cols);
        strokes.push({ color: col, d: G.lineD(ox + ci * cell, oy, ox + ci * cell, oy + H) });
      }
    }

    return strokes;
  }

  MOD.Modes = { modular, motif, pixel, grid };
})();

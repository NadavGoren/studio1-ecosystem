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
  // 4) GRID COMPOSITION — visible graph grid + checker fields + a solid block
  //    + bold crossing bars + thin accent lines. Bauhaus feel.
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

    // one slider controls the line spacing inside every filled cell / bar / block
    const fillSp = Math.max(0.4, p.fillSpacing != null ? p.fillSpacing : 1.2);
    ctx.solidSpacing = fillSp;

    // 1) base graph grid
    const gridColor = ctx.resolvePen(p.gridLineColor);
    for (let i = 0; i <= cols; i++)
      strokes.push({ color: gridColor, d: G.lineD(ox + i * cell, oy, ox + i * cell, oy + H) });
    for (let j = 0; j <= rows; j++)
      strokes.push({ color: gridColor, d: G.lineD(ox, oy + j * cell, ox + W, oy + j * cell) });

    const cellRect = (ci, cj, cw, ch) => ({ x: ox + ci * cell, y: oy + cj * cell, w: cw * cell, h: ch * cell });

    // 2) checker fields — count, size and colour are all user-controlled
    const fSize = p.fieldSize != null ? p.fieldSize : 9;
    const fLo = Math.max(2, fSize - 4), fHi = fSize + 4;
    for (let fld = 0; fld < p.fields; fld++) {
      const cw = Math.min(cols, rh.int(fLo, fHi));
      const ch = Math.min(rows, rh.int(fLo, fHi));
      const ci = rh.int(0, Math.max(0, cols - cw));
      const cj = rh.int(0, Math.max(0, rows - ch));
      const col = ctx.resolvePen(p.fieldColor);
      for (let j = 0; j < ch; j++)
        for (let i = 0; i < cw; i++)
          if ((i + j) % 2 === 0) {
            const sub = { x: ox + (ci + i) * cell, y: oy + (cj + j) * cell, w: cell, h: cell };
            for (const d of G.fillRect(G.inset(sub, cell * 0.04), 0, fillSp)) strokes.push({ color: col, d });
          }
    }

    // 3) a solid block
    if (p.solidBlock) {
      const bw = rh.int(6, Math.min(14, cols));
      const bh = rh.int(6, Math.min(16, rows));
      const ci = rh.int(0, Math.max(0, cols - bw));
      const cj = rh.int(0, Math.max(0, rows - bh));
      strokes.push(...apply('solid', cellRect(ci, cj, bw, bh), ctx.resolvePen(p.fieldColor), ctx));
    }

    // 4) bold crossing bars (thick rects, filled solid)
    for (let b = 0; b < p.bars; b++) {
      const thick = Math.max(1, p.barThick) * cell;
      const col = ctx.resolvePen(p.barColor);
      if (rh.chance(0.5)) {
        const len = rh.int(Math.floor(cols * 0.4), cols);
        const ci = rh.int(0, Math.max(0, cols - len));
        const cj = rh.int(0, Math.max(0, rows - 1));
        strokes.push(...apply('solid', { x: ox + ci * cell, y: oy + cj * cell, w: len * cell, h: thick }, col, ctx));
      } else {
        const len = rh.int(Math.floor(rows * 0.4), rows);
        const cj = rh.int(0, Math.max(0, rows - len));
        const ci = rh.int(0, Math.max(0, cols - 1));
        strokes.push(...apply('solid', { x: ox + ci * cell, y: oy + cj * cell, w: thick, h: len * cell }, col, ctx));
      }
    }

    // 5) thin accent lines spanning the grid
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

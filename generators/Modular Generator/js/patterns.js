/* patterns.js — low-level stroke geometry + the pattern "fills".
   Everything here returns plain SVG path-`d` strings (no colour, no fill);
   the composition modes pair geometry with a pen colour. All output is
   stroke-only so it plots cleanly with a single 0.4 mm pen. */
(function () {
  window.MOD = window.MOD || {};

  // ---- number / path helpers ------------------------------------------------
  const f = (n) => {
    n = Math.round(n * 100) / 100;
    return n === 0 ? 0 : n; // avoid "-0"
  };
  const lineD = (x1, y1, x2, y2) =>
    `M${f(x1)},${f(y1)} L${f(x2)},${f(y2)}`;
  const rectD = (x, y, w, h) =>
    `M${f(x)},${f(y)} L${f(x + w)},${f(y)} L${f(x + w)},${f(y + h)} L${f(x)},${f(y + h)} Z`;
  const circleD = (cx, cy, r) =>
    `M${f(cx - r)},${f(cy)} a${f(r)},${f(r)} 0 1,0 ${f(2 * r)},0 a${f(r)},${f(r)} 0 1,0 ${f(-2 * r)},0`;
  const inset = (r, d) => ({ x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d });

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function lum(hex) {
    const [r, g, b] = hexToRgb(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // ---- Liang–Barsky segment clip against an axis-aligned rect ---------------
  function clipLiangBarsky(x0, y0, x1, y1, xmin, ymin, xmax, ymax) {
    let t0 = 0, t1 = 1;
    const dx = x1 - x0, dy = y1 - y0;
    const p = [-dx, dx, -dy, dy];
    const q = [x0 - xmin, xmax - x0, y0 - ymin, ymax - y0];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return null;
      } else {
        const r = q[i] / p[i];
        if (p[i] < 0) {
          if (r > t1) return null;
          if (r > t0) t0 = r;
        } else {
          if (r < t0) return null;
          if (r < t1) t1 = r;
        }
      }
    }
    return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
  }

  // Parallel hatch lines at `angleDeg`, spaced `spacing`, clipped to rect.
  function hatchLines(rect, angleDeg, spacing) {
    const a = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(a), dy = Math.sin(a); // line direction
    const nx = -dy, ny = dx;                  // normal (offset direction)
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    const corners = [
      [rect.x, rect.y],
      [rect.x + rect.w, rect.y],
      [rect.x, rect.y + rect.h],
      [rect.x + rect.w, rect.y + rect.h],
    ];
    let tmin = Infinity, tmax = -Infinity;
    for (const [px, py] of corners) {
      const t = (px - cx) * nx + (py - cy) * ny;
      if (t < tmin) tmin = t;
      if (t > tmax) tmax = t;
    }
    const diag = Math.hypot(rect.w, rect.h);
    const out = [];
    for (let t = tmin + spacing * 0.5; t < tmax; t += spacing) {
      const bx = cx + t * nx, by = cy + t * ny;
      const seg = clipLiangBarsky(
        bx - dx * diag, by - dy * diag,
        bx + dx * diag, by + dy * diag,
        rect.x, rect.y, rect.x + rect.w, rect.y + rect.h
      );
      if (seg) out.push(seg);
    }
    return out;
  }

  function fillRect(rect, angle, spacing) {
    return hatchLines(rect, angle, spacing).map((s) => lineD(s[0], s[1], s[2], s[3]));
  }

  // ---- pattern dispatcher ---------------------------------------------------
  // Returns an array of {color, d}. `name` selects the fill style.
  // ctx provides: rh (rng helpers), unit (mm base module), strokeW,
  // solidSpacing, params.
  function applyPattern(name, rect, color, ctx) {
    const rh = ctx.rh;
    const u = ctx.unit;
    const ss = ctx.solidSpacing;
    const ds = [];

    switch (name) {
      case 'solid':
        ds.push(...fillRect(rect, rh.pick([0, 90]), ss));
        break;

      case 'crosshatch':
        ds.push(...fillRect(rect, 45, ss * 1.7));
        ds.push(...fillRect(rect, 135, ss * 1.7));
        break;

      case 'diaghatch':
        ds.push(...fillRect(rect, rh.pick([45, 135]), ss * 1.5));
        break;

      case 'vstripes': {
        const gap = Math.max(1.4, u * 0.55);
        const n = Math.max(1, Math.round(rect.w / gap));
        const g = rect.w / n;
        for (let i = 0; i <= n; i++) {
          const x = rect.x + i * g;
          let y1 = rect.y + rect.h;
          if (ctx.params.varylen && rh.chance(0.4)) y1 = rect.y + rect.h * rh.range(0.4, 0.95);
          ds.push(lineD(x, rect.y, x, y1));
        }
        break;
      }

      case 'hstripes': {
        const gap = Math.max(1.4, u * 0.55);
        const n = Math.max(1, Math.round(rect.h / gap));
        const g = rect.h / n;
        for (let j = 0; j <= n; j++) {
          const y = rect.y + j * g;
          ds.push(lineD(rect.x, y, rect.x + rect.w, y));
        }
        break;
      }

      case 'dotgrid': {
        const cell = Math.max(2.0, u * 0.75);
        const r = Math.max(0.5, cell * 0.26);
        const cols = Math.max(1, Math.floor(rect.w / cell));
        const rows = Math.max(1, Math.floor(rect.h / cell));
        const ox = rect.x + (rect.w - cols * cell) / 2;
        const oy = rect.y + (rect.h - rows * cell) / 2;
        for (let j = 0; j < rows; j++)
          for (let i = 0; i < cols; i++)
            ds.push(circleD(ox + (i + 0.5) * cell, oy + (j + 0.5) * cell, r));
        break;
      }

      case 'squaregrid': {
        const cell = Math.max(2.4, u * 0.85);
        const s = cell * 0.55;
        const cols = Math.max(1, Math.floor(rect.w / cell));
        const rows = Math.max(1, Math.floor(rect.h / cell));
        const ox = rect.x + (rect.w - cols * cell) / 2;
        const oy = rect.y + (rect.h - rows * cell) / 2;
        for (let j = 0; j < rows; j++)
          for (let i = 0; i < cols; i++)
            ds.push(rectD(ox + (i + 0.5) * cell - s / 2, oy + (j + 0.5) * cell - s / 2, s, s));
        break;
      }

      case 'checker': {
        const cell = Math.max(2.2, u * 0.95);
        const cols = Math.max(1, Math.floor(rect.w / cell));
        const rows = Math.max(1, Math.floor(rect.h / cell));
        const ox = rect.x + (rect.w - cols * cell) / 2;
        const oy = rect.y + (rect.h - rows * cell) / 2;
        const sp = Math.max(0.6, ctx.strokeW * 1.6);
        for (let j = 0; j < rows; j++)
          for (let i = 0; i < cols; i++)
            if ((i + j) % 2 === 0) {
              const sub = { x: ox + i * cell, y: oy + j * cell, w: cell, h: cell };
              ds.push(...fillRect(inset(sub, cell * 0.06), 0, sp));
            }
        break;
      }

      case 'circlerows': {
        const cell = Math.max(3.0, u * 1.05);
        const r = cell * 0.4;
        const cols = Math.max(1, Math.floor(rect.w / cell));
        const rows = Math.max(1, Math.floor(rect.h / cell));
        const ox = rect.x + (rect.w - cols * cell) / 2;
        const oy = rect.y + (rect.h - rows * cell) / 2;
        const concentric = rh.chance(0.5);
        for (let j = 0; j < rows; j++)
          for (let i = 0; i < cols; i++) {
            const cx = ox + (i + 0.5) * cell, cy = oy + (j + 0.5) * cell;
            ds.push(circleD(cx, cy, r));
            if (concentric) ds.push(circleD(cx, cy, r * 0.5));
          }
        break;
      }

      case 'brick': {
        const bw = Math.max(3.0, u * 1.3);
        const bh = Math.max(2.0, u * 0.75);
        const rows = Math.max(1, Math.floor(rect.h / bh));
        const oy = rect.y + (rect.h - rows * bh) / 2;
        for (let j = 0; j < rows; j++) {
          const y = oy + j * bh;
          const off = j % 2 ? bw / 2 : 0;
          for (let x = rect.x - off; x < rect.x + rect.w; x += bw) {
            const x0 = Math.max(x, rect.x);
            const x1 = Math.min(x + bw, rect.x + rect.w);
            if (x1 - x0 > 0.6) ds.push(rectD(x0, y, x1 - x0, bh));
          }
        }
        break;
      }

      case 'concentric': {
        let r = { ...rect };
        const gap = Math.max(1.6, u * 0.6);
        while (r.w > gap * 1.5 && r.h > gap * 1.5) {
          ds.push(rectD(r.x, r.y, r.w, r.h));
          r = inset(r, gap);
        }
        break;
      }

      case 'rings': {
        const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
        const R = Math.min(rect.w, rect.h) / 2;
        const gap = Math.max(1.6, u * 0.6);
        for (let rr = R; rr > gap * 0.8; rr -= gap) ds.push(circleD(cx, cy, rr));
        break;
      }

      default:
        ds.push(...fillRect(rect, 0, ss));
    }

    return ds.map((d) => ({ color, d }));
  }

  MOD.geom = { f, lineD, rectD, circleD, inset, hatchLines, fillRect, lum };
  MOD.applyPattern = applyPattern;
  MOD.PATTERN_SET = [
    'vstripes', 'vstripes', 'hstripes', 'dotgrid', 'dotgrid', 'squaregrid',
    'checker', 'checker', 'circlerows', 'diaghatch', 'diaghatch', 'brick',
    'solid', 'crosshatch', 'concentric', 'rings',
  ];
})();

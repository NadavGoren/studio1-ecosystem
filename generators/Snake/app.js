/* ══════════════════════════════════════════════════════════════════════
   Snake Plotter — app.js
   Generative pen-plotter path tool (A3/A4)

   Architecture
   ────────────
   1. Config     — read UI values
   2. Grid       — square cells, dynamically sized from Cell Size (mm)
   3. Layers     — randomly assign every cell to one of N layers (by
                   ratio weights), then connect each layer's cells via
                   nearest-neighbour walk.  100 % coverage guaranteed.
   4. Transform  — optional point jitter + Chaikin subdivision
   5. Smooth     — Catmull-Rom spline or legacy corner rounding
   6. Render     — SVG <path> elements
   7. Export     — standalone SVG file download
   ══════════════════════════════════════════════════════════════════════ */

"use strict";

const PAPER_SIZES = {
  A2: { w: 4200, h: 5940 },   // 420 × 594 mm in SVG units (0.1 mm each)
  A3: { w: 2970, h: 4200 },   // 297 × 420 mm
  A4: { w: 2100, h: 2970 },   // 210 × 297 mm
  A5: { w: 1480, h: 2100 },   // 148 × 210 mm
};

let paperW = 2970;
let paperH = 4200;

const PALETTE = [
  "#e6194b", "#3cb44b", "#4363d8", "#f58231",
  "#911eb4", "#42d4f4", "#f032e6", "#bfef45",
  "#fabed4", "#469990", "#dcbeff", "#9A6324",
];

/* ═══════════════════ SEEDED PRNG (Mulberry32) ════════════════════════ */

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ═══════════════════ §1  CONFIG ══════════════════════════════════════ */

function readConfig() {
  const numLines = +document.getElementById("numLines").value;
  const pcts   = [];
  const colors = [];
  for (let i = 0; i < numLines; i++) {
    const pctEl = document.getElementById(`ratio-${i}`);
    pcts.push(pctEl ? +pctEl.value || 0 : 0);
    const colEl = document.getElementById(`color-${i}`);
    colors.push(colEl ? colEl.value : PALETTE[i % PALETTE.length]);
  }

  const landscape = document.getElementById("landscape").checked;
  const format = document.getElementById("paperFormat").value;
  const size = PAPER_SIZES[format];
  paperW = landscape ? size.h : size.w;
  paperH = landscape ? size.w : size.h;
  document.getElementById("artboard").setAttribute("viewBox", `0 0 ${paperW} ${paperH}`);

  return {
    cellSize:     +document.getElementById("cellSize").value,
    marginMM:     +document.getElementById("margin").value,
    numLines,
    pcts,
    colors,
    smoothMethod: document.getElementById("smoothMethod").value,
    cornerPct:    +document.getElementById("cornerRadius").value / 100,
    tension:      +document.getElementById("tension").value,
    jitter:       +document.getElementById("jitter").value / 100,
    smoothIter:   +document.getElementById("smoothIter").value,
    diagBias:     +document.getElementById("diagBias").value,
    maxJumpMult:  +document.getElementById("maxJump").value,
    showGrid:      document.getElementById("showGrid").checked,
    strokeWidth:  +document.getElementById("strokeWidth").value,
    landscape,
  };
}

/* ═══════════════════ §2  GRID HELPERS ═══════════════════════════════ */

function cellCenter(col, row, origin, cell) {
  return {
    x: origin.x + col * cell + cell / 2,
    y: origin.y + row * cell + cell / 2,
  };
}

function ptDist(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/* ═══════════════════ §3  PATH GENERATION ════════════════════════════ */

function generatePaths(cfg, rng, cols, rows) {
  const { numLines, pcts, diagBias } = cfg;
  const total = cols * rows;
  const N     = Math.min(numLines, total);

  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push({ col: c, row: r });

  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const layers = [];
  let offset   = 0;
  for (let i = 0; i < N; i++) {
    const count = (i === N - 1)
      ? total - offset
      : Math.max(1, Math.round((pcts[i] / 100) * total));
    const end = Math.min(offset + count, total);
    layers.push(cells.slice(offset, end));
    offset = end;
  }

  const snakes = [];
  for (const layer of layers) {
    if (layer.length < 2) continue;
    snakes.push(orderByNearest(layer, rng, diagBias));
  }
  return snakes;
}

function orderByNearest(cells, rng, diagBias) {
  const n = cells.length;
  if (n === 0) return [];

  let maxCol = 0, maxRow = 0;
  for (const c of cells) {
    if (c.col > maxCol) maxCol = c.col;
    if (c.row > maxRow) maxRow = c.row;
  }
  const gCols = maxCol + 1;
  const gRows = maxRow + 1;

  const grid = new Int32Array(gCols * gRows).fill(-1);
  for (let i = 0; i < n; i++) {
    grid[cells[i].row * gCols + cells[i].col] = i;
  }

  const path = [];
  const startIdx = Math.floor(rng() * n);
  path.push(cells[startIdx]);
  grid[cells[startIdx].row * gCols + cells[startIdx].col] = -1;

  const maxRing = Math.max(gCols, gRows);

  for (let step = 1; step < n; step++) {
    const cur = path[step - 1];
    let bestIdx   = -1;
    let bestScore = Infinity;

    for (let ring = 1; ring <= maxRing; ring++) {
      const rMin = Math.max(0, cur.row - ring);
      const rMax = Math.min(gRows - 1, cur.row + ring);
      const cMin = Math.max(0, cur.col - ring);
      const cMax = Math.min(gCols - 1, cur.col + ring);

      for (let rr = rMin; rr <= rMax; rr++) {
        for (let cc = cMin; cc <= cMax; cc++) {
          if (Math.abs(rr - cur.row) < ring && Math.abs(cc - cur.col) < ring)
            continue;
          const idx = grid[rr * gCols + cc];
          if (idx === -1) continue;
          const dc = cc - cur.col, dr = rr - cur.row;
          const dist2  = dc * dc + dr * dr;
          const isDiag = dc !== 0 && dr !== 0;
          const score  = dist2 + (isDiag ? 0 : diagBias);
          if (score < bestScore || (score === bestScore && rng() < 0.5)) {
            bestIdx = idx; bestScore = score;
          }
        }
      }

      const nextMinDist2 = (ring + 1) * (ring + 1);
      if (bestIdx !== -1 && nextMinDist2 > bestScore) break;
    }

    path.push(cells[bestIdx]);
    grid[cells[bestIdx].row * gCols + cells[bestIdx].col] = -1;
  }

  return path;
}

/* ═══════════════════ §4  POINT TRANSFORMS ═══════════════════════════ */

function applyJitter(pts, jitterFrac, cell, rng) {
  if (jitterFrac <= 0) return pts;
  const maxOff = jitterFrac * cell * 0.5;
  return pts.map(p => ({
    x: p.x + (rng() * 2 - 1) * maxOff,
    y: p.y + (rng() * 2 - 1) * maxOff,
  }));
}

function chaikinSubdivide(pts, iterations) {
  if (iterations <= 0 || pts.length < 3) return pts;
  let result = pts;
  for (let iter = 0; iter < iterations; iter++) {
    const next = [result[0]];
    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i], b = result[i + 1];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    next.push(result[result.length - 1]);
    result = next;
  }
  return result;
}

function splitAtPenUp(pts, maxSegDist) {
  if (pts.length < 2) return [pts];
  const subPaths = [];
  let current = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    if (maxSegDist > 0 && ptDist(pts[i], pts[i + 1]) > maxSegDist) {
      if (current.length >= 2) subPaths.push(current);
      current = [pts[i + 1]];
    } else {
      current.push(pts[i + 1]);
    }
  }
  if (current.length >= 2) subPaths.push(current);
  return subPaths;
}

/* ═══════════════════ §5  PATH SMOOTHING ═════════════════════════════ */

function buildCatmullRomSubPath(pts, tension) {
  if (pts.length < 2) return "";
  const t6 = 6 * tension;
  const cmds = [`M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`];

  if (pts.length === 2) {
    cmds.push(`L ${pts[1].x.toFixed(2)} ${pts[1].y.toFixed(2)}`);
    return cmds.join(" ");
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / t6;
    const cp1y = p1.y + (p2.y - p0.y) / t6;
    const cp2x = p2.x - (p3.x - p1.x) / t6;
    const cp2y = p2.y - (p3.y - p1.y) / t6;

    cmds.push(
      `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ` +
      `${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ` +
      `${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
    );
  }
  return cmds.join(" ");
}

function buildLegacySubPath(pts, cornerPct, cell) {
  if (pts.length < 2) return "";
  const maxR = cornerPct * cell / 2;
  const cmds = [`M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`];

  for (let i = 1; i < pts.length; i++) {
    const isLast = (i === pts.length - 1);
    if (maxR === 0 || isLast) {
      cmds.push(`L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`);
    } else {
      const prev = pts[i - 1], curr = pts[i], next = pts[i + 1];
      const dIn  = ptDist(prev, curr);
      const dOut = ptDist(curr, next);
      if (dIn === 0 || dOut === 0) {
        cmds.push(`L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`);
        continue;
      }
      const r = Math.min(maxR, dIn / 2, dOut / 2);
      cmds.push(
        `L ${(curr.x + (prev.x - curr.x) / dIn * r).toFixed(2)} ` +
        `${(curr.y + (prev.y - curr.y) / dIn * r).toFixed(2)}`
      );
      cmds.push(
        `Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ` +
        `${(curr.x + (next.x - curr.x) / dOut * r).toFixed(2)} ` +
        `${(curr.y + (next.y - curr.y) / dOut * r).toFixed(2)}`
      );
    }
  }
  return cmds.join(" ");
}

/* ═══════════════════ §6  RENDER ═════════════════════════════════════ */

function render(snakes, cfg, cols, rows, rng) {
  const svg = document.getElementById("artboard");
  svg.innerHTML = "";

  const m    = cfg.marginMM * 10;
  const cell = cfg.cellSize * 10;

  const gridW  = cols * cell;
  const gridH  = rows * cell;
  const origin = {
    x: m + (paperW - 2 * m - gridW) / 2,
    y: m + (paperH - 2 * m - gridH) / 2,
  };

  const svgStroke  = cfg.strokeWidth * 10;
  const maxSegDist = cfg.maxJumpMult * cell;
  const NS = "http://www.w3.org/2000/svg";
  const hideGrid = !cfg.showGrid;

  // Frame
  const frameG = document.createElementNS(NS, "g");
  frameG.setAttribute("id", "Frame");
  if (hideGrid) frameG.setAttribute("display", "none");
  const rect = document.createElementNS(NS, "rect");
  rect.setAttribute("x", origin.x);
  rect.setAttribute("y", origin.y);
  rect.setAttribute("width", gridW);
  rect.setAttribute("height", gridH);
  rect.setAttribute("stroke", "#aaa");
  rect.setAttribute("stroke-width", "4");
  rect.setAttribute("fill", "none");
  frameG.appendChild(rect);
  svg.appendChild(frameG);

  // Grid lines
  const gridG = document.createElementNS(NS, "g");
  gridG.setAttribute("id", "Grid");
  gridG.setAttribute("stroke", "#ccc");
  gridG.setAttribute("stroke-width", "2");
  gridG.setAttribute("fill", "none");
  if (hideGrid) gridG.setAttribute("display", "none");

  for (let c = 0; c <= cols; c++) {
    const ln = document.createElementNS(NS, "line");
    ln.setAttribute("x1", origin.x + c * cell);
    ln.setAttribute("y1", origin.y);
    ln.setAttribute("x2", origin.x + c * cell);
    ln.setAttribute("y2", origin.y + gridH);
    gridG.appendChild(ln);
  }
  for (let r = 0; r <= rows; r++) {
    const ln = document.createElementNS(NS, "line");
    ln.setAttribute("x1", origin.x);
    ln.setAttribute("y1", origin.y + r * cell);
    ln.setAttribute("x2", origin.x + gridW);
    ln.setAttribute("y2", origin.y + r * cell);
    gridG.appendChild(ln);
  }
  svg.appendChild(gridG);

  // Snake paths
  snakes.forEach((snake, i) => {
    let pts = snake.map(s => cellCenter(s.col, s.row, origin, cell));
    pts = applyJitter(pts, cfg.jitter, cell, rng);

    const subPaths = splitAtPenUp(pts, maxSegDist);
    const isCR = cfg.smoothMethod === "catmull-rom";

    const pathParts = subPaths.map(sp => {
      const smoothed = chaikinSubdivide(sp, cfg.smoothIter);
      return isCR
        ? buildCatmullRomSubPath(smoothed, cfg.tension)
        : buildLegacySubPath(smoothed, cfg.cornerPct, cell);
    });

    const pd = pathParts.filter(Boolean).join(" ");
    if (!pd) return;

    const g = document.createElementNS(NS, "g");
    g.setAttribute("id", `Line ${i + 1}`);
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", pd);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", cfg.colors[i] || PALETTE[i % PALETTE.length]);
    p.setAttribute("stroke-width", svgStroke);
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    g.appendChild(p);
    svg.appendChild(g);
  });
}

/* ═══════════════════ §7  EXPORT ═════════════════════════════════════ */

function exportSVG() {
  const svg   = document.getElementById("artboard");
  const clone = svg.cloneNode(true);

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:inkscape", "http://www.inkscape.org/namespaces/inkscape");
  clone.setAttribute("width", `${paperW / 10}mm`);
  clone.setAttribute("height", `${paperH / 10}mm`);

  const INK = "http://www.inkscape.org/namespaces/inkscape";
  clone.querySelectorAll(":scope > g").forEach(g => {
    g.removeAttribute("display");
    g.setAttributeNS(INK, "inkscape:groupmode", "layer");
    g.setAttributeNS(INK, "inkscape:label", g.getAttribute("id"));
  });

  const svgStr = '<?xml version="1.0" encoding="UTF-8"?>\n'
               + new XMLSerializer().serializeToString(clone);

  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `snake-plotter-${document.getElementById("paperFormat").value}-${currentSeed.toString(16)}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══════════════════ §8  UI WIRING ══════════════════════════════════ */

let currentSeed = 0;

function wireSliders() {
  document.querySelectorAll('input[type="range"]').forEach(slider => {
    const out = slider.parentElement.querySelector("output");
    if (out) {
      out.textContent = slider.value;
      slider.addEventListener("input", () => { out.textContent = slider.value; });
    }
  });
}

function buildRatioInputs() {
  const n   = +document.getElementById("numLines").value;
  const box = document.getElementById("ratioInputs");
  box.innerHTML = "";

  const even = Math.floor(100 / n);

  for (let i = 0; i < n; i++) {
    const isLast = (i === n - 1);
    const row    = document.createElement("div");
    row.className = "ratio-row";

    const swatch = document.createElement("input");
    swatch.type      = "color";
    swatch.className = "color-swatch";
    swatch.id        = `color-${i}`;
    swatch.value     = PALETTE[i % PALETTE.length];
    swatch.addEventListener("input", regenerate);
    swatch.addEventListener("change", regenerate);

    const lbl    = document.createElement("span");
    lbl.textContent = `Line ${i + 1}`;
    lbl.style.flex  = "1";

    const inp    = document.createElement("input");
    inp.type = "number"; inp.id = `ratio-${i}`;
    inp.min = "0"; inp.max = "100"; inp.step = "1";
    inp.value = isLast ? String(100 - even * (n - 1)) : String(even);

    if (isLast) {
      inp.readOnly = true;
      inp.classList.add("ratio-auto");
    } else {
      inp.addEventListener("input", () => { updateLastPct(); regenerate(); });
      inp.addEventListener("change", () => { updateLastPct(); regenerate(); });
    }

    const pctLabel = document.createElement("span");
    pctLabel.textContent = "%";
    pctLabel.className = "pct-label";

    row.append(swatch, lbl, inp, pctLabel);
    box.appendChild(row);
  }
}

function updateLastPct() {
  const n = +document.getElementById("numLines").value;
  if (n < 2) {
    const el = document.getElementById("ratio-0");
    if (el) el.value = "100";
    return;
  }
  let sum = 0;
  for (let i = 0; i < n - 1; i++) {
    const el = document.getElementById(`ratio-${i}`);
    let v = el ? +el.value : 0;
    if (v < 0) { v = 0; el.value = "0"; }
    sum += v;
  }
  if (sum > 100) {
    const last = document.getElementById(`ratio-${n - 2}`);
    const over = sum - 100;
    last.value = String(Math.max(0, (+last.value) - over));
    sum = 100;
  }
  const remainder = Math.max(0, 100 - sum);
  const lastEl = document.getElementById(`ratio-${n - 1}`);
  if (lastEl) lastEl.value = String(remainder);
}

function updateSmoothingVisibility() {
  const method = document.getElementById("smoothMethod").value;
  const isCR = method === "catmull-rom";
  document.getElementById("tensionGroup").style.display    = isCR ? "" : "none";
  document.getElementById("cornerRadiusGroup").style.display = isCR ? "none" : "";
}

function computeGrid(cfg) {
  const m    = cfg.marginMM * 10;
  const cell = cfg.cellSize * 10;
  return {
    cols: Math.max(2, Math.floor((paperW - 2 * m) / cell)),
    rows: Math.max(2, Math.floor((paperH - 2 * m) / cell)),
  };
}

function generate() {
  currentSeed = Math.floor(Math.random() * 0xffffffff);
  document.getElementById("seedInput").value =
    currentSeed.toString(16).toUpperCase();
  runWithSeed(currentSeed);
}

function runWithSeed(seed) {
  const rng = mulberry32(seed);
  const cfg = readConfig();
  const { cols, rows } = computeGrid(cfg);

  const snakes = generatePaths(cfg, rng, cols, rows);
  render(snakes, cfg, cols, rows, rng);
}

function regenerate() {
  if (currentSeed === 0) return;
  runWithSeed(currentSeed);
}

function applySeedFromInput() {
  const raw = document.getElementById("seedInput").value.trim();
  const parsed = parseInt(raw, 16);
  if (!isNaN(parsed) && parsed > 0) {
    currentSeed = parsed;
    runWithSeed(currentSeed);
  }
}

/* ── Init ────────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  wireSliders();
  buildRatioInputs();
  updateSmoothingVisibility();

  document.getElementById("btnGenerate").addEventListener("click", generate);
  document.getElementById("btnExport").addEventListener("click", exportSVG);

  document.getElementById("numLines").addEventListener("input", () => {
    buildRatioInputs();
    regenerate();
  });

  document.getElementById("smoothMethod").addEventListener("change", () => {
    updateSmoothingVisibility();
    regenerate();
  });

  document.getElementById("seedInput").addEventListener("keydown", e => {
    if (e.key === "Enter") applySeedFromInput();
  });
  document.getElementById("btnApplySeed").addEventListener("click", applySeedFromInput);

  document.getElementById("paperFormat").addEventListener("change", regenerate);

  [
    "cellSize", "margin", "cornerRadius", "tension", "jitter",
    "smoothIter", "diagBias", "maxJump",
    "showGrid", "strokeWidth", "landscape",
  ].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", regenerate);
    el.addEventListener("change", regenerate);
  });

  generate();
});

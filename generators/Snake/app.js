/* ══════════════════════════════════════════════════════════════════════
   Snake Plotter — app.js
   Generative A3 pen-plotter path tool

   Architecture
   ────────────
   1. Config   — read UI values
   2. Grid     — square cells, dynamically sized from Cell Size (mm)
   3. Layers   — randomly assign every cell to one of N layers (by
                  ratio weights), then connect each layer's cells in
                  random order.  100 % coverage guaranteed, O(n).
   4. Smooth   — bezier corner rounding
   5. Render   — SVG <path> elements
   6. Export   — standalone SVG file download
   ══════════════════════════════════════════════════════════════════════ */

"use strict";

const A3_W = 2970;   // 297 mm in SVG units (0.1 mm each)
const A3_H = 4200;   // 420 mm

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

  return {
    cellSize:    +document.getElementById("cellSize").value,       // mm
    marginMM:    +document.getElementById("margin").value,         // mm
    numLines,
    pcts,
    colors,
    cornerPct:   +document.getElementById("cornerRadius").value / 100,
    showGrid:     document.getElementById("showGrid").checked,
    strokeWidth: +document.getElementById("strokeWidth").value,    // mm
  };
}

/* ═══════════════════ §2  GRID HELPERS ═══════════════════════════════ */

function cellCenter(col, row, origin, cell) {
  return {
    x: origin.x + col * cell + cell / 2,
    y: origin.y + row * cell + cell / 2,
  };
}

/* ═══════════════════ §3  PATH GENERATION ════════════════════════════

   1. Collect every cell, shuffle, deal to N layers by ratio weights.
   2. For each layer, order cells via nearest-neighbour walk:
        • prefer DIAGONAL connections (dc≠0 AND dr≠0)
        • fall back to straight (same row or col) only when no
          diagonal candidate remains
        • among the preferred group, pick the closest cell
          (Euclidean), random tiebreak

   Every cell assigned to exactly one layer → 100 % coverage.
   Nearest-neighbour walk is O(n²) per layer — fast for typical grids.
   ════════════════════════════════════════════════════════════════════ */

function generatePaths(cfg, rng, cols, rows) {
  const { numLines, pcts } = cfg;
  const total = cols * rows;
  const N     = Math.min(numLines, total);

  // Collect all cells
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push({ col: c, row: r });

  // Fisher-Yates shuffle (randomises the initial assignment)
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  // Distribute to layers by percentage
  const layers = [];
  let offset   = 0;

  for (let i = 0; i < N; i++) {
    const count = (i === N - 1)
      ? total - offset
      : Math.max(1, Math.round((pcts[i] / 100) * total));
    const end   = Math.min(offset + count, total);
    layers.push(cells.slice(offset, end));
    offset = end;
  }

  // Order each layer by nearest-neighbour, diagonal-first
  const snakes = [];
  for (const layer of layers) {
    if (layer.length < 2) continue;
    snakes.push(orderByNearest(layer, rng));
  }
  return snakes;
}

/**
 * Greedy nearest-neighbour walk through `cells`.
 * Uses a spatial grid for O(1) neighbour lookup instead of scanning
 * every cell.  Searches outward in expanding Chebyshev-distance rings
 * until a candidate is found.  Prefers diagonal connections.
 */
function orderByNearest(cells, rng) {
  const n = cells.length;
  if (n === 0) return [];

  let maxCol = 0, maxRow = 0;
  for (const c of cells) {
    if (c.col > maxCol) maxCol = c.col;
    if (c.row > maxRow) maxRow = c.row;
  }
  const gCols = maxCol + 1;
  const gRows = maxRow + 1;

  // Spatial grid: grid[row * gCols + col] = index into cells[], or -1
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
          const score  = dist2 + (isDiag ? 0 : 2);
          if (score < bestScore || (score === bestScore && rng() < 0.5)) {
            bestIdx = idx; bestScore = score;
          }
        }
      }

      // Once we've found a candidate AND the next ring's minimum
      // possible dist² would exceed our best score, we can stop.
      const nextMinDist2 = (ring + 1) * (ring + 1);
      if (bestIdx !== -1 && nextMinDist2 > bestScore) break;
    }

    path.push(cells[bestIdx]);
    grid[cells[bestIdx].row * gCols + cells[bestIdx].col] = -1;
  }

  return path;
}

/* ═══════════════════ §4  PATH SMOOTHING ═════════════════════════════ */

/**
 * Build SVG path data from an ordered list of cells.
 * `maxSegDist` — if > 0, any segment longer than this emits a
 * pen-up (M) instead of a line, preventing cross-canvas jumps.
 */
function buildPathData(snake, origin, cell, cornerPct, maxSegDist) {
  if (snake.length < 2) return "";

  const pts  = snake.map(s => cellCenter(s.col, s.row, origin, cell));
  const maxR = cornerPct * cell / 2;

  // Pre-compute segment distances and whether each is drawable
  const segLen  = [];    // segLen[i] = distance from pts[i] to pts[i+1]
  const draw    = [];    // draw[i]   = true if segment i is short enough
  for (let i = 0; i < pts.length - 1; i++) {
    const d = dist(pts[i], pts[i + 1]);
    segLen.push(d);
    draw.push(maxSegDist <= 0 || d <= maxSegDist);
  }

  const d = [];
  d.push(`M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`);

  for (let i = 1; i < pts.length; i++) {
    const seg = i - 1;                      // index into segLen / draw

    if (!draw[seg]) {
      // Segment too long → pen up, move to this point
      d.push(`M ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`);
      continue;
    }

    const isLast      = (i === pts.length - 1);
    const nextDrawn   = !isLast && draw[i];  // will the NEXT segment also be drawn?

    if (maxR === 0 || isLast || !nextDrawn) {
      // Straight line (no rounding possible at this vertex)
      d.push(`L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`);
    } else {
      // Interior vertex with both segments drawn → round the corner
      const prev = pts[i - 1], curr = pts[i], next = pts[i + 1];
      const dIn  = segLen[seg];
      const dOut = segLen[i];
      const r    = Math.min(maxR, dIn / 2, dOut / 2);

      d.push(`L ${(curr.x + (prev.x - curr.x) / dIn * r).toFixed(2)} ${(curr.y + (prev.y - curr.y) / dIn * r).toFixed(2)}`);
      d.push(`Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${(curr.x + (next.x - curr.x) / dOut * r).toFixed(2)} ${(curr.y + (next.y - curr.y) / dOut * r).toFixed(2)}`);
    }
  }
  return d.join(" ");
}

function dist(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/* ═══════════════════ §5  RENDER ═════════════════════════════════════ */

function render(snakes, cfg, cols, rows) {
  const svg = document.getElementById("artboard");
  svg.innerHTML = "";

  const m    = cfg.marginMM * 10;
  const cell = cfg.cellSize * 10;

  const gridW  = cols * cell;
  const gridH  = rows * cell;
  const origin = {
    x: m + (A3_W - 2 * m - gridW) / 2,
    y: m + (A3_H - 2 * m - gridH) / 2,
  };

  const svgStroke = cfg.strokeWidth * 10;
  const NS = "http://www.w3.org/2000/svg";
  const hideGrid = !cfg.showGrid;

  // ── Layer: Frame (outer rectangle) ──
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

  // ── Layer: Grid (inner lines) ──
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

  // ── Layers: Line 1, Line 2, … ──
  const maxSegDist = 3 * cell;

  snakes.forEach((snake, i) => {
    const pd = buildPathData(snake, origin, cell, cfg.cornerPct, maxSegDist);
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

/* ═══════════════════ §6  EXPORT ═════════════════════════════════════ */

function exportSVG() {
  const svg   = document.getElementById("artboard");
  const clone = svg.cloneNode(true);

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:inkscape", "http://www.inkscape.org/namespaces/inkscape");
  clone.setAttribute("width", "297mm");
  clone.setAttribute("height", "420mm");

  // Make all top-level <g> groups visible and tag as Inkscape layers
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
  a.download = `snake-plotter-${currentSeed}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══════════════════ §7  UI WIRING ══════════════════════════════════ */

let currentSeed = 0;

function wireSliders() {
  document.querySelectorAll('input[type="range"]').forEach((slider) => {
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

/** Recalculate the last line's percentage so all lines sum to 100 %. */
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
  // Clamp editable inputs so total never exceeds 100
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

function computeGrid(cfg) {
  const m    = cfg.marginMM * 10;
  const cell = cfg.cellSize * 10;
  return {
    cols: Math.max(2, Math.floor((A3_W - 2 * m) / cell)),
    rows: Math.max(2, Math.floor((A3_H - 2 * m) / cell)),
  };
}

function generate() {
  currentSeed = Math.floor(Math.random() * 0xffffffff);
  runWithSeed(currentSeed);
}

function runWithSeed(seed) {
  const rng = mulberry32(seed);
  const cfg = readConfig();
  const { cols, rows } = computeGrid(cfg);

  document.getElementById("seedDisplay").textContent =
    seed.toString(16).toUpperCase();

  const snakes = generatePaths(cfg, rng, cols, rows);
  render(snakes, cfg, cols, rows);
}

function regenerate() {
  if (currentSeed === 0) return;
  runWithSeed(currentSeed);
}

/* ── Init ────────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  wireSliders();
  buildRatioInputs();

  document.getElementById("btnGenerate").addEventListener("click", generate);
  document.getElementById("btnExport").addEventListener("click", exportSVG);

  document.getElementById("numLines").addEventListener("input", () => {
    buildRatioInputs();
    regenerate();
  });

  ["cellSize", "margin", "cornerRadius",
   "showGrid", "strokeWidth"
  ].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", regenerate);
    el.addEventListener("change", regenerate);
  });

  generate();
});

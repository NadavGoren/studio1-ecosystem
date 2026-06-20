"use strict";

/* ══════════════════════════════════════════════════════════════════════
   Woven Grid — app.js   (v3 — Major Upgrade)
   Parametric woven-grid textile pattern generator.

   Shapes: rect, roundRect, circle, diamond, triangle, chevron, diagonal
   Patterns: classic, brick, checkerboard, gradient, scatter, wave
   Effects: opacity, stroke, corner-radius, cell rotation, scale var
   Interactive: pan/zoom, grid-line drag, cell color override
   UX: undo/redo, surprise-me, preset save/load, PNG export
   ══════════════════════════════════════════════════════════════════════ */

const PAPER = {
  A2: { w: 420, h: 594 },
  A3: { w: 297, h: 420 },
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
};

const PRESETS = {
  autumn:    { group: "Earth & Warm",       label: "Autumn Weave", bg: "#F0E6D0", cols: ["#C8553D","#28536B","#6B8F3C","#D5A021","#8B3A62"], zones: ["#B85C38","#2E856E","#C4943A"] },
  terra:     { group: "Earth & Warm",       label: "Terra",        bg: "#F2E8DA", cols: ["#A0522D","#CD853F","#8B7355","#6B8E23","#D2691E"], zones: ["#A0522D","#8B7355","#CD853F"] },
  desert:    { group: "Earth & Warm",       label: "Mojave",       bg: "#F2E2C8", cols: ["#D47A3A","#8B3A2A","#3A5A7A","#8A9C5A","#D4573A"], zones: ["#B4533A","#2A7A7A","#C4A030"] },
  sahel:     { group: "Earth & Warm",       label: "Sahel",        bg: "#F0E4C8", cols: ["#C4A35A","#B85C38","#2C3E6B","#E8D8B4","#1A1A1A"], zones: ["#B85C38","#C4A35A","#2C3E6B"] },
  navajo:    { group: "Earth & Warm",       label: "Navajo",       bg: "#F5ECD8", cols: ["#C1440E","#4B9CAC","#D4A53A","#8B3A2A","#E8D4B0"], zones: ["#C1440E","#4B9CAC","#D4A53A"] },

  bauhaus:   { group: "Bold & Primary",     label: "Bauhaus",      bg: "#F5F0E8", cols: ["#CC3333","#1756A5","#F0C020","#1A1A1A","#CC3333"], zones: ["#CC3333","#1756A5","#F0C020"] },
  mondrian:  { group: "Bold & Primary",     label: "Mondrian",     bg: "#F5F2EA", cols: ["#D41920","#2356A6","#F7D618","#1A1A1A"],           zones: ["#D41920","#2356A6","#F7D618"] },
  matisse:   { group: "Bold & Primary",     label: "Matisse",      bg: "#FCF5E8", cols: ["#1E50A0","#D43D2F","#2D854A","#F4C740"],           zones: ["#D43D2F","#1E50A0","#2D854A"] },
  marimekko: { group: "Bold & Primary",     label: "Marimekko",    bg: "#FAF0E6", cols: ["#E23D80","#F08C28","#3AAA5E","#2C3E7B"],           zones: ["#E23D80","#F08C28","#3AAA5E"] },
  memphis:   { group: "Bold & Primary",     label: "Memphis",      bg: "#F5F0F0", cols: ["#E84B8A","#3BC8C8","#F5D63D","#1A1A2E","#9B59B6"], zones: ["#E84B8A","#3BC8C8","#F5D63D"] },

  nordic:    { group: "Cool & Muted",       label: "Scandinavian", bg: "#E6E2DA", cols: ["#5B7B8C","#3C4A3C","#A89882","#B07A7A","#6B6B5C"], zones: ["#7A8C6A","#5A6A7A","#A88A6A"] },
  shibori:   { group: "Cool & Muted",       label: "Shibori",      bg: "#E8E4EA", cols: ["#1A2E5A","#4A6A9A","#8AA4C8","#2A3A6A"],           zones: ["#1A2E5A","#4A6A9A","#8AA4C8"] },
  forest:    { group: "Cool & Muted",       label: "Forest",       bg: "#E8E4D8", cols: ["#2D5A3A","#6B8C4A","#5A3E28","#8BA878","#7A7A6A"], zones: ["#2D5A3A","#5A3E28","#6B8C4A"] },
  winter:    { group: "Cool & Muted",       label: "Nordic Winter", bg: "#E8EAF0", cols: ["#6A8CA8","#3A3A4A","#C8CCD4","#A0B0C0","#8A3A5A"], zones: ["#6A8CA8","#3A3A4A","#8A3A5A"] },
  pacific:   { group: "Cool & Muted",       label: "Pacific",      bg: "#E8F0F0", cols: ["#1A6A8A","#5ABAB0","#D47A5A","#8A7A5A","#2A5A4A"], zones: ["#1A6A8A","#5ABAB0","#D47A5A"] },

  kente:     { group: "Textile & Vibrant",  label: "Kente",        bg: "#F8F0D8", cols: ["#D4A020","#2D8B2D","#CC2020","#1A1A1A","#2A5AAA"], zones: ["#D4A020","#CC2020","#2D8B2D"] },
  kilim:     { group: "Textile & Vibrant",  label: "Kilim",        bg: "#F2E8DA", cols: ["#B84A32","#2A7A7A","#F2EAD4","#8A2A5A","#D4A040"], zones: ["#B84A32","#2A7A7A","#D4A040"] },
  ikat:      { group: "Textile & Vibrant",  label: "Ikat",         bg: "#F0E8E0", cols: ["#6A2A8A","#2A8A8A","#D46A4A","#C4A030","#F0E0D0"], zones: ["#6A2A8A","#2A8A8A","#D46A4A"] },
  sunset:    { group: "Textile & Vibrant",  label: "Sunset",       bg: "#FFF0E0", cols: ["#E0604A","#F0A030","#C83A7A","#2A3A6A","#D4A030"], zones: ["#E0604A","#C83A7A","#2A3A6A"] },
  indigo:    { group: "Textile & Vibrant",  label: "Indigo",       bg: "#F0F0F8", cols: ["#1A1A5A","#3A4AAA","#6A7ACA","#DADAF0"],           zones: ["#1A1A5A","#3A4AAA","#6A7ACA"] },
};

let currentSeed = 0;
let currentPreset = "autumn";

/* ── state for interactive features ── */
const manualColWidths = {};
const manualRowHeights = {};
const cellOverrides = new Map();
let panX = 0, panY = 0, zoomLevel = 1;
let isPanning = false, panStartX = 0, panStartY = 0, panStartPX = 0, panStartPY = 0;
let isDraggingGrid = false, dragType = null, dragIndex = -1, dragStartPos = 0, dragStartVal = 0;
let selectedCell = null;
const lockedParams = new Set();

/* ── undo / redo ── */
const undoStack = [];
const redoStack = [];
const MAX_UNDO = 50;

/* ── user presets (localStorage) ── */
const USER_PRESETS_KEY = "wovenGrid_userPresets";

/* ═══════════════ PRNG ════════════════════════════════════════════════ */

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cellHash(col, row, seed) {
  let h = (seed | 0) ^ ((col * 374761393) | 0);
  h = (h + ((row * 668265263) | 0)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/* ═══════════════ COLOR UTILS ═════════════════════════════════════════ */

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function lerpColor(a, b, t) {
  const ca = hexToRgb(a), cb = hexToRgb(b);
  return rgbToHex(
    Math.round(ca[0] + (cb[0] - ca[0]) * t),
    Math.round(ca[1] + (cb[1] - ca[1]) * t),
    Math.round(ca[2] + (cb[2] - ca[2]) * t)
  );
}

/* ═══════════════ CONFIG ══════════════════════════════════════════════ */

function readConfig() {
  const cfg = {};
  document.querySelectorAll("[data-param]").forEach((el) => {
    const key = el.dataset.param;
    if (el.type === "range" || el.type === "number") cfg[key] = +el.value;
    else if (el.type === "checkbox") cfg[key] = el.checked;
    else if (el.type === "color") cfg[key] = el.value;
    else cfg[key] = el.value;
  });
  cfg.colPalette = [...document.querySelectorAll(".col-color-pick")].map((e) => e.value);
  cfg.zonePalette = [...document.querySelectorAll(".zone-color-pick")].map((e) => e.value);
  return cfg;
}

function configSnapshot() {
  const snap = {};
  document.querySelectorAll("[data-param]").forEach((el) => {
    const key = el.id;
    if (el.type === "checkbox") snap[key] = el.checked;
    else snap[key] = el.value;
  });
  snap._colColors = [...document.querySelectorAll(".col-color-pick")].map((e) => e.value);
  snap._zoneColors = [...document.querySelectorAll(".zone-color-pick")].map((e) => e.value);
  snap._seed = currentSeed;
  return snap;
}

function restoreSnapshot(snap) {
  document.querySelectorAll("[data-param]").forEach((el) => {
    const key = el.id;
    if (snap[key] === undefined) return;
    if (el.type === "checkbox") el.checked = snap[key];
    else el.value = snap[key];
  });
  if (snap._colColors) {
    const n = snap._colColors.length;
    document.getElementById("num-col-colors").value = n;
    buildColPalette(false);
    const picks = document.querySelectorAll(".col-color-pick");
    snap._colColors.forEach((c, i) => { if (picks[i]) picks[i].value = c; });
  }
  if (snap._zoneColors) {
    const n = snap._zoneColors.length;
    document.getElementById("num-zones").value = n;
    buildZonePalette(false);
    const picks = document.querySelectorAll(".zone-color-pick");
    snap._zoneColors.forEach((c, i) => { if (picks[i]) picks[i].value = c; });
  }
  if (snap._seed) currentSeed = snap._seed;
  refreshAllSliderDisplays();
  updateShapeVisibility();
  updatePatternVisibility();
  updateCustomPaperVisibility();
}

function pushUndo() {
  undoStack.push(configSnapshot());
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
  updateUndoButtons();
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(configSnapshot());
  restoreSnapshot(undoStack.pop());
  runWithSeed(currentSeed);
  updateUndoButtons();
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(configSnapshot());
  restoreSnapshot(redoStack.pop());
  runWithSeed(currentSeed);
  updateUndoButtons();
}

function updateUndoButtons() {
  const bu = document.getElementById("btn-undo");
  const br = document.getElementById("btn-redo");
  if (bu) bu.disabled = undoStack.length === 0;
  if (br) br.disabled = redoStack.length === 0;
}

function getPaperDims(cfg) {
  if (cfg.paperSize === "custom") {
    const w = cfg.customPaperW || 297;
    const h = cfg.customPaperH || 420;
    return cfg.orientation === "landscape" ? { w: Math.max(w, h), h: Math.min(w, h) } : { w: Math.min(w, h), h: Math.max(w, h) };
  }
  const p = PAPER[cfg.paperSize] || PAPER.A3;
  return cfg.orientation === "landscape" ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}

/* ═══════════════ GRID DIMENSIONS ═════════════════════════════════════ */

function generateDimensions(cfg, rng) {
  const { w, h } = getPaperDims(cfg);
  const wVar = (cfg.widthVar / 100) * 0.8;
  const hVar = (cfg.heightVar / 100) * 0.8;

  const rawW = [];
  for (let i = 0; i < cfg.cols; i++) {
    if (manualColWidths[i] !== undefined) rawW.push(manualColWidths[i]);
    else rawW.push(Math.max(0.15, 1 + (rng() * 2 - 1) * wVar));
  }
  const sumW = rawW.reduce((a, b) => a + b, 0);

  const rawH = [];
  for (let i = 0; i < cfg.rows; i++) {
    if (manualRowHeights[i] !== undefined) rawH.push(manualRowHeights[i]);
    else rawH.push(Math.max(0.15, 1 + (rng() * 2 - 1) * hVar));
  }
  const sumH = rawH.reduce((a, b) => a + b, 0);

  const colX = new Float64Array(cfg.cols + 1);
  colX[0] = 0;
  for (let i = 0; i < cfg.cols; i++) colX[i + 1] = colX[i] + (rawW[i] / sumW) * w;
  colX[cfg.cols] = w;

  const rowY = new Float64Array(cfg.rows + 1);
  rowY[0] = 0;
  for (let i = 0; i < cfg.rows; i++) rowY[i + 1] = rowY[i] + (rawH[i] / sumH) * h;
  rowY[cfg.rows] = h;

  return { colX, rowY, rawW, rawH };
}

/* ═══════════════ ZONE MAP ════════════════════════════════════════════ */

function buildZoneMap(totalRows, numZones) {
  const base = Math.floor(totalRows / numZones);
  const rem = totalRows % numZones;
  const map = new Uint8Array(totalRows);
  let z = 0, cnt = 0;
  for (let r = 0; r < totalRows; r++) {
    map[r] = z;
    cnt++;
    if (cnt >= base + (z < rem ? 1 : 0)) { z++; cnt = 0; }
  }
  return map;
}

function mirrorIdx(i, total) {
  const half = Math.ceil(total / 2);
  return i < half ? i : total - 1 - i;
}

/* ═══════════════ SHAPE DRAW FUNCTIONS ════════════════════════════════ */

function fmtN(n) { return n.toFixed(3); }

function shapeAttrs(cfg) {
  let extra = "";
  const opacity = (cfg.opacity || 100) / 100;
  if (opacity < 1) extra += ` fill-opacity="${opacity}"`;
  if (cfg.enableStroke) {
    const sw = cfg.strokeWidth || 0.1;
    const sc = cfg.strokeColor || "#000000";
    extra += ` stroke="${sc}" stroke-width="${fmtN(sw)}"`;
  }
  return extra;
}

/* When `collect` is provided, push {color, pts} polygon descriptors for merging. */
function pushPoly(collect, fill, pts) {
  if (collect) collect.push({ color: fill, pts });
}

function drawRect(bucket, collect, x, y, w, h, fill, cfg) {
  bucket.push(`<rect x="${fmtN(x)}" y="${fmtN(y)}" width="${fmtN(w)}" height="${fmtN(h)}" fill="${fill}"${shapeAttrs(cfg)}/>`);
  pushPoly(collect, fill, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  return 1;
}

function drawRoundRect(bucket, collect, x, y, w, h, fill, cfg) {
  const r = Math.min(cfg.cornerRadius || 1, w / 2, h / 2);
  bucket.push(`<rect x="${fmtN(x)}" y="${fmtN(y)}" width="${fmtN(w)}" height="${fmtN(h)}" rx="${fmtN(r)}" ry="${fmtN(r)}" fill="${fill}"${shapeAttrs(cfg)}/>`);
  pushPoly(collect, fill, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  return 1;
}

function drawCircles(bucket, collect, x, y, w, h, fill, cfg) {
  const d = h;
  if (d < 0.01) return 0;
  const r = d / 2;
  let count = 0;
  const step = d;
  const sa = shapeAttrs(cfg);
  for (let cx = x + r; cx <= x + w + 0.001; cx += step) {
    if (cx + r > x + w + 0.01) break;
    bucket.push(`<circle cx="${fmtN(cx)}" cy="${fmtN(y + r)}" r="${fmtN(r)}" fill="${fill}"${sa}/>`);
    if (collect) {
      const cy2 = y + r, pts = [];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy2 + Math.sin(a) * r]);
      }
      pushPoly(collect, fill, pts);
    }
    count++;
  }
  return count;
}

function drawDiamond(bucket, collect, x, y, w, h, fill, cfg) {
  const cx = x + w / 2, cy = y + h / 2;
  const pts = `${fmtN(cx)},${fmtN(y)} ${fmtN(x + w)},${fmtN(cy)} ${fmtN(cx)},${fmtN(y + h)} ${fmtN(x)},${fmtN(cy)}`;
  bucket.push(`<polygon points="${pts}" fill="${fill}"${shapeAttrs(cfg)}/>`);
  pushPoly(collect, fill, [[cx, y], [x + w, cy], [cx, y + h], [x, cy]]);
  return 1;
}

function drawTriangles(bucket, collect, x, y, w, h, fill, altFill, cfg) {
  const triW = h;
  if (triW < 0.01) return 0;
  let count = 0;
  const sa = shapeAttrs(cfg);
  for (let tx = x; tx < x + w - 0.001; tx += triW) {
    const right = Math.min(tx + triW, x + w);
    const midX = (tx + right) / 2;
    const up = count % 2 === 0;
    const c = up ? fill : altFill;
    const tri = up
      ? [[tx, y + h], [right, y + h], [midX, y]]
      : [[tx, y], [right, y], [midX, y + h]];
    const pts = tri.map((p) => `${fmtN(p[0])},${fmtN(p[1])}`).join(" ");
    bucket.push(`<polygon points="${pts}" fill="${c}"${sa}/>`);
    pushPoly(collect, c, tri);
    count++;
  }
  return count;
}

function drawChevron(bucket, collect, x, y, w, h, fill, cfg) {
  const indent = Math.min(w * 0.2, h);
  const poly = [[x, y], [x + w / 2, y + indent], [x + w, y], [x + w, y + h], [x + w / 2, y + h - indent], [x, y + h]];
  const d = `M${fmtN(x)},${fmtN(y)} L${fmtN(x + w / 2)},${fmtN(y + indent)} L${fmtN(x + w)},${fmtN(y)} L${fmtN(x + w)},${fmtN(y + h)} L${fmtN(x + w / 2)},${fmtN(y + h - indent)} L${fmtN(x)},${fmtN(y + h)} Z`;
  bucket.push(`<path d="${d}" fill="${fill}"${shapeAttrs(cfg)}/>`);
  pushPoly(collect, fill, poly);
  return 1;
}

function drawDiagonal(bucket, collect, x, y, w, h, fill, cfg, clipId) {
  const angle = cfg.diagonalAngle || 30;
  const cx = x + w / 2, cy = y + h / 2;
  bucket.push(`<rect x="${fmtN(x - w)}" y="${fmtN(y)}" width="${fmtN(w * 3)}" height="${fmtN(h)}" fill="${fill}"${shapeAttrs(cfg)} clip-path="url(#${clipId})" transform="rotate(${angle},${fmtN(cx)},${fmtN(cy)})"/>`);
  // Visible region equals the (clipped) cell rect, so merge geometry is that rect.
  pushPoly(collect, fill, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  return 1;
}

/* Dispatch one stripe/cell of the chosen fill shape. */
function emitStripe(bucket, collect, shape, x, y, w, h, color, altColor, cfg, clipId) {
  switch (shape) {
    case "roundRect": return drawRoundRect(bucket, collect, x, y, w, h, color, cfg);
    case "circle":    return drawCircles(bucket, collect, x, y, w, h, color, cfg);
    case "diamond":   return drawDiamond(bucket, collect, x, y, w, h, color, cfg);
    case "triangle":  return drawTriangles(bucket, collect, x, y, w, h, color, altColor, cfg);
    case "chevron":   return drawChevron(bucket, collect, x, y, w, h, color, cfg);
    case "diagonal":  return drawDiagonal(bucket, collect, x, y, w, h, color, cfg, clipId);
    default:          return drawRect(bucket, collect, x, y, w, h, color, cfg);
  }
}

/* Draw the woven stripes of one cell against an ABSOLUTE-Y lattice so that
   stripes flow continuously down a column (no per-row phase reset). */
function drawCellStripes(bucket, collect, shape, cX, rY, cellW, cellH, warpColor, weftColor, params, cfg, clipId) {
  const { evenH, oddH, gapH, period, phase } = params;
  if (period < 0.02 || cellW <= 0.01 || cellH <= 0.01) return 0;
  const top = rY, bot = rY + cellH;
  let count = 0;
  let p = Math.floor((top - phase) / period) - 1;
  for (; ; p++) {
    const pTop = p * period + phase;
    if (pTop >= bot) break;

    if (evenH > 0.002) {
      const a = Math.max(top, pTop);
      const b = Math.min(bot, pTop + evenH);
      if (b - a > 0.002) count += emitStripe(bucket, collect, shape, cX, a, cellW, b - a, warpColor, weftColor, cfg, clipId);
    }

    const oStart = pTop + evenH + (gapH > 0 ? gapH : 0);
    if (oddH > 0.002) {
      const a = Math.max(top, oStart);
      const b = Math.min(bot, oStart + oddH);
      if (b - a > 0.002) count += emitStripe(bucket, collect, shape, cX, a, cellW, b - a, weftColor, warpColor, cfg, clipId);
    }
  }
  return count;
}

/* ═══════════════ SHAPE MERGE (Paper.js boolean union) ════════════════ */

let _paperReady = false;
function initPaper() {
  if (_paperReady) return true;
  try {
    if (typeof paper === "undefined") return false;
    if (!paper.project) {
      const c = document.createElement("canvas");
      c.width = 1000; c.height = 1000;
      paper.setup(c);
    }
    _paperReady = true;
    return true;
  } catch (e) {
    console.error("Paper.js failed to initialize:", e);
    return false;
  }
}

function polyToPath(pts, fill, cfg) {
  const d = "M" + pts.map((pt) => `${fmtN(pt[0])},${fmtN(pt[1])}`).join(" L") + " Z";
  return `<path d="${d}" fill="${fill}"${shapeAttrs(cfg)} shape-rendering="geometricPrecision"/>`;
}

/* Union same-color polygons within one zone into one <path> per color. */
function mergeZonePrimitives(prims, cfg) {
  if (!prims || prims.length === 0) return [];

  const byColor = new Map();
  for (const p of prims) {
    if (!byColor.has(p.color)) byColor.set(p.color, []);
    byColor.get(p.color).push(p.pts);
  }

  // Fallback: no Paper.js → emit raw polygons (still grouped, just not unioned).
  if (!initPaper()) {
    const out = [];
    for (const [color, polys] of byColor) for (const pts of polys) out.push(polyToPath(pts, color, cfg));
    return out;
  }

  const out = [];
  paper.project.activeLayer.removeChildren();
  for (const [color, polys] of byColor) {
    let result = null;
    for (const pts of polys) {
      const path = new paper.Path({ segments: pts.map((pt) => new paper.Point(pt[0], pt[1])), closed: true });
      if (!result) { result = path; continue; }
      const u = result.unite(path);
      result.remove();
      path.remove();
      result = u;
    }
    if (!result) continue;
    const d = result.pathData;
    result.remove();
    if (d) out.push(`<path d="${d}" fill="${color}"${shapeAttrs(cfg)} shape-rendering="geometricPrecision"/>`);
  }
  paper.project.activeLayer.removeChildren();
  return out;
}

/* ═══════════════ SVG GENERATION ══════════════════════════════════════ */

function generateSVG(cfg, rng, seed) {
  const { w, h } = getPaperDims(cfg);
  const { colX, rowY } = generateDimensions(cfg, rng);
  const zoneMap = buildZoneMap(cfg.rows, cfg.numZones);

  const gutter = cfg.cellGutter || 0;
  const halfGut = gutter / 2;

  const baseStripeH = cfg.stripeHeight;
  const baseGapH = cfg.gapHeight;
  const warpW = cfg.warpWeight / 100;
  const baseEvenH = baseStripeH * 2 * warpW;
  const baseOddH = baseStripeH * 2 * (1 - warpW);

  const densityVar = (cfg.densityVar || 0) / 100;
  const fillShape = cfg.fillShape || "rect";
  const patternMode = cfg.patternMode || "classic";
  const cellRotation = cfg.cellRotation || 0;
  const scaleVar = (cfg.scaleVar || 0) / 100;
  const merge = !!cfg.mergeShapes;

  // Stripe thickness varies PER COLUMN (warp-thread weight) so the lattice
  // stays constant down a column and stripes flow continuously across rows.
  const colScale = new Float64Array(cfg.cols);
  for (let c = 0; c < cfg.cols; c++) {
    let s = 1;
    if (densityVar > 0) {
      s = 1 + (cellHash(c, 0, seed) * 2 - 1) * densityVar * 0.6;
      s = Math.max(0.25, Math.min(2.5, s));
    }
    if (scaleVar > 0) {
      const sv = 1 + (cellHash(c + 1000, 0, seed) * 2 - 1) * scaleVar;
      s *= Math.max(0.5, Math.min(1.5, sv));
    }
    colScale[c] = s;
  }

  const defs = [];
  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">`
  );

  const globalTx = cfg.hFlip || cfg.vFlip || cfg.globalRotation
    ? buildGlobalTransform(w, h, cfg)
    : null;

  if (globalTx) parts.push(`<g transform="${globalTx}">`);

  parts.push(`<rect width="${w}" height="${h}" fill="${cfg.bgColor}"/>`);

  const zoneBuckets = {};
  const zoneCollect = {};
  for (let z = 0; z < cfg.numZones; z++) {
    zoneBuckets[z] = [];
    if (merge) zoneCollect[z] = [];
  }

  let rectCount = 0;
  let clipSeq = 0;

  for (let row = 0; row < cfg.rows; row++) {
    const rawZi = zoneMap[row];
    const zi = cfg.mirrorZones ? zoneMap[mirrorIdx(row, cfg.rows)] : rawZi;

    let rowColor;
    if (patternMode === "gradient" && cfg.numZones > 1) {
      const t = cfg.rows > 1 ? row / (cfg.rows - 1) : 0;
      const segLen = 1 / (cfg.numZones - 1);
      const seg = Math.min(Math.floor(t / segLen), cfg.numZones - 2);
      const lt = (t - seg * segLen) / segLen;
      rowColor = lerpColor(
        cfg.zonePalette[seg % cfg.zonePalette.length],
        cfg.zonePalette[(seg + 1) % cfg.zonePalette.length],
        lt
      );
    } else {
      rowColor = cfg.zonePalette[zi % cfg.zonePalette.length];
    }

    const invertRow = cfg.invertRows && (row % 2 === 1);
    const brickRow = patternMode === "brick" && row % 2 === 1;
    const brickShift = brickRow ? (colX[1] - colX[0]) / 2 : 0;

    const bucket = zoneBuckets[rawZi];
    const collect = merge ? zoneCollect[rawZi] : null;

    for (let col = 0; col < cfg.cols; col++) {
      const cellW = colX[col + 1] - colX[col] - gutter;
      const rY = rowY[row] + halfGut;
      const cellH = rowY[row + 1] - rowY[row] - gutter;
      if (cellW <= 0.01 || cellH <= 0.01) continue;

      const colorIdx = cfg.mirrorCols ? mirrorIdx(col, cfg.cols) : col;
      const colColor = cfg.colPalette[colorIdx % cfg.colPalette.length];

      // ── checkerboard: solid cells, no weave ──
      if (patternMode === "checkerboard") {
        const isEven = (col + row) % 2 === 0;
        const color = isEven ? colColor : rowColor;
        const altColor = isEven ? rowColor : colColor;
        const cX = colX[col] + halfGut;
        let clipId = "";
        if (fillShape === "diagonal") {
          clipId = `clip-${clipSeq++}`;
          defs.push(`<clipPath id="${clipId}"><rect x="${fmtN(cX)}" y="${fmtN(rY)}" width="${fmtN(cellW)}" height="${fmtN(cellH)}"/></clipPath>`);
        }
        rectCount += emitStripe(bucket, collect, fillShape, cX, rY, cellW, cellH, color, altColor, cfg, clipId);
        continue;
      }

      // ── weave colors ──
      const override = cellOverrides.get(`${col},${row}`);
      let warpColor = override?.warp || colColor;
      let weftColor = override?.weft || rowColor;
      if (cfg.swapAxis) { const t = warpColor; warpColor = weftColor; weftColor = t; }
      if (invertRow) { const t = warpColor; warpColor = weftColor; weftColor = t; }
      if (patternMode === "scatter") {
        const prob = (cfg.scatterProb || 50) / 100;
        if (cellHash(col, row, seed) > prob) { const t = warpColor; warpColor = weftColor; weftColor = t; }
      }

      // ── per-column stripe lattice (constant down the column) ──
      const scale = colScale[col];
      const evenH = baseEvenH * scale;
      const oddH = baseOddH * scale;
      const gapH = baseGapH * scale;
      const period = gapH > 0 ? evenH + gapH + oddH + gapH : evenH + oddH;
      if (period < 0.02) continue;

      let phase;
      if (patternMode === "wave") {
        const amp = cfg.waveAmplitude || 5;
        const freq = cfg.waveFrequency || 1;
        phase = amp * Math.sin(col * freq * Math.PI * 2 / cfg.cols);
      } else {
        phase = cfg.stripeOffset * col;
      }
      if (cfg.autoPhase && (col % 2 === 1)) phase += period / 2;

      const params = { evenH, oddH, gapH, period, phase };

      // ── brick offset: shift odd rows by half a cell, wrap across the seam ──
      const baseX = colX[col] + halfGut + brickShift;
      const segments = [];
      if (brickRow && baseX + cellW > w + 0.001) {
        const wA = w - baseX;
        if (wA > 0.01) segments.push([baseX, wA]);
        const wB = cellW - wA;
        if (wB > 0.01) segments.push([halfGut, wB]);
      } else {
        segments.push([brickRow ? baseX : colX[col] + halfGut, cellW]);
      }

      const needClip = fillShape === "diagonal" || cellRotation !== 0;
      for (const [sx, sw] of segments) {
        if (sw <= 0.01) continue;
        let clipId = "";
        if (needClip) {
          clipId = `clip-${clipSeq++}`;
          defs.push(`<clipPath id="${clipId}"><rect x="${fmtN(sx)}" y="${fmtN(rY)}" width="${fmtN(sw)}" height="${fmtN(cellH)}"/></clipPath>`);
        }
        let gAttrs = "";
        if (needClip) gAttrs += ` clip-path="url(#${clipId})"`;
        if (cellRotation !== 0) {
          const ccx = sx + sw / 2, ccy = rY + cellH / 2;
          gAttrs += ` transform="rotate(${cellRotation},${fmtN(ccx)},${fmtN(ccy)})"`;
        }
        if (gAttrs) bucket.push(`<g${gAttrs}>`);
        rectCount += drawCellStripes(bucket, collect, fillShape, sx, rY, sw, cellH, warpColor, weftColor, params, cfg, clipId);
        if (gAttrs) bucket.push("</g>");
      }
    }
  }

  // ── merge same-color shapes per zone into single outlines ──
  if (merge) {
    for (let z = 0; z < cfg.numZones; z++) zoneBuckets[z] = mergeZonePrimitives(zoneCollect[z], cfg);
  }

  if (defs.length > 0 && !merge) {
    parts.splice(1, 0, "<defs>" + defs.join("") + "</defs>");
  }

  for (let z = 0; z < cfg.numZones; z++) {
    if (zoneBuckets[z].length === 0) continue;
    parts.push(`<g id="Zone-${z + 1}">`);
    for (let i = 0; i < zoneBuckets[z].length; i++) parts.push(zoneBuckets[z][i]);
    parts.push("</g>");
  }

  if (globalTx) parts.push("</g>");
  parts.push("</svg>");
  return { svg: parts.join("\n"), rectCount };
}

function buildGlobalTransform(w, h, cfg) {
  const transforms = [];
  const rot = cfg.globalRotation || 0;
  if (rot) transforms.push(`rotate(${rot},${w / 2},${h / 2})`);
  if (cfg.hFlip) transforms.push(`translate(${w},0) scale(-1,1)`);
  if (cfg.vFlip) transforms.push(`translate(0,${h}) scale(1,-1)`);
  return transforms.join(" ");
}

/* ═══════════════ RENDER / DISPLAY ════════════════════════════════════ */

function resizePreview(cfg) {
  const { w, h } = getPaperDims(cfg || readConfig());
  const aspect = w / h;
  const wrap = document.getElementById("preview-wrap");
  const preview = document.getElementById("preview");
  const maxW = wrap.clientWidth * 0.88;
  const maxH = wrap.clientHeight * 0.92;
  let pw, ph;
  if (maxW / maxH > aspect) { ph = maxH; pw = ph * aspect; }
  else { pw = maxW; ph = pw / aspect; }
  preview.style.width = pw + "px";
  preview.style.height = ph + "px";
  applyPanZoom();
}

function applyPanZoom() {
  const preview = document.getElementById("preview");
  preview.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
  const zoomEl = document.getElementById("zoom-level");
  if (zoomEl) zoomEl.textContent = `${Math.round(zoomLevel * 100)}%`;
}

function runWithSeed(seed, opts = {}) {
  const bar = document.getElementById("status-bar");
  const txt = document.getElementById("status-text");
  bar.className = "generating";
  txt.textContent = opts.merge ? "merging\u2026" : "generating\u2026";

  requestAnimationFrame(() => {
    const rng = mulberry32(seed);
    const cfg = readConfig();
    // Live preview stays fast/unmerged; merge only when explicitly requested.
    if (!opts.merge) cfg.mergeShapes = false;
    const t0 = performance.now();
    const { svg, rectCount } = generateSVG(cfg, rng, seed);
    const ms = (performance.now() - t0).toFixed(0);

    const preview = document.getElementById("preview");
    const empty = document.getElementById("preview-empty");
    if (empty) empty.style.display = "none";
    preview.innerHTML = svg;
    resizePreview(cfg);

    bar.className = "done";
    const { w, h } = getPaperDims(cfg);
    txt.textContent = `${rectCount.toLocaleString()} shapes \u00b7 ${ms}ms \u00b7 ${w}\u00d7${h}mm`;
    document.getElementById("btn-export").disabled = false;
    const pngBtn = document.getElementById("btn-export-png");
    if (pngBtn) pngBtn.disabled = false;

    if (selectedCell) highlightSelectedCell();
    setupGridDragOverlay();
  });
}

function generate() {
  pushUndo();
  currentSeed = Math.floor(Math.random() * 0xffffffff);
  document.getElementById("seed-input").value = currentSeed.toString(16).toUpperCase();
  runWithSeed(currentSeed);
}

function regenerate() {
  if (currentSeed === 0) return;
  runWithSeed(currentSeed);
}

function previewMerged() {
  if (currentSeed === 0) return;
  runWithSeed(currentSeed, { merge: true });
}

let _debounceId = 0;
function debouncedRegenerate() {
  cancelAnimationFrame(_debounceId);
  _debounceId = requestAnimationFrame(regenerate);
}

function debouncedRegenerateWithUndo() {
  pushUndo();
  debouncedRegenerate();
}

/* ═══════════════ EXPORT ══════════════════════════════════════════════ */

/* Regenerate a fresh SVG element honoring the merge toggle (export path). */
function buildExportSvgEl() {
  const cfg = readConfig();
  const rng = mulberry32(currentSeed);
  const { svg } = generateSVG(cfg, rng, currentSeed);
  const tmp = document.createElement("div");
  tmp.innerHTML = svg;
  return { svgEl: tmp.querySelector("svg"), cfg };
}

function exportSVG() {
  if (currentSeed === 0) return;
  const { svgEl: clone, cfg } = buildExportSvgEl();
  if (!clone) return;
  const { w, h } = getPaperDims(cfg);

  clone.setAttribute("width", `${w}mm`);
  clone.setAttribute("height", `${h}mm`);
  clone.setAttribute("xmlns:inkscape", "http://www.inkscape.org/namespaces/inkscape");
  const INK = "http://www.inkscape.org/namespaces/inkscape";
  clone.querySelectorAll(":scope > g[id]").forEach((g) => {
    g.setAttributeNS(INK, "inkscape:groupmode", "layer");
    g.setAttributeNS(INK, "inkscape:label", g.getAttribute("id"));
  });

  const meta = `<!-- Woven Grid | seed:${currentSeed.toString(16)} | ${cfg.paperSize} ${w}x${h}mm | ${new Date().toISOString()} -->`;
  const svgStr =
    '<?xml version="1.0" encoding="UTF-8"?>\n' + meta + "\n" +
    new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `woven-grid-${cfg.paperSize}-${currentSeed.toString(16)}-${dateStr}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportPNG() {
  if (currentSeed === 0) return;
  const { svgEl, cfg } = buildExportSvgEl();
  if (!svgEl) return;
  const { w, h } = getPaperDims(cfg);
  const scale = 4;
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d");
  const svgStr = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((pngBlob) => {
      const pngUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement("a");
      a.href = pngUrl;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `woven-grid-${cfg.paperSize}-${currentSeed.toString(16)}-${dateStr}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(pngUrl);
    }, "image/png");
  };
  img.src = url;
}

/* ═══════════════ PALETTE UI ══════════════════════════════════════════ */

function buildColPalette(forcePreset) {
  const n = +document.getElementById("num-col-colors").value;
  const container = document.getElementById("col-palette");
  const preset = PRESETS[currentPreset];
  const existing = [...document.querySelectorAll(".col-color-pick")].map((e) => e.value);
  container.innerHTML = "";

  for (let i = 0; i < n; i++) {
    const div = document.createElement("div");
    div.className = "palette-swatch";
    const input = document.createElement("input");
    input.type = "color";
    input.className = "col-color-pick";
    input.value = forcePreset || !existing[i]
      ? preset.cols[i % preset.cols.length]
      : existing[i];
    input.addEventListener("input", debouncedRegenerate);
    const lbl = document.createElement("span");
    lbl.className = "swatch-label";
    lbl.textContent = "C" + (i + 1);
    div.append(input, lbl);
    container.appendChild(div);
  }
}

function buildZonePalette(forcePreset) {
  const n = +document.getElementById("num-zones").value;
  const container = document.getElementById("zone-palette");
  const preset = PRESETS[currentPreset];
  const existing = [...document.querySelectorAll(".zone-color-pick")].map((e) => e.value);
  container.innerHTML = "";

  for (let i = 0; i < n; i++) {
    const div = document.createElement("div");
    div.className = "palette-swatch";
    const input = document.createElement("input");
    input.type = "color";
    input.className = "zone-color-pick";
    input.value = forcePreset || !existing[i]
      ? preset.zones[i % preset.zones.length]
      : existing[i];
    input.addEventListener("input", debouncedRegenerate);
    const lbl = document.createElement("span");
    lbl.className = "swatch-label";
    lbl.textContent = "Z" + (i + 1);
    div.append(input, lbl);
    container.appendChild(div);
  }
}

function applyPreset(name) {
  pushUndo();
  currentPreset = name;
  const p = PRESETS[name];
  if (!p) return;
  document.getElementById("bg-color").value = p.bg;

  const colEl = document.getElementById("num-col-colors");
  colEl.value = p.cols.length;
  document.getElementById("val-num-col-colors").textContent = p.cols.length;

  const zoneEl = document.getElementById("num-zones");
  zoneEl.value = p.zones.length;
  document.getElementById("val-num-zones").textContent = p.zones.length;

  buildColPalette(true);
  buildZonePalette(true);
  regenerate();
}

/* ═══════════════ USER PRESETS (localStorage) ═════════════════════════ */

function getUserPresets() {
  try { return JSON.parse(localStorage.getItem(USER_PRESETS_KEY)) || {}; } catch { return {}; }
}

function saveUserPreset() {
  const name = prompt("Preset name:");
  if (!name || !name.trim()) return;
  const presets = getUserPresets();
  presets[name.trim()] = configSnapshot();
  localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets));
  rebuildPresetDropdown();
}

function deleteUserPreset(name) {
  const presets = getUserPresets();
  delete presets[name];
  localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets));
  rebuildPresetDropdown();
}

function rebuildPresetDropdown() {
  const sel = document.getElementById("preset");
  sel.querySelectorAll("optgroup.user-presets").forEach((g) => g.remove());
  const presets = getUserPresets();
  const keys = Object.keys(presets);
  if (keys.length === 0) return;
  const grp = document.createElement("optgroup");
  grp.label = "My Presets";
  grp.className = "user-presets";
  keys.forEach((k) => {
    const opt = document.createElement("option");
    opt.value = "_user_" + k;
    opt.textContent = k;
    grp.appendChild(opt);
  });
  sel.prepend(grp);
}

function loadUserPreset(name) {
  const presets = getUserPresets();
  const snap = presets[name];
  if (!snap) return;
  pushUndo();
  restoreSnapshot(snap);
  runWithSeed(currentSeed);
}

/* ═══════════════ SURPRISE ME ═════════════════════════════════════════ */

function surpriseMe() {
  pushUndo();
  const rng = mulberry32(Math.floor(Math.random() * 0xffffffff));

  const randomize = (id, mn, mx, step) => {
    if (lockedParams.has(id)) return;
    const el = document.getElementById(id);
    if (!el) return;
    const min = mn !== undefined ? mn : +el.min;
    const max = mx !== undefined ? mx : +el.max;
    const s = step || +el.step || 1;
    const steps = Math.floor((max - min) / s);
    const val = min + Math.floor(rng() * (steps + 1)) * s;
    el.value = val;
  };

  randomize("cols", 3, 30);
  randomize("rows", 3, 40);
  randomize("width-var", 0, 80);
  randomize("height-var", 0, 80);
  randomize("cell-gutter", 0, 2, 0.1);
  randomize("stripe-height", 0.3, 8, 0.1);
  randomize("gap-height", 0, 3, 0.1);
  randomize("stripe-offset", 0, 5, 0.1);
  randomize("warp-weight", 20, 80);
  randomize("density-var", 0, 60);
  randomize("opacity", 40, 100);

  if (!lockedParams.has("invert-rows")) document.getElementById("invert-rows").checked = rng() > 0.5;
  if (!lockedParams.has("auto-phase")) document.getElementById("auto-phase").checked = rng() > 0.5;
  if (!lockedParams.has("mirror-cols")) document.getElementById("mirror-cols").checked = rng() > 0.6;
  if (!lockedParams.has("mirror-zones")) document.getElementById("mirror-zones").checked = rng() > 0.6;

  const shapes = ["rect", "roundRect", "circle", "diamond", "triangle", "chevron"];
  if (!lockedParams.has("fill-shape")) {
    document.getElementById("fill-shape").value = shapes[Math.floor(rng() * shapes.length)];
    updateShapeVisibility();
  }

  const presetKeys = Object.keys(PRESETS);
  if (!lockedParams.has("preset")) {
    const pk = presetKeys[Math.floor(rng() * presetKeys.length)];
    document.getElementById("preset").value = pk;
    applyPreset(pk);
    return;
  }

  refreshAllSliderDisplays();
  generate();
}

/* ═══════════════ INTERACTIVE CANVAS ══════════════════════════════════ */

function setupCanvasInteraction() {
  const wrap = document.getElementById("preview-wrap");

  wrap.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoomLevel = Math.max(0.1, Math.min(10, zoomLevel * delta));
    applyPanZoom();
  }, { passive: false });

  wrap.addEventListener("mousedown", (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panStartPX = panX;
      panStartPY = panY;
      wrap.style.cursor = "grabbing";
      e.preventDefault();
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (isPanning) {
      panX = panStartPX + (e.clientX - panStartX);
      panY = panStartPY + (e.clientY - panStartY);
      applyPanZoom();
    }
    handleGridDragMove(e);
  });

  window.addEventListener("mouseup", () => {
    if (isPanning) {
      isPanning = false;
      document.getElementById("preview-wrap").style.cursor = "";
    }
    handleGridDragEnd();
  });

  wrap.addEventListener("dblclick", () => {
    panX = 0;
    panY = 0;
    zoomLevel = 1;
    applyPanZoom();
  });

  wrap.addEventListener("click", (e) => {
    if (isPanning) return;
    handleCellClick(e);
  });
}

function handleCellClick(e) {
  const svgEl = document.querySelector("#preview svg");
  if (!svgEl) return;

  const cfg = readConfig();
  const { w, h } = getPaperDims(cfg);
  const rect = svgEl.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / rect.width) * w;
  const my = ((e.clientY - rect.top) / rect.height) * h;

  const rng = mulberry32(currentSeed);
  const { colX, rowY } = generateDimensions(cfg, rng);

  let hitCol = -1, hitRow = -1;
  for (let c = 0; c < cfg.cols; c++) {
    if (mx >= colX[c] && mx < colX[c + 1]) { hitCol = c; break; }
  }
  for (let r = 0; r < cfg.rows; r++) {
    if (my >= rowY[r] && my < rowY[r + 1]) { hitRow = r; break; }
  }

  if (hitCol >= 0 && hitRow >= 0) {
    selectedCell = { col: hitCol, row: hitRow };
    showCellOverridePanel(hitCol, hitRow);
    highlightSelectedCell();
  } else {
    selectedCell = null;
    hideCellOverridePanel();
  }
}

function highlightSelectedCell() {
  document.querySelectorAll(".cell-highlight").forEach((el) => el.remove());
  if (!selectedCell) return;

  const svgEl = document.querySelector("#preview svg");
  if (!svgEl) return;
  const cfg = readConfig();
  const rng = mulberry32(currentSeed);
  const { colX, rowY } = generateDimensions(cfg, rng);
  const { col, row } = selectedCell;
  const gutter = cfg.cellGutter || 0;

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", colX[col] + gutter / 2);
  rect.setAttribute("y", rowY[row] + gutter / 2);
  rect.setAttribute("width", colX[col + 1] - colX[col] - gutter);
  rect.setAttribute("height", rowY[row + 1] - rowY[row] - gutter);
  rect.setAttribute("fill", "none");
  rect.setAttribute("stroke", "#ff00ff");
  rect.setAttribute("stroke-width", "0.5");
  rect.setAttribute("stroke-dasharray", "1,1");
  rect.setAttribute("class", "cell-highlight");
  rect.setAttribute("pointer-events", "none");
  svgEl.appendChild(rect);
}

function showCellOverridePanel(col, row) {
  const panel = document.getElementById("cell-override-panel");
  if (!panel) return;
  panel.style.display = "block";
  panel.querySelector(".cell-label").textContent = `Cell (${col + 1}, ${row + 1})`;

  const key = `${col},${row}`;
  const existing = cellOverrides.get(key);

  const warpPick = panel.querySelector("#cell-warp-color");
  const weftPick = panel.querySelector("#cell-weft-color");
  if (existing) {
    warpPick.value = existing.warp || "#ffffff";
    weftPick.value = existing.weft || "#ffffff";
  }

  warpPick.onchange = weftPick.onchange = () => {
    cellOverrides.set(key, { warp: warpPick.value, weft: weftPick.value });
    debouncedRegenerate();
  };

  const clearBtn = panel.querySelector("#btn-clear-cell");
  clearBtn.onclick = () => {
    cellOverrides.delete(key);
    selectedCell = null;
    hideCellOverridePanel();
    debouncedRegenerate();
  };
}

function hideCellOverridePanel() {
  const panel = document.getElementById("cell-override-panel");
  if (panel) panel.style.display = "none";
  document.querySelectorAll(".cell-highlight").forEach((el) => el.remove());
}

/* ═══════════════ GRID LINE DRAGGING ══════════════════════════════════ */

function setupGridDragOverlay() {
  const svgEl = document.querySelector("#preview svg");
  if (!svgEl) return;

  document.querySelectorAll(".grid-drag-handle").forEach((el) => el.remove());

  const cfg = readConfig();
  const { w, h } = getPaperDims(cfg);
  const rng = mulberry32(currentSeed);
  const { colX, rowY, rawW, rawH } = generateDimensions(cfg, rng);

  const rect = svgEl.getBoundingClientRect();
  const scaleX = rect.width / w;
  const scaleY = rect.height / h;

  for (let c = 1; c < cfg.cols; c++) {
    const handle = document.createElementNS("http://www.w3.org/2000/svg", "line");
    handle.setAttribute("x1", colX[c]);
    handle.setAttribute("y1", 0);
    handle.setAttribute("x2", colX[c]);
    handle.setAttribute("y2", h);
    handle.setAttribute("stroke", "transparent");
    handle.setAttribute("stroke-width", Math.max(0.8, w / cfg.cols * 0.08));
    handle.setAttribute("class", "grid-drag-handle grid-drag-col");
    handle.setAttribute("data-index", c);
    handle.style.cursor = "col-resize";
    handle.style.pointerEvents = "stroke";
    svgEl.appendChild(handle);

    handle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      isDraggingGrid = true;
      dragType = "col";
      dragIndex = c;
      dragStartPos = e.clientX;
      dragStartVal = colX[c];
      handle.setAttribute("stroke", "rgba(200,255,0,0.5)");
      handle.setAttribute("stroke-dasharray", "2,2");
    });
  }

  for (let r = 1; r < cfg.rows; r++) {
    const handle = document.createElementNS("http://www.w3.org/2000/svg", "line");
    handle.setAttribute("x1", 0);
    handle.setAttribute("y1", rowY[r]);
    handle.setAttribute("x2", w);
    handle.setAttribute("y2", rowY[r]);
    handle.setAttribute("stroke", "transparent");
    handle.setAttribute("stroke-width", Math.max(0.8, h / cfg.rows * 0.08));
    handle.setAttribute("class", "grid-drag-handle grid-drag-row");
    handle.setAttribute("data-index", r);
    handle.style.cursor = "row-resize";
    handle.style.pointerEvents = "stroke";
    svgEl.appendChild(handle);

    handle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      isDraggingGrid = true;
      dragType = "row";
      dragIndex = r;
      dragStartPos = e.clientY;
      dragStartVal = rowY[r];
      handle.setAttribute("stroke", "rgba(200,255,0,0.5)");
      handle.setAttribute("stroke-dasharray", "2,2");
    });
  }
}

function handleGridDragMove(e) {
  if (!isDraggingGrid) return;
  const svgEl = document.querySelector("#preview svg");
  if (!svgEl) return;

  const cfg = readConfig();
  const { w, h } = getPaperDims(cfg);
  const rect = svgEl.getBoundingClientRect();

  if (dragType === "col") {
    const delta = (e.clientX - dragStartPos) / rect.width * w;
    const newPos = dragStartVal + delta;
    const rng = mulberry32(currentSeed);
    const { colX, rawW } = generateDimensions(cfg, rng);

    const leftW = newPos - colX[dragIndex - 1];
    const rightW = colX[dragIndex + 1] - newPos;
    if (leftW > 0.5 && rightW > 0.5) {
      const sumW = rawW.reduce((a, b) => a + b, 0);
      manualColWidths[dragIndex - 1] = (leftW / w) * sumW;
      manualColWidths[dragIndex] = (rightW / w) * sumW;

      const handle = svgEl.querySelector(`.grid-drag-col[data-index="${dragIndex}"]`);
      if (handle) {
        handle.setAttribute("x1", newPos);
        handle.setAttribute("x2", newPos);
      }
    }
  } else if (dragType === "row") {
    const delta = (e.clientY - dragStartPos) / rect.height * h;
    const newPos = dragStartVal + delta;
    const rng = mulberry32(currentSeed);
    const { rowY, rawH } = generateDimensions(cfg, rng);

    const topH = newPos - rowY[dragIndex - 1];
    const botH = rowY[dragIndex + 1] - newPos;
    if (topH > 0.5 && botH > 0.5) {
      const sumH = rawH.reduce((a, b) => a + b, 0);
      manualRowHeights[dragIndex - 1] = (topH / h) * sumH;
      manualRowHeights[dragIndex] = (botH / h) * sumH;

      const handle = svgEl.querySelector(`.grid-drag-row[data-index="${dragIndex}"]`);
      if (handle) {
        handle.setAttribute("y1", newPos);
        handle.setAttribute("y2", newPos);
      }
    }
  }
}

function handleGridDragEnd() {
  if (!isDraggingGrid) return;
  isDraggingGrid = false;

  document.querySelectorAll(".grid-drag-handle").forEach((h) => {
    h.setAttribute("stroke", "transparent");
    h.removeAttribute("stroke-dasharray");
  });

  debouncedRegenerate();
}

/* ═══════════════ LOCK ICONS ══════════════════════════════════════════ */

function addLockIcons() {
  const lockable = [
    "cols", "rows", "width-var", "height-var", "cell-gutter",
    "stripe-height", "gap-height", "stripe-offset", "warp-weight",
    "density-var", "opacity", "fill-shape", "preset",
  ];

  lockable.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const label = el.closest(".control-row, .checkbox-row")?.querySelector(".control-label");
    if (!label) return;
    if (label.querySelector(".lock-btn")) return;

    const btn = document.createElement("button");
    btn.className = "lock-btn";
    btn.dataset.lockFor = id;
    btn.textContent = "\uD83D\uDD13";
    btn.title = "Lock for Surprise Me";
    label.appendChild(btn);
  });
}

/* ═══════════════ UI VISIBILITY ═══════════════════════════════════════ */

function updateShapeVisibility() {
  const shape = document.getElementById("fill-shape").value;
  document.querySelectorAll(".shape-opt").forEach((el) => {
    el.style.display = el.dataset.showShape === shape ? "" : "none";
  });
}

function updatePatternVisibility() {
  const mode = document.getElementById("pattern-mode")?.value || "classic";
  document.querySelectorAll(".pattern-opt").forEach((el) => {
    el.style.display = el.dataset.showPattern === mode ? "" : "none";
  });
}

function updateCustomPaperVisibility() {
  const isCustom = document.getElementById("paper-size").value === "custom";
  document.querySelectorAll(".custom-paper-row").forEach((el) => {
    el.style.display = isCustom ? "" : "none";
  });
}

/* ═══════════════ UI WIRING ═══════════════════════════════════════════ */

function updateSliderDisplay(slider) {
  const valEl = document.getElementById("val-" + slider.id);
  if (!valEl) return;
  let v = slider.value;
  if (slider.id === "width-var" || slider.id === "height-var" || slider.id === "density-var" || slider.id === "opacity" || slider.id === "scatter-prob" || slider.id === "scale-var") v += "%";
  else if (slider.id === "diagonal-angle") v += "\u00b0";
  else if (slider.id === "cell-rotation") v += "\u00b0";
  valEl.textContent = v;
}

function refreshAllSliderDisplays() {
  document.querySelectorAll('input[type="range"]').forEach(updateSliderDisplay);
}

function wireSliders() {
  document.querySelectorAll('input[type="range"]').forEach((slider) => {
    updateSliderDisplay(slider);
    slider.addEventListener("input", () => updateSliderDisplay(slider));
  });
}

function wireSections() {
  document.querySelectorAll(".section-header").forEach((hdr) => {
    hdr.addEventListener("click", () => hdr.parentElement.classList.toggle("collapsed"));
  });
}

function wireLockButtons() {
  document.querySelectorAll(".lock-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const paramId = btn.dataset.lockFor;
      if (lockedParams.has(paramId)) {
        lockedParams.delete(paramId);
        btn.classList.remove("locked");
        btn.textContent = "\uD83D\uDD13";
      } else {
        lockedParams.add(paramId);
        btn.classList.add("locked");
        btn.textContent = "\uD83D\uDD12";
      }
    });
  });
}

function wireEvents() {
  document.getElementById("btn-generate").addEventListener("click", generate);
  document.getElementById("btn-export").addEventListener("click", exportSVG);
  document.getElementById("btn-export-png")?.addEventListener("click", exportPNG);
  document.getElementById("btn-randomize").addEventListener("click", generate);
  document.getElementById("btn-apply-seed").addEventListener("click", applySeed);
  document.getElementById("btn-undo")?.addEventListener("click", undo);
  document.getElementById("btn-redo")?.addEventListener("click", redo);
  document.getElementById("btn-surprise")?.addEventListener("click", surpriseMe);
  document.getElementById("btn-save-preset")?.addEventListener("click", saveUserPreset);
  document.getElementById("btn-preview-merge")?.addEventListener("click", previewMerged);
  document.getElementById("btn-reset-layout")?.addEventListener("click", () => {
    Object.keys(manualColWidths).forEach((k) => delete manualColWidths[k]);
    Object.keys(manualRowHeights).forEach((k) => delete manualRowHeights[k]);
    debouncedRegenerate();
  });
  document.getElementById("btn-clear-overrides")?.addEventListener("click", () => {
    cellOverrides.clear();
    selectedCell = null;
    hideCellOverridePanel();
    debouncedRegenerate();
  });
  document.getElementById("btn-zoom-fit")?.addEventListener("click", () => {
    panX = 0; panY = 0; zoomLevel = 1;
    applyPanZoom();
  });

  document.getElementById("seed-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") applySeed();
  });

  document.getElementById("preset").addEventListener("change", (e) => {
    const val = e.target.value;
    if (val.startsWith("_user_")) {
      loadUserPreset(val.slice(6));
    } else {
      applyPreset(val);
    }
  });

  document.getElementById("fill-shape").addEventListener("change", () => {
    updateShapeVisibility();
    debouncedRegenerate();
  });

  document.getElementById("pattern-mode")?.addEventListener("change", () => {
    updatePatternVisibility();
    debouncedRegenerate();
  });

  document.getElementById("paper-size").addEventListener("change", () => {
    updateCustomPaperVisibility();
    debouncedRegenerate();
  });

  document.getElementById("num-col-colors").addEventListener("input", () => {
    buildColPalette(false);
    debouncedRegenerate();
  });
  document.getElementById("num-zones").addEventListener("input", () => {
    buildZonePalette(false);
    debouncedRegenerate();
  });

  const liveIds = [
    "cols", "rows", "width-var", "height-var", "cell-gutter",
    "stripe-height", "gap-height", "stripe-offset", "warp-weight",
    "invert-rows", "auto-phase", "mirror-cols", "mirror-zones", "density-var",
    "swap-axis", "bg-color", "corner-radius", "diagonal-angle",
    "paper-size", "orientation", "custom-paper-w", "custom-paper-h",
    "pattern-mode", "wave-amplitude", "wave-frequency", "scatter-prob",
    "opacity", "enable-stroke", "stroke-width", "stroke-color",
    "cell-rotation", "scale-var", "global-rotation", "h-flip", "v-flip",
  ];
  liveIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", debouncedRegenerate);
    el.addEventListener("change", debouncedRegenerate);
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" && (e.target.type === "text" || e.target.type === "number")) return;
    if (e.code === "Space") { e.preventDefault(); generate(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); exportSVG(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "Z") { e.preventDefault(); redo(); }
  });

  window.addEventListener("resize", () => resizePreview());
}

function applySeed() {
  const raw = document.getElementById("seed-input").value.trim();
  const parsed = parseInt(raw, 16);
  if (!isNaN(parsed) && parsed >= 0) {
    pushUndo();
    currentSeed = parsed;
    runWithSeed(currentSeed);
  }
}

/* ═══════════════ INIT ════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  wireSliders();
  wireSections();
  addLockIcons();
  wireLockButtons();
  buildColPalette(true);
  buildZonePalette(true);
  wireEvents();
  updateShapeVisibility();
  updatePatternVisibility();
  updateCustomPaperVisibility();
  rebuildPresetDropdown();
  setupCanvasInteraction();
  updateUndoButtons();
  generate();
});

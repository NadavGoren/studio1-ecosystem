/* Manual glyph editor for the single-line Hebrew font.
   Edit a glyph's centerline (drag/add/delete points & strokes) over Miriam's real
   outline. Edits save to localStorage as overrides (apply to both variants and
   instantly in the generator) and can be exported to a file for permanence. */

const FONTS = window.HEBREW_FONTS;
const OUT = window.HEBREW_OUTLINES || {};
const BASE = FONTS.clean;               // edit from the clean variant (tidy, meaningful strokes)
const KEY = "hhg_overrides_v1";
const TOP = 900, BOT = -340;            // display flip band (font units, y-up)
const HANDLE_R = 13, HIT = 55;          // handle radius / pick threshold (font units)

const svg = document.getElementById("edit");
const palette = document.getElementById("palette");
const statusEl = document.getElementById("status");

let overrides = loadOverrides();
let cur = "א";
let strokes = [];                       // working copy, font units y-up
let advance = 0;
let history = [];
let selected = null;                    // selected stroke index
let penMode = false, penStroke = null;
let drag = null;                        // {si, pi}
let raf = 0;

const round = n => Math.round(n * 10) / 10;
const clone = s => s.map(p => p.slice());
const cloneAll = ss => ss.map(clone);

function loadOverrides() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }

const HAS_SERVER = location.protocol.startsWith("http");   // served by server.py?
let serverSaved = false, saveTimer = 0;
function saveToServer() {
  if (!HAS_SERVER) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch("/api/overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(overrides) })
      .then(r => { if (r.ok) { serverSaved = true; updateStatus(); } }).catch(() => {});
  }, 250);                                                 // debounce rapid drags
}
function persist() {
  if (strokes.length) overrides[cur] = { advance, strokes: strokes.map(s => s.map(p => [round(p[0]), round(p[1])])) };
  else delete overrides[cur];
  localStorage.setItem(KEY, JSON.stringify(overrides));
  serverSaved = false;
  saveToServer();
  markPalette();
  updateStatus();
}

// ── glyph load ──────────────────────────────────────────────────────────────
function loadChar(ch) {
  commitPen(true);
  cur = ch; selected = null; history = [];
  const o = overrides[ch];
  const g = BASE.glyphs[ch] || { advance: 500, strokes: [] };
  advance = o && o.advance != null ? o.advance : g.advance;
  strokes = cloneAll(o ? o.strokes : g.strokes);
  render(); updateStatus(); markPalette();
}
function resetGlyph() {
  delete overrides[cur];
  localStorage.setItem(KEY, JSON.stringify(overrides));
  serverSaved = false; saveToServer();
  loadChar(cur);
}

function pushHistory() { history.push(cloneAll(strokes)); if (history.length > 80) history.shift(); }
function undo() { if (history.length) { strokes = history.pop(); selected = null; render(); persist(); } }

// ── coordinate mapping (font units <-> display) ─────────────────────────────
const toDisp = p => [p[0], TOP - p[1]];
function mouseFont(e) {
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const u = pt.matrixTransform(svg.getScreenCTM().inverse());
  return [u.x, TOP - u.y];
}

// ── render ──────────────────────────────────────────────────────────────────
function render() {
  const minX = -150, w = advance + 300, h = TOP - BOT;
  svg.setAttribute("viewBox", `${minX} 0 ${w} ${h}`);
  const gy = y => TOP - y;
  let s = "";
  s += `<line class="bearing" x1="0" y1="0" x2="0" y2="${h}"/>`;
  s += `<line class="bearing" x1="${advance}" y1="0" x2="${advance}" y2="${h}"/>`;
  s += `<line class="baseline" x1="${minX}" y1="${gy(0)}" x2="${minX + w}" y2="${gy(0)}"/>`;

  const contours = OUT[cur] || [];
  if (contours.length) {
    const d = contours.map(c => "M" + c.map(p => { const q = toDisp(p); return `${q[0]},${q[1]}`; }).join("L") + "Z").join(" ");
    s += `<path class="outline" d="${d}"/>`;
  }
  strokes.forEach((st, si) => {
    const sel = si === selected ? " sel" : "";
    if (st.length === 1) { const q = toDisp(st[0]); s += `<circle class="dab${sel}" data-si="${si}" cx="${q[0]}" cy="${q[1]}" r="15"/>`; }
    else { const pts = st.map(p => { const q = toDisp(p); return `${q[0]},${q[1]}`; }).join(" "); s += `<polyline class="stroke${sel}" data-si="${si}" points="${pts}"/>`; }
  });
  if (penStroke && penStroke.length) {
    const pts = penStroke.map(p => { const q = toDisp(p); return `${q[0]},${q[1]}`; }).join(" ");
    if (penStroke.length > 1) s += `<polyline class="pen" points="${pts}"/>`;
    penStroke.forEach(p => { const q = toDisp(p); s += `<circle class="penpt" cx="${q[0]}" cy="${q[1]}" r="9"/>`; });
  }
  strokes.forEach((st, si) => st.forEach((p, pi) => {
    const q = toDisp(p), end = pi === 0 || pi === st.length - 1;
    s += `<circle class="h${end ? " end" : ""}" data-si="${si}" data-pi="${pi}" cx="${q[0]}" cy="${q[1]}" r="${HANDLE_R}"/>`;
  }));
  svg.innerHTML = s;
}

function updateStatus() {
  const np = strokes.reduce((a, st) => a + st.length, 0);
  const tag = overrides[cur] ? "מתוקן ✓" : "אוטומטי";
  const save = HAS_SERVER ? (serverSaved ? " · נשמר לקובץ ✓" : "") : " · (מקומי בלבד)";
  statusEl.textContent = `אות "${cur}" · ${strokes.length} קווים · ${np} נקודות · ${tag}${save}`;
}

// ── palette ─────────────────────────────────────────────────────────────────
function buildPalette() {
  palette.innerHTML = "";
  Object.keys(BASE.glyphs).forEach(ch => {
    if (ch === " ") return;
    const b = document.createElement("button");
    b.textContent = ch; b.dataset.ch = ch;
    b.addEventListener("click", () => loadChar(ch));
    palette.appendChild(b);
  });
  markPalette();
}
function markPalette() {
  [...palette.children].forEach(b => {
    b.classList.toggle("ov", !!overrides[b.dataset.ch]);
    b.classList.toggle("cur", b.dataset.ch === cur);
  });
}

// ── pen (add stroke) ────────────────────────────────────────────────────────
function startPen() { commitPen(true); penMode = true; penStroke = []; selected = null; setPenUI(); render(); }
function commitPen(silent) {
  if (penStroke && penStroke.length) { pushHistory(); strokes.push(penStroke.slice()); persist(); }
  penStroke = null; penMode = false; setPenUI();
  if (!silent) render();
}
function setPenUI() {
  const b = document.getElementById("btn-add");
  b.classList.toggle("on", penMode);
  b.textContent = penMode ? "✓ סיום קו" : "+ קו חדש";
  svg.style.cursor = penMode ? "crosshair" : "default";
}

// ── geometry ────────────────────────────────────────────────────────────────
function segDist(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1], wx = p[0] - a[0], wy = p[1] - a[1];
  const c1 = vx * wx + vy * wy; if (c1 <= 0) return Math.hypot(wx, wy);
  const c2 = vx * vx + vy * vy; if (c2 <= c1) return Math.hypot(p[0] - b[0], p[1] - b[1]);
  const t = c1 / c2; return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy));
}

// ── interaction ─────────────────────────────────────────────────────────────
svg.addEventListener("pointerdown", e => {
  const t = e.target;
  if (penMode) { const p = mouseFont(e); penStroke.push([round(p[0]), round(p[1])]); render(); return; }
  if (t.classList.contains("h") || t.classList.contains("dab")) {
    const si = +t.dataset.si, pi = t.dataset.pi != null ? +t.dataset.pi : 0;
    if (e.altKey) {
      pushHistory();
      if (t.classList.contains("dab")) strokes.splice(si, 1);
      else { strokes[si].splice(pi, 1); if (strokes[si].length === 0) strokes.splice(si, 1); }
      selected = null; render(); persist(); return;
    }
    pushHistory(); drag = { si, pi }; try { svg.setPointerCapture(e.pointerId); } catch (_) {} return;
  }
  if (t.classList.contains("stroke")) { selected = +t.dataset.si; render(); updateStatus(); return; }
  selected = null; render();
});

svg.addEventListener("pointermove", e => {
  if (!drag) return;
  const p = mouseFont(e); strokes[drag.si][drag.pi] = [round(p[0]), round(p[1])];
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); });
});
svg.addEventListener("pointerup", () => { if (drag) { drag = null; persist(); render(); } });

svg.addEventListener("dblclick", e => {
  if (penMode) return;
  const p = mouseFont(e); let best = null;
  strokes.forEach((st, si) => { for (let i = 0; i < st.length - 1; i++) { const d = segDist(p, st[i], st[i + 1]); if (!best || d < best.d) best = { d, si, i }; } });
  if (best && best.d < HIT) { pushHistory(); strokes[best.si].splice(best.i + 1, 0, [round(p[0]), round(p[1])]); render(); persist(); }
});

window.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT") return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
  if (e.key === "Enter") { commitPen(false); return; }
  if (e.key === "Escape") { if (penMode) { penMode = false; penStroke = null; setPenUI(); render(); } else { selected = null; render(); } return; }
  if (e.key === "Delete" || e.key === "Backspace") {
    if (selected != null) { e.preventDefault(); pushHistory(); strokes.splice(selected, 1); selected = null; render(); persist(); }
  }
});

// ── buttons / file ──────────────────────────────────────────────────────────
document.getElementById("btn-add").addEventListener("click", () => { if (penMode) commitPen(false); else startPen(); });
document.getElementById("btn-del").addEventListener("click", () => {
  if (selected != null) { pushHistory(); strokes.splice(selected, 1); selected = null; render(); persist(); }
});
document.getElementById("btn-undo").addEventListener("click", undo);
document.getElementById("btn-reset").addEventListener("click", () => {
  if (confirm(`לאפס את האות "${cur}" לגרסה האוטומטית?`)) resetGlyph();
});
document.getElementById("btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(overrides, null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "overrides.json"; a.click();
  URL.revokeObjectURL(url);
});
document.getElementById("imp").addEventListener("change", e => {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const o = JSON.parse(r.result);
      overrides = Object.assign(overrides, o);
      localStorage.setItem(KEY, JSON.stringify(overrides));
      serverSaved = false; saveToServer();
      loadChar(cur);
    } catch (_) { alert("קובץ לא תקין"); }
  };
  r.readAsText(file); e.target.value = "";
});

buildPalette();
loadChar("א");
if (HAS_SERVER) {                                          // disk is the source of truth
  fetch("/api/overrides", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(o => {
    if (o) { overrides = o; localStorage.setItem(KEY, JSON.stringify(o)); markPalette(); loadChar(cur); }
  }).catch(() => {});
}

/* Hebrew single-line (Hershey) text generator.
   Lays out text from the embedded centerline font into a stroke-only A-series SVG
   for Nadav's iDraw pen plotters. RTL base direction with LTR digit/latin runs,
   niqqud overlaid (re-centered) on their base letter. The on-screen SVG is the export. */

const FONTS = window.HEBREW_FONTS;
const UPM = 1000;

const SIZES = {
  A3: { portrait: { w: 297, h: 420 }, landscape: { w: 420, h: 297 } },
  A2: { portrait: { w: 420, h: 594 }, landscape: { w: 594, h: 420 } },
};

const state = {
  text: "", variant: "faithful", fontSize: 14, letterSpacing: 0, lineSpacing: 1.5,
  align: "right", size: "A3", orientation: "portrait", margin: 15, strokeWidth: 0.4,
};

const artboard = document.getElementById("artboard");
const f = n => Math.round(n * 100) / 100;          // 2-dp for compact SVG

// ── character classification ───────────────────────────────────────────────
function cp(ch) { return ch.codePointAt(0); }
function isCombining(ch) {
  const c = cp(ch);
  return (c >= 0x0591 && c <= 0x05BD) || c === 0x05BF ||
         c === 0x05C1 || c === 0x05C2 || c === 0x05C4 || c === 0x05C5 || c === 0x05C7;
}
function strongDir(ch) {
  const c = cp(ch);
  if (c >= 0x0590 && c <= 0x05FF) return "R";                       // Hebrew
  if ((c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)) return "L";
  return "N";                                                        // neutral
}

// ── bidi-lite: clusters → visual order (base dir RTL, LTR runs kept L→R) ─────
function toClusters(line) {
  const out = [];
  for (const ch of line) {
    if (isCombining(ch) && out.length) out[out.length - 1].marks.push(ch);
    else out.push({ base: ch, marks: [] });
  }
  return out;
}
function resolveDirs(cls) {
  const d = cls.map(c => strongDir(c.base));
  let prev = null;                                  // forward-fill neutrals
  for (let i = 0; i < d.length; i++) { if (d[i] === "N") d[i] = prev || "N"; else prev = d[i]; }
  let next = "R";                                   // backfill leading neutrals
  for (let i = d.length - 1; i >= 0; i--) { if (d[i] === "N") d[i] = next; else next = d[i]; }
  return d.map(x => (x === "L" ? "L" : "R"));
}
function visualOrder(cls) {
  if (!cls.length) return [];
  const d = resolveDirs(cls);
  const runs = [];
  for (let i = 0; i < cls.length;) {
    let j = i; while (j < cls.length && d[j] === d[i]) j++;
    runs.push({ dir: d[i], items: cls.slice(i, j) }); i = j;
  }
  const vis = [];
  for (let k = runs.length - 1; k >= 0; k--) {       // RTL: reverse run order
    const r = runs[k];
    vis.push(...(r.dir === "R" ? r.items.slice().reverse() : r.items));
  }
  return vis;
}

// ── geometry helpers ────────────────────────────────────────────────────────
let OVERRIDES = {};                                  // hand-edits from editor.html
try { OVERRIDES = JSON.parse(localStorage.getItem("hhg_overrides_v1") || "{}"); } catch (e) {}
function glyph(font, ch) { return OVERRIDES[ch] || font.glyphs[ch]; }
if (location.protocol.startsWith("http")) {          // refresh from font/overrides.json on disk
  fetch("/api/overrides", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(o => {
    if (o) { OVERRIDES = o; localStorage.setItem("hhg_overrides_v1", JSON.stringify(o)); schedule(); }
  }).catch(() => {});
}
function bboxCenterX(strokes) {
  let lo = Infinity, hi = -Infinity;
  for (const st of strokes) for (const p of st) { if (p[0] < lo) lo = p[0]; if (p[0] > hi) hi = p[0]; }
  return hi < lo ? 0 : (lo + hi) / 2;
}

// returns { lines:[{placed, widthFU}], missing:Set }, in font units
function layout(font) {
  const lsFU = state.letterSpacing / (state.fontSize / UPM);   // mm → font units
  const missing = new Set();
  const lines = state.text.split("\n").map(line => {
    const vis = visualOrder(toClusters(line));
    let x = 0; const placed = [];
    for (const cl of vis) {
      const g = glyph(font, cl.base);
      if (!g && cl.base !== " " && strongDir(cl.base) !== "N") missing.add(cl.base);
      const adv = g ? g.advance : (cl.base === " " ? 250 : 300);
      placed.push({ cl, x, adv, g });
      x += adv + lsFU;
    }
    const widthFU = placed.length ? x - lsFU : 0;
    return { placed, widthFU };
  });
  return { lines, missing };
}

// ── render to the artboard (and that markup IS the export) ──────────────────
function pathFromStroke(pts) {
  if (pts.length === 1) { const [x, y] = pts[0]; return `M${f(x)},${f(y)}L${f(x)},${f(y)}`; }
  return "M" + pts.map(([x, y]) => `${f(x)},${f(y)}`).join("L");
}

function render() {
  const font = FONTS[state.variant];
  const scale = state.fontSize / UPM;                 // mm per font unit
  const paper = SIZES[state.size][state.orientation];
  const { w: W, h: H } = paper;
  const m = state.margin, boxW = W - 2 * m;
  const ascentMM = font.ascent * scale;
  const lineH = state.fontSize * state.lineSpacing;

  const { lines, missing } = layout(font);
  const ds = [];

  lines.forEach((ln, li) => {
    const baseY = m + ascentMM + li * lineH;          // baseline of this line (mm)
    const widthMM = ln.widthFU * scale;
    let ox;                                            // line origin x (mm), visual-left of line
    if (state.align === "right") ox = (W - m) - widthMM;
    else if (state.align === "center") ox = m + (boxW - widthMM) / 2;
    else ox = m;

    for (const it of ln.placed) {
      if (!it.g) continue;
      const baseFU = it.x;
      for (const st of it.g.strokes)
        ds.push(pathFromStroke(st.map(([x, y]) => [ox + (baseFU + x) * scale, baseY - y * scale])));

      // niqqud: re-center each mark on the base letter
      for (const mk of it.cl.marks) {
        const mg = glyph(font, mk);
        if (!mg || !mg.strokes.length) continue;
        const shift = baseFU + it.adv / 2 - bboxCenterX(mg.strokes);
        for (const st of mg.strokes)
          ds.push(pathFromStroke(st.map(([x, y]) => [ox + (x + shift) * scale, baseY - y * scale])));
      }
    }
  });

  const body = ds.map(d => `<path d="${d}"/>`).join("");
  artboard.setAttribute("width", W + "mm");
  artboard.setAttribute("height", H + "mm");
  artboard.setAttribute("viewBox", `0 0 ${W} ${H}`);
  artboard.innerHTML =
    `<g fill="none" stroke="#000000" stroke-width="${state.strokeWidth}" ` +
    `stroke-linecap="round" stroke-linejoin="round">${body}</g>` +
    `<desc>Miriam Libre single-line (${state.variant}) — Studio 1 plotter font</desc>`;

  const miss = [...missing];
  document.getElementById("missing").textContent =
    miss.length ? "אין במאגר: " + miss.join(" ") : "";
}

// ── export ──────────────────────────────────────────────────────────────────
function exportSVG() {
  const xml = new XMLSerializer().serializeToString(artboard);
  const out = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
  const blob = new Blob([out], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hebrew-singleline-${state.variant}-${state.size}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── wiring ──────────────────────────────────────────────────────────────────
let raf = 0;
function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }

function bindRange(id, key, out, fmt = v => v) {
  const el = document.getElementById(id), o = out && document.getElementById(out);
  el.addEventListener("input", () => {
    state[key] = parseFloat(el.value);
    if (o) o.textContent = fmt(el.value);
    schedule();
  });
}
function bindSeg(id, key) {
  const box = document.getElementById(id);
  box.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    [...box.children].forEach(c => c.classList.toggle("on", c === b));
    state[key] = b.dataset.val;
    schedule();
  });
}

document.getElementById("text").addEventListener("input", e => { state.text = e.target.value; schedule(); });
bindRange("fontSize", "fontSize", "o-size");
bindRange("letterSpacing", "letterSpacing", "o-letter");
bindRange("lineSpacing", "lineSpacing", "o-line", v => parseFloat(v).toFixed(1));
bindRange("margin", "margin", "o-margin");
bindRange("strokeWidth", "strokeWidth", "o-stroke", v => parseFloat(v).toFixed(1));
bindSeg("variant", "variant");
bindSeg("align", "align");
bindSeg("size", "size");
bindSeg("orientation", "orientation");
document.getElementById("btn-export").addEventListener("click", exportSVG);

// live-update when the editor saves an override in another tab
window.addEventListener("storage", e => {
  if (e.key === "hhg_overrides_v1") { try { OVERRIDES = JSON.parse(e.newValue || "{}"); } catch (_) {} schedule(); }
});

// init from defaults in the DOM
state.text = document.getElementById("text").value;
render();

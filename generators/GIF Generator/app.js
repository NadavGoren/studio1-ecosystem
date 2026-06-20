/* ════════════════════════════════════════════════════════════════
   Studio 1 · GIF Generator
   SVG batch → animated GIF / video, in true millimetres.
   ════════════════════════════════════════════════════════════════ */

'use strict';

// (No more STROKEABLE — the single-pass renderer doesn't iterate elements.)

/* ── State ────────────────────────────────────────────────────── */
const state = {
  frames: [],          // { id, name, svgText, vbW, vbH, thumb }
  fps: 12,
  duration: 1.0,
  loop: true,
  pingpong: false,
  strokeMm: 0.5,
  strokeColor: '#111111',
  bgColor: '#ffffff',
  overrideStroke: true,
  noFill: true,
  ink: false,
  inkOpacity: 0.7,
  widthMm: 150,
  pxPerMm: 10,
  autoSize: true,
  // runtime
  playing: false,
  curOut: 0,
  cache: new Map(),    // frameId -> rendered offscreen canvas (output-sized)
  rafTimer: null,
};

let uid = 0;

/* ── Elements ─────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const els = {
  sidebar: $('sidebar'),
  fileInput: $('file-input'),
  addBtn: $('add-btn'),
  clearBtn: $('clear-btn'),
  frameList: $('frame-list'),
  frameCount: $('frame-count'),
  fps: $('fps'), fpsVal: $('fps-val'),
  durVal: $('dur-val'),
  loop: $('loop'), pingpong: $('pingpong'),
  stroke: $('stroke'), strokeVal: $('stroke-val'),
  strokeColor: $('stroke-color'), bgColor: $('bg-color'),
  overrideStroke: $('override-stroke'), noFill: $('no-fill'),
  ink: $('ink'), inkOpacityCtl: $('ink-opacity-ctl'),
  inkOpacity: $('ink-opacity'), inkOpVal: $('ink-op-val'),
  widthMm: $('width-mm'), widthVal: $('width-val'), widthCtl: $('width-ctl'),
  res: $('res'), resVal: $('res-val'), dimsHint: $('dims-hint'),
  autoSize: $('auto-size'),
  dropzone: $('dropzone'), viewer: $('viewer'),
  preview: $('preview'),
  playBtn: $('play-btn'), scrub: $('scrub'), scrubLabel: $('scrub-label'),
  exportGif: $('export-gif'), exportVid: $('export-vid'),
  overlay: $('overlay'), overlayMsg: $('overlay-msg'), overlayBar: $('overlay-bar'),
  toast: $('toast'),
};
const pctx = els.preview.getContext('2d');

/* ════════════════════════════════════════════════════════════════
   Derived timing
   ════════════════════════════════════════════════════════════════ */
function outFrameCount() {
  return state.frames.length;
}

// Map an output-frame index to a source-frame index (handles ping-pong).
function sourceIndexForOutput(k) {
  const N = state.frames.length;
  const out = outFrameCount();
  if (N <= 1 || out <= 1) return 0;
  let phase = k / out;                       // 0..1 across the loop
  if (state.pingpong) {
    // 0..1..0 triangle
    phase = phase * 2;
    if (phase > 1) phase = 2 - phase;
  }
  return Math.min(N - 1, Math.floor(phase * N));
}

/* ════════════════════════════════════════════════════════════════
   SVG parsing
   ════════════════════════════════════════════════════════════════ */
// Parse a length attribute like "100mm", "300px", "10cm", or unitless
// into millimetres. Returns null if no usable physical unit is present.
function lengthToMm(raw) {
  if (!raw) return null;
  const m = String(raw).trim().match(/^([\d.+\-eE]+)\s*([a-z%]*)$/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!isFinite(v)) return null;
  const unit = (m[2] || '').toLowerCase();
  switch (unit) {
    case 'mm': return v;
    case 'cm': return v * 10;
    case 'in': return v * 25.4;
    case 'pt': return v * 25.4 / 72;
    case 'pc': return v * 25.4 / 6;
    case 'px': return v * 25.4 / 96;
    case '':   return null; // unitless — no physical scale, fall back
    default:   return null;
  }
}

function parseSvg(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) throw new Error('No <svg> root');

  let vbW, vbH;
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const p = vb.trim().split(/[\s,]+/).map(Number);
    vbW = p[2]; vbH = p[3];
  }
  if (!vbW || !vbH) {
    vbW = parseFloat(svg.getAttribute('width')) || 100;
    vbH = parseFloat(svg.getAttribute('height')) || 100;
    svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
  }
  // Intrinsic physical width/height (in mm) if the SVG carried units.
  const nativeWmm = lengthToMm(svg.getAttribute('width'));
  const nativeHmm = lengthToMm(svg.getAttribute('height'));
  return { svg, vbW, vbH, nativeWmm, nativeHmm };
}

// Tiny thumbnail (raw svg as-is) for the frame list.
function makeThumb(svgText) {
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
}

/* ════════════════════════════════════════════════════════════════
   Output canvas sizing — derived from the FIRST frame's aspect ratio
   ════════════════════════════════════════════════════════════════ */
function outputDims() {
  let widthMm = state.widthMm;
  let aspect = 1;
  if (state.frames.length) {
    const f = state.frames[0];
    aspect = f.vbH / f.vbW;
    if (state.autoSize && f.nativeWmm && f.nativeHmm) {
      widthMm = f.nativeWmm;
      aspect = f.nativeHmm / f.nativeWmm;
    }
  }
  const cw = Math.round(widthMm * state.pxPerMm);
  const ch = Math.round(cw * aspect);
  return { cw: cw + (cw % 2), ch: ch + (ch % 2), widthMm };
}

/* ════════════════════════════════════════════════════════════════
   Render one source frame → offscreen canvas (output-sized)
   ════════════════════════════════════════════════════════════════ */
function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('SVG render failed'));
    img.src = src;
  });
}

function svgToDataUrl(svgEl) {
  const s = new XMLSerializer().serializeToString(svgEl);
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
}

// Visual properties that we scrub from descendants so root-level
// overrides win. Inline `style` and presentation attributes BOTH
// need to be cleared — CSS in an inline style wins over the attribute.
const FILL_PROPS = ['fill', 'fill-opacity', 'fill-rule'];

// Remove the given CSS property names from an element's inline style attribute.
function scrubInlineStyle(el, propsToRemove) {
  const raw = el.getAttribute('style');
  if (!raw) return;
  const kept = raw
    .split(';')
    .map(d => d.trim())
    .filter(d => {
      if (!d) return false;
      const colon = d.indexOf(':');
      if (colon < 0) return true;
      const name = d.slice(0, colon).trim().toLowerCase();
      return !propsToRemove.includes(name);
    })
    .join('; ');
  if (kept) el.setAttribute('style', kept);
  else el.removeAttribute('style');
}

// Build a clone of the svg sized to the draw rect, with overrides applied.
//
// Every left-panel setting must reach every descendant — including ones
// behind <style> blocks, inline style attributes, nested <g> inheritance,
// and !important flags. The approach: scrub the relevant property names
// from BOTH presentation attributes AND inline `style` strings on every
// descendant, then apply our values on the root <svg> so SVG inheritance
// fans them out cleanly.
//
// The flags are deliberately independent:
//   strokeMm  — ALWAYS applied (it's a render-engine setting, not optional)
//   override-stroke — when on, force the picked colour on every stroke
//                   when off, keep the author's colours
//   noFill    — strip fills to outline-only
//   ink       — apply stroke-opacity so overlapping strokes darken
function prepareClone(frame, dw, dh) {
  const { svg } = parseSvg(frame.svgText);
  const clone = svg;                       // parseSvg gives a fresh doc each call
  clone.setAttribute('width', dw);
  clone.setAttribute('height', dh);
  clone.removeAttribute('style');

  // Pixels per user-unit when the SVG is rasterised at (dw × dh).
  // Stroke must be expressed in user-units so it renders at the
  // requested millimetre width on the output canvas.
  const s = dw / frame.vbW;
  const strokeUU = (state.strokeMm * state.pxPerMm) / s;

  // 1. Nuke <style> blocks anywhere in the tree.
  clone.querySelectorAll('style').forEach((n) => n.remove());

  // 2. Decide which property names we need to neutralise on descendants
  //    so the root-level values actually win. Stroke-width is ALWAYS
  //    on the list — the user must be able to scale strokes regardless
  //    of whether they're keeping author colours.
  const toStrip = ['stroke-width'];
  if (state.overrideStroke) toStrip.push('stroke', 'stroke-opacity');
  if (state.ink)            toStrip.push('stroke-opacity');
  if (state.noFill)         toStrip.push(...FILL_PROPS);
  // de-dupe
  const stripSet = Array.from(new Set(toStrip));

  // 3. Walk every descendant and clear those props from presentation
  //    attributes AND inline style.
  const all = clone.querySelectorAll('*');
  all.forEach((el) => {
    for (const prop of stripSet) el.removeAttribute(prop);
    scrubInlineStyle(el, stripSet);
  });

  // 4. Apply our values on the root <svg>. SVG inheritance handles the rest.
  clone.setAttribute('stroke-width', strokeUU);
  clone.setAttribute('vector-effect', 'none');
  if (state.overrideStroke) {
    clone.setAttribute('stroke', state.strokeColor);
    clone.setAttribute('stroke-linecap', 'round');
    clone.setAttribute('stroke-linejoin', 'round');
  }
  if (state.noFill) {
    clone.setAttribute('fill', 'none');
  }
  if (state.ink) {
    // Semi-transparent strokes. With normal source-over compositing,
    // overlapping semi-transparent strokes naturally compound — single
    // stroke is grey, two overlapping go darker, three darker still —
    // exactly the gel-pen overprint effect, in a single rasterisation
    // regardless of how many strokes the SVG has.
    clone.setAttribute('stroke-opacity', state.inkOpacity);
  }

  // (No more elements list — we don't iterate per-stroke any more.)
  return { clone };
}

async function renderFrame(frame) {
  const { cw, ch } = outputDims();
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');

  // background
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, cw, ch);

  // contain-fit the frame inside the output canvas
  const fit = Math.min(cw / frame.vbW, ch / frame.vbH);
  const dw = frame.vbW * fit;
  const dh = frame.vbH * fit;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;

  const { clone } = prepareClone(frame, dw, dh);

  // Single rasterisation — ink/stroke-width/colour overrides all live
  // inside the prepared SVG itself, so one drawImage gives the full effect
  // regardless of how many strokes the file contains.
  const img = await loadImage(svgToDataUrl(clone));
  ctx.drawImage(img, dx, dy, dw, dh);

  return canvas;
}

/* ════════════════════════════════════════════════════════════════
   Cache: render every source frame; called when params change
   ════════════════════════════════════════════════════════════════ */
let rebuildToken = 0;
async function rebuildCache() {
  const myToken = ++rebuildToken;
  const frames = [...state.frames];
  const fresh = new Map();
  const CONC = 4;
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= frames.length) return;
      const f = frames[idx];
      let canvas;
      try { canvas = await renderFrame(f); }
      catch { continue; }
      if (myToken !== rebuildToken) return;
      fresh.set(f.id, canvas);
      // surface progress: swap in finished frames as they arrive, keeping
      // stale frames visible for the rest so the preview never blanks out
      if (state.cache.has(f.id) || fresh.size === 1) state.cache.set(f.id, canvas);
      if (idx === sourceIndexForOutput(state.curOut)) drawCurrent();
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, frames.length) || 1 }, worker));
  if (myToken !== rebuildToken) return;
  state.cache = fresh;
  drawCurrent();
}

let rebuildTimer = null;
function scheduleRebuild() {
  liveRefreshCurrent();
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuildCache, 180);
}

// Render only the currently-visible source frame at full quality and draw
// it immediately, so dragging sliders shows a live response without waiting
// for the entire cache to rebuild.
let liveToken = 0;
async function liveRefreshCurrent() {
  if (state.frames.length === 0) return;
  const myToken = ++liveToken;
  const idx = sourceIndexForOutput(state.curOut);
  const f = state.frames[idx];
  if (!f) return;
  let canvas;
  try { canvas = await renderFrame(f); }
  catch { return; }
  if (myToken !== liveToken) return;
  state.cache.set(f.id, canvas);
  drawCurrent();
}

/* ════════════════════════════════════════════════════════════════
   Preview drawing & playback
   ════════════════════════════════════════════════════════════════ */
function canvasForOutput(k) {
  const idx = sourceIndexForOutput(k);
  const f = state.frames[idx];
  return f ? state.cache.get(f.id) : null;
}

function drawCurrent() {
  const { cw, ch } = outputDims();
  if (els.preview.width !== cw) els.preview.width = cw;
  if (els.preview.height !== ch) els.preview.height = ch;
  pctx.fillStyle = state.bgColor;
  pctx.fillRect(0, 0, cw, ch);
  const src = canvasForOutput(state.curOut);
  if (src) pctx.drawImage(src, 0, 0);
}

function updateScrub() {
  const out = outFrameCount();
  els.scrub.max = Math.max(0, out - 1);
  els.scrub.value = state.curOut;
  els.scrubLabel.textContent = `${out ? state.curOut + 1 : 0} / ${out}`;
}

function tick() {
  if (!state.playing) return;
  const out = outFrameCount();
  state.curOut++;
  if (state.curOut >= out) {
    if (state.loop) state.curOut = 0;
    else { state.curOut = out - 1; stopPlay(); }
  }
  drawCurrent();
  updateScrub();
  if (state.playing) state.rafTimer = setTimeout(tick, 1000 / state.fps);
}

function startPlay() {
  if (state.frames.length === 0) return;
  state.playing = true;
  els.playBtn.textContent = '❚❚ Pause';
  state.rafTimer = setTimeout(tick, 1000 / state.fps);
}
function stopPlay() {
  state.playing = false;
  els.playBtn.textContent = '▶ Play';
  clearTimeout(state.rafTimer);
}
function togglePlay() { state.playing ? stopPlay() : startPlay(); }

/* ════════════════════════════════════════════════════════════════
   Frame list UI
   ════════════════════════════════════════════════════════════════ */
function renderFrameList() {
  els.frameList.innerHTML = '';
  state.frames.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'frame-item';
    item.draggable = true;
    item.dataset.id = f.id;
    item.innerHTML = `
      <img class="thumb" src="${f.thumb}" alt="" />
      <div class="meta">
        <div class="name" title="${f.name}">${f.name}</div>
        <div class="idx">Frame ${i + 1}</div>
      </div>
      <button class="del" title="Remove">✕</button>`;
    item.querySelector('.del').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFrame(f.id);
    });
    attachDnd(item);
    els.frameList.appendChild(item);
  });
  els.frameCount.textContent = state.frames.length;
}

// Drag-to-reorder
let dragId = null;
function attachDnd(item) {
  item.addEventListener('dragstart', () => { dragId = item.dataset.id; item.classList.add('dragging'); });
  item.addEventListener('dragend', () => { dragId = null; item.classList.remove('dragging'); document.querySelectorAll('.frame-item').forEach(x => x.classList.remove('drop-target')); });
  item.addEventListener('dragover', (e) => { e.preventDefault(); item.classList.add('drop-target'); });
  item.addEventListener('dragleave', () => item.classList.remove('drop-target'));
  item.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation();
    item.classList.remove('drop-target');
    if (!dragId || dragId === item.dataset.id) return;
    const from = state.frames.findIndex(f => f.id === dragId);
    const to = state.frames.findIndex(f => f.id === item.dataset.id);
    const [moved] = state.frames.splice(from, 1);
    state.frames.splice(to, 0, moved);
    renderFrameList();
    scheduleRebuild();
  });
}

function removeFrame(id) {
  state.frames = state.frames.filter(f => f.id !== id);
  state.cache.delete(id);
  state.curOut = 0;
  renderFrameList();
  refreshLayout();
  refreshLabels();
  scheduleRebuild();
}

/* ════════════════════════════════════════════════════════════════
   File ingestion
   ════════════════════════════════════════════════════════════════ */
async function addFiles(fileList) {
  const files = [...fileList]
    .filter(f => /\.svg$/i.test(f.name) || f.type === 'image/svg+xml')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  if (files.length === 0) { toast('No SVG files found in that drop.', true); return; }

  for (const file of files) {
    try {
      const text = await file.text();
      const { vbW, vbH, nativeWmm, nativeHmm } = parseSvg(text);
      state.frames.push({
        id: ++uid, name: file.name, svgText: text,
        vbW, vbH, nativeWmm, nativeHmm, thumb: makeThumb(text),
      });
    } catch (err) {
      toast(`Skipped ${file.name}: ${err.message}`, true);
    }
  }
  renderFrameList();
  refreshLayout();
  refreshLabels();
  scheduleRebuild();
}

/* ════════════════════════════════════════════════════════════════
   Layout / labels
   ════════════════════════════════════════════════════════════════ */
function refreshLayout() {
  const has = state.frames.length > 0;
  els.dropzone.hidden = has;
  els.viewer.hidden = !has;
  state.curOut = Math.min(state.curOut, Math.max(0, outFrameCount() - 1));
  updateScrub();
  drawCurrent();
}

function refreshLabels() {
  els.fpsVal.textContent = `${state.fps} fps`;
  const computedDur = state.frames.length > 0 ? (state.frames.length / state.fps).toFixed(1) : '—';
  els.durVal.textContent = state.frames.length > 0
    ? `${computedDur} s · ${state.frames.length} frames`
    : '—';
  els.strokeVal.textContent = `${state.strokeMm.toFixed(2)} mm`;
  els.inkOpVal.textContent = `${Math.round(state.inkOpacity * 100)}%`;
  const { cw, ch, widthMm } = outputDims();
  const effectiveW = widthMm ?? state.widthMm;
  els.widthVal.textContent = state.autoSize && state.frames.length
    ? `${effectiveW.toFixed?.(0) ?? effectiveW} mm (SVG)`
    : `${state.widthMm} mm`;
  els.resVal.textContent = `${state.pxPerMm} px/mm`;
  els.widthCtl.style.opacity = state.autoSize ? 0.45 : 1;
  els.widthMm.disabled = state.autoSize;
  const hMm = state.frames.length ? Math.round(ch / state.pxPerMm) : 0;
  els.dimsHint.textContent = state.frames.length
    ? `Output: ${Math.round(effectiveW)} × ${hMm} mm  ·  ${cw} × ${ch} px`
    : 'Add frames to see output size';
}

/* ════════════════════════════════════════════════════════════════
   Export — GIF
   ════════════════════════════════════════════════════════════════ */
async function exportGif() {
  if (state.frames.length === 0) return;
  stopPlay();
  showOverlay('Preparing frames…');

  // Make sure every source frame is in the cache before we encode —
  // otherwise the GIF silently drops frames the user hasn't scrubbed to.
  const missing = state.frames.filter(f => !state.cache.has(f.id));
  if (missing.length) {
    await rebuildCache();
  }

  const out = outFrameCount();
  const { cw, ch } = outputDims();
  const delay = Math.round(1000 / state.fps);

  let gif;
  try {
    gif = new GIF({
      workers: 2, quality: 10,
      workerScript: 'vendor/gif.worker.js',
      width: cw, height: ch,
      repeat: state.loop ? 0 : -1,
      background: state.bgColor,
      transparent: null,
    });
  } catch (err) {
    hideOverlay();
    toast(`Could not start GIF encoder: ${err.message}`, true);
    return;
  }

  let added = 0;
  for (let k = 0; k < out; k++) {
    const src = canvasForOutput(k);
    if (src) { gif.addFrame(src, { copy: true, delay }); added++; }
  }
  if (added === 0) {
    hideOverlay();
    toast('No rendered frames to export yet — try again in a moment.', true);
    return;
  }

  els.overlayMsg.textContent = `Encoding GIF (${added} frames)…`;

  gif.on('progress', (p) => setBar(p));
  gif.on('abort', () => { hideOverlay(); toast('GIF cancelled', true); });
  gif.on('finished', async (blob) => {
    hideOverlay();
    if (!blob || blob.size === 0) {
      toast('GIF encoder produced an empty file.', true);
      return;
    }
    try {
      await saveBlob(blob, suggestName('gif'), 'image/gif',
        [{ description: 'GIF image', accept: { 'image/gif': ['.gif'] } }]);
    } catch (err) {
      toast(`Save failed: ${err.message}`, true);
    }
  });
  try { gif.render(); }
  catch (err) { hideOverlay(); toast(`GIF render error: ${err.message}`, true); }
}

/* ════════════════════════════════════════════════════════════════
   Export — Video (MP4 if the browser supports it, else WebM)
   ════════════════════════════════════════════════════════════════ */
function pickVideoType() {
  const candidates = [
    ['video/mp4;codecs=avc1.42E01E', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm', 'webm'],
  ];
  for (const [mime, ext] of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return { mime: 'video/webm', ext: 'webm' };
}

async function exportVideo() {
  if (state.frames.length === 0) return;
  stopPlay();

  const { cw, ch } = outputDims();
  const { mime, ext } = pickVideoType();
  showOverlay(`Recording ${ext.toUpperCase()}…`);

  const rcanvas = document.createElement('canvas');
  rcanvas.width = cw; rcanvas.height = ch;
  const rctx = rcanvas.getContext('2d');
  const stream = rcanvas.captureStream(state.fps);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const finished = new Promise((resolve) => {
    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: mime });
      hideOverlay();
      await saveBlob(blob, suggestName(ext), mime,
        [{ description: `${ext.toUpperCase()} video`, accept: { [mime.split(';')[0]]: ['.' + ext] } }]);
      resolve();
    };
  });

  const out = outFrameCount();
  const loops = state.loop ? 3 : 1;          // a few loops so short clips aren't a single flash
  const frameMs = 1000 / state.fps;
  rec.start();

  // Draw frames in real time so the recorder captures correct timing.
  for (let l = 0; l < loops; l++) {
    for (let k = 0; k < out; k++) {
      const src = canvasForOutput(k);
      rctx.fillStyle = state.bgColor;
      rctx.fillRect(0, 0, cw, ch);
      if (src) rctx.drawImage(src, 0, 0);
      setBar((l * out + k) / (out * loops));
      await sleep(frameMs);
    }
  }
  rec.stop();
  await finished;
}

/* ════════════════════════════════════════════════════════════════
   Saving — ask where, default to Downloads
   ════════════════════════════════════════════════════════════════ */
function suggestName(ext) {
  return `studio1-animation.${ext}`;
}

async function saveBlob(blob, suggestedName, mime, types) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        startIn: 'downloads',
        types,
      });
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      toast(`Saved ${handle.name}`);
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;   // user cancelled the dialog
      // fall through to anchor download
    }
  }
  // Fallback: browser download (lands in Downloads)
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = suggestedName;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast(`Downloaded ${suggestedName}`);
}

/* ════════════════════════════════════════════════════════════════
   Overlay / toast helpers
   ════════════════════════════════════════════════════════════════ */
function showOverlay(msg) { els.overlayMsg.textContent = msg; els.overlayBar.style.width = '0%'; els.overlay.hidden = false; }
function hideOverlay() { els.overlay.hidden = true; }
function setBar(p) { els.overlayBar.style.width = Math.round(p * 100) + '%'; }
let toastTimer = null;
function toast(msg, isErr = false) {
  els.toast.textContent = msg;
  els.toast.classList.toggle('err', isErr);
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 3200);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ════════════════════════════════════════════════════════════════
   Wiring
   ════════════════════════════════════════════════════════════════ */
function bindSlider(el, label, key, transform = (v) => parseFloat(v), { rebuild = true, relabel = true } = {}) {
  el.addEventListener('input', () => {
    state[key] = transform(el.value);
    if (relabel) refreshLabels();
    updateScrub();
    if (rebuild) scheduleRebuild(); else drawCurrent();
  });
}

function init() {
  // Sliders that require a re-render of cached frames
  bindSlider(els.stroke, els.strokeVal, 'strokeMm');
  bindSlider(els.widthMm, els.widthVal, 'widthMm');
  bindSlider(els.res, els.resVal, 'pxPerMm', (v) => parseInt(v, 10));
  bindSlider(els.inkOpacity, els.inkOpVal, 'inkOpacity');

  // Sliders that only affect timing/playback (no re-render)
  bindSlider(els.fps, els.fpsVal, 'fps', (v) => parseInt(v, 10), { rebuild: false });

  // Colors → re-render
  els.strokeColor.addEventListener('input', () => { state.strokeColor = els.strokeColor.value; scheduleRebuild(); });
  els.bgColor.addEventListener('input', () => { state.bgColor = els.bgColor.value; scheduleRebuild(); });

  // Checkboxes
  els.loop.addEventListener('change', () => state.loop = els.loop.checked);
  els.pingpong.addEventListener('change', () => { state.pingpong = els.pingpong.checked; updateScrub(); drawCurrent(); });
  els.overrideStroke.addEventListener('change', () => { state.overrideStroke = els.overrideStroke.checked; scheduleRebuild(); });
  els.noFill.addEventListener('change', () => { state.noFill = els.noFill.checked; scheduleRebuild(); });
  els.ink.addEventListener('change', () => {
    state.ink = els.ink.checked;
    els.inkOpacityCtl.hidden = !state.ink;
    scheduleRebuild();
  });
  els.autoSize.addEventListener('change', () => {
    state.autoSize = els.autoSize.checked;
    refreshLabels();
    scheduleRebuild();
  });

  // Transport
  els.playBtn.addEventListener('click', togglePlay);
  els.scrub.addEventListener('input', () => { stopPlay(); state.curOut = parseInt(els.scrub.value, 10); drawCurrent(); updateScrub(); });

  // Files
  els.addBtn.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', () => { addFiles(els.fileInput.files); els.fileInput.value = ''; });
  els.clearBtn.addEventListener('click', () => {
    stopPlay(); state.frames = []; state.cache.clear(); state.curOut = 0;
    renderFrameList(); refreshLayout(); refreshLabels();
  });

  // Exports
  els.exportGif.addEventListener('click', exportGif);
  els.exportVid.addEventListener('click', exportVideo);

  // Drag & drop (whole window)
  const dz = els.dropzone;
  ['dragenter', 'dragover'].forEach(ev =>
    window.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('hot'); }));
  ['dragleave', 'drop'].forEach(ev =>
    window.addEventListener(ev, (e) => {
      e.preventDefault();
      if (ev === 'dragleave' && e.relatedTarget) return;
      dz.classList.remove('hot');
    }));
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('hot');
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  });

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  });

  refreshLabels();
  refreshLayout();
}

document.addEventListener('DOMContentLoaded', init);

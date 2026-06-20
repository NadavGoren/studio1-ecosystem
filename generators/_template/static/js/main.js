/**
 * main.js — UI wiring for the generator template
 *
 * Responsibilities:
 *  - Collect all sidebar params into a plain object
 *  - POST to /generate → receive SVG string → inject into preview
 *  - Export SVG to file
 *  - Seed management (randomize, apply, persist in URL hash)
 *  - Collapsible sections
 *  - Debounced auto-generate on slider/input change
 *  - Responsive paper preview sizing
 *  - Keyboard shortcuts: Space = generate, Cmd/Ctrl+S = export
 */

import { A3, downloadSVG } from './utils.js';

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const previewEl      = document.getElementById('preview');
const previewEmpty   = document.getElementById('preview-empty');
const btnGenerate    = document.getElementById('btn-generate');
const btnExport      = document.getElementById('btn-export');
const seedInput      = document.getElementById('seed-input');
const btnRandomSeed  = document.getElementById('btn-randomize-seed');
const btnApplySeed   = document.getElementById('btn-apply-seed');
const statusBar      = document.getElementById('status-bar');
const statusText     = document.getElementById('status-text');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentSVG   = null;   // last SVG string returned by server
let currentSeed  = null;   // current numeric seed (32-bit)
let generateTimer = null;  // debounce handle

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function randomSeed() {
  return (Math.random() * 0xFFFFFFFF) >>> 0;
}

function seedToHex(n) {
  return (n >>> 0).toString(16).padStart(8, '0');
}

function hexToSeed(str) {
  const v = parseInt(str, 16);
  return isNaN(v) ? randomSeed() : (v >>> 0);
}

function applySeed(seed) {
  currentSeed      = (seed >>> 0);
  seedInput.value  = seedToHex(currentSeed);
  window.location.hash = seedToHex(currentSeed);
}

function randomizeSeed() {
  applySeed(randomSeed());
}

// ---------------------------------------------------------------------------
// Collect all sidebar params
//
// Every input with a [data-param] attribute is automatically included.
// The key used in the params object is the data-param value.
// Add new inputs in index.html with data-param and they show up here for free.
// ---------------------------------------------------------------------------

function collectParams() {
  const params = { seed: currentSeed };

  document.querySelectorAll('[data-param]').forEach(el => {
    const key = el.dataset.param;
    if (el.type === 'checkbox') {
      params[key] = el.checked;
    } else if (el.type === 'range' || el.type === 'number') {
      params[key] = parseFloat(el.value);
    } else {
      params[key] = el.value;
    }
  });

  return params;
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

async function generate() {
  setStatus('generating');
  btnGenerate.disabled = true;

  const params = collectParams();

  try {
    const res = await fetch('/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.text();
      setStatus('error');
      console.error('Generate error:', err);
      return;
    }

    const data = await res.json();
    currentSVG = data.svg;

    injectSVG(currentSVG);
    btnExport.disabled = false;
    setStatus('done');

  } catch (e) {
    setStatus('error');
    console.error('Fetch failed:', e);
  } finally {
    btnGenerate.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Preview injection
// ---------------------------------------------------------------------------

function injectSVG(svgString) {
  previewEl.innerHTML = svgString;
  if (previewEmpty) previewEmpty.style.display = 'none';
  sizePreview();
}

// ---------------------------------------------------------------------------
// Export SVG
// ---------------------------------------------------------------------------

function exportSVG() {
  if (!currentSVG) return;
  const name = document.title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const seed = seedToHex(currentSeed ?? 0);
  downloadSVG(currentSVG, `${name}-${seed}.svg`);
}

// ---------------------------------------------------------------------------
// Responsive preview sizing
// Maintains A3 aspect ratio, fits inside the available main area.
// ---------------------------------------------------------------------------

function sizePreview() {
  const params = collectParams();
  const isLandscape = params.orientation === 'landscape';
  const paperW = isLandscape ? A3.landscape.width  : A3.portrait.width;
  const paperH = isLandscape ? A3.landscape.height : A3.portrait.height;
  const aspect = paperW / paperH;

  const wrap = document.getElementById('preview-wrap');
  const avW  = wrap.clientWidth  - 48;
  const avH  = wrap.clientHeight - 48;

  let w = avW;
  let h = w / aspect;
  if (h > avH) { h = avH; w = h * aspect; }

  previewEl.style.width  = `${w}px`;
  previewEl.style.height = `${h}px`;
}

window.addEventListener('resize', sizePreview);

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------

function setStatus(state, msg) {
  statusBar.className = '';
  if (state === 'generating') {
    statusBar.classList.add('generating');
    statusText.textContent = 'generating…';
  } else if (state === 'done') {
    statusBar.classList.add('done');
    statusText.textContent = msg ?? 'done';
  } else if (state === 'error') {
    statusText.textContent = 'error — check console';
  } else {
    statusText.textContent = msg ?? 'ready';
  }
}

// ---------------------------------------------------------------------------
// Debounced auto-generate (fires 400ms after last slider change)
// ---------------------------------------------------------------------------

function scheduleGenerate() {
  clearTimeout(generateTimer);
  generateTimer = setTimeout(generate, 400);
}

// ---------------------------------------------------------------------------
// Collapsible sections
// ---------------------------------------------------------------------------

document.querySelectorAll('.section-header').forEach(header => {
  header.addEventListener('click', () => {
    const section = header.closest('.section');
    section.classList.toggle('collapsed');
  });
});

// ---------------------------------------------------------------------------
// Slider live-value display + filled track + auto-generate
// ---------------------------------------------------------------------------

document.querySelectorAll('input[type="range"]').forEach(slider => {
  const id    = slider.id;
  const valEl = document.getElementById(`val-${id}`);

  function updateSlider() {
    if (valEl) {
      const raw   = parseFloat(slider.value);
      // Show a nice decimal for small floats, integer otherwise
      valEl.textContent = raw < 10 ? raw.toFixed(raw % 1 !== 0 ? 3 : 0) : Math.round(raw);
    }
    // Optional: update filled-track CSS var
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--fill', `${pct}%`);
  }

  updateSlider(); // init
  slider.addEventListener('input', () => { updateSlider(); scheduleGenerate(); });
});

// Auto-generate on select / checkbox change too
document.querySelectorAll('select, input[type="checkbox"]').forEach(el => {
  el.addEventListener('change', () => {
    if (el.id === 'orientation') sizePreview();
    scheduleGenerate();
  });
});

// Color picker — only on pointerup (avoid spamming while dragging)
document.querySelectorAll('input[type="color"]').forEach(el => {
  el.addEventListener('change', scheduleGenerate);
});

// ---------------------------------------------------------------------------
// Button wiring
// ---------------------------------------------------------------------------

btnGenerate.addEventListener('click', generate);
btnExport  .addEventListener('click', exportSVG);

btnRandomSeed.addEventListener('click', () => {
  randomizeSeed();
  scheduleGenerate();
});

btnApplySeed.addEventListener('click', () => {
  applySeed(hexToSeed(seedInput.value.trim()));
  scheduleGenerate();
});

seedInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    applySeed(hexToSeed(seedInput.value.trim()));
    scheduleGenerate();
  }
});

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  if (e.code === 'Space' && !inInput) {
    e.preventDefault();
    generate();
  }

  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    exportSVG();
  }
});

// ---------------------------------------------------------------------------
// Init: restore seed from URL hash, size paper, first generate
// ---------------------------------------------------------------------------

(function init() {
  const hashSeed = window.location.hash.replace('#', '');
  if (/^[0-9a-f]{1,8}$/i.test(hashSeed)) {
    applySeed(hexToSeed(hashSeed));
  } else {
    randomizeSeed();
  }
  sizePreview();
  generate();
})();

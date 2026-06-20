/**
 * utils.js — shared utilities for all generators
 *
 * A3 constants, seeded RNG, SVG download, SVG wrapper builder.
 * Import in main.js:  import { A3, mulberry32, downloadSVG, buildSVGWrapper } from './utils.js';
 */

// ---------------------------------------------------------------------------
// Paper constants (mm)
// ---------------------------------------------------------------------------

export const A3 = {
  portrait:  { width: 297, height: 420 },
  landscape: { width: 420, height: 297 },
};

// ---------------------------------------------------------------------------
// Seeded pseudo-random number generator (Mulberry32)
// Returns a function rand() that produces floats in [0, 1)
// ---------------------------------------------------------------------------

export function mulberry32(seed) {
  let s = seed >>> 0;
  return function rand() {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience: random integer in [min, max] inclusive */
export function randInt(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

/** Convenience: random float in [min, max) */
export function randFloat(rand, min, max) {
  return min + rand() * (max - min);
}

// ---------------------------------------------------------------------------
// SVG download helper
// ---------------------------------------------------------------------------

/**
 * Triggers a browser download of svgString as a .svg file.
 * @param {string} svgString  Full SVG markup
 * @param {string} filename   e.g. "my-generator-0xdeadbeef.svg"
 */
export function downloadSVG(svgString, filename) {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// SVG wrapper builder
// Produces a plotter-ready SVG string with correct viewBox, mm units,
// Inkscape namespace, and an embedded seed in <desc>.
// ---------------------------------------------------------------------------

/**
 * @param {number}   widthMm    Paper width in mm (default 297)
 * @param {number}   heightMm   Paper height in mm (default 420)
 * @param {string}   innerSVG   All <g>, <path>, etc. elements as a string
 * @param {object}   opts
 * @param {number}   [opts.seed]            Seed value to embed in <desc>
 * @param {string}   [opts.generatorName]   Embedded in <title>
 * @returns {string}
 */
export function buildSVGWrapper(widthMm = 297, heightMm = 420, innerSVG = '', opts = {}) {
  const { seed = null, generatorName = 'Generator' } = opts;
  const seedDesc = seed !== null
    ? `\n  <desc>seed:${(seed >>> 0).toString(16).padStart(8, '0')}</desc>`
    : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  width="${widthMm}mm"
  height="${heightMm}mm"
  viewBox="0 0 ${widthMm} ${heightMm}"
>
  <title>${generatorName}</title>${seedDesc}
${innerSVG}
</svg>`;
}

/**
 * Wraps paths/elements inside a named Inkscape layer group.
 * @param {string} label   Layer name shown in Inkscape
 * @param {string} id      XML id for the group
 * @param {string} content Inner elements
 * @returns {string}
 */
export function inkscapeLayer(label, id, content) {
  return `  <g
    inkscape:label="${label}"
    inkscape:groupmode="layer"
    id="${id}"
  >
${content}
  </g>`;
}

// ---------------------------------------------------------------------------
// General geometry helpers
// ---------------------------------------------------------------------------

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function map(v, inMin, inMax, outMin, outMax) {
  return outMin + (outMax - outMin) * ((v - inMin) / (inMax - inMin));
}

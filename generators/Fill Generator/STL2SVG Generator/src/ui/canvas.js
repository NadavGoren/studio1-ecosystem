/* ============================================================
   CANVAS UTILITIES
   Functions for managing canvas presets and dimensions
============================================================ */

import { CANVAS_PRESETS } from '../core/constants.js';

/**
 * Apply a canvas preset (A3, A4, etc.) to the canvas dimensions
 * @param {string} preset - Preset name (e.g., 'a4', 'a3')
 */
export function applyCanvasPreset(preset) {
  const dims = CANVAS_PRESETS[preset];
  const widthEl = document.getElementById("canvasWidth");
  const heightEl = document.getElementById("canvasHeight");
  if (!dims || !widthEl || !heightEl) return;
  widthEl.value = dims.width;
  heightEl.value = dims.height;
}

/**
 * Sync the canvas preset dropdown to match current width/height inputs
 * Sets to "custom" if dimensions don't match any preset
 */
export function syncCanvasPresetFromInputs() {
  const presetEl = document.getElementById("canvasPreset");
  const widthEl = document.getElementById("canvasWidth");
  const heightEl = document.getElementById("canvasHeight");
  if (!presetEl || !widthEl || !heightEl) return;

  const width = +widthEl.value;
  const height = +heightEl.value;

  let found = "custom";
  Object.entries(CANVAS_PRESETS).forEach(([key, dims]) => {
    // Check both landscape and portrait orientations
    if ((Math.abs(dims.width - width) < 0.001 && Math.abs(dims.height - height) < 0.001) ||
        (Math.abs(dims.width - height) < 0.001 && Math.abs(dims.height - width) < 0.001)) {
      found = key;
    }
  });
  presetEl.value = found;
}

/**
 * Update the orientation label and toggle state based on canvas dimensions
 */
export function updateOrientationLabel() {
  const widthEl = document.getElementById("canvasWidth");
  const heightEl = document.getElementById("canvasHeight");
  const orientationLabel = document.getElementById("orientationLabel");
  const toggleOrientationBtn = document.getElementById("toggleOrientation");
  
  if (widthEl && heightEl && orientationLabel && toggleOrientationBtn) {
    const width = parseFloat(widthEl.value);
    const height = parseFloat(heightEl.value);
    const isPortrait = height > width;
    
    // Update checkbox state
    toggleOrientationBtn.checked = isPortrait;
    
    // Update label (shows current orientation)
    orientationLabel.textContent = isPortrait ? "Portrait" : "Landscape";
    
    // Update label colors based on state
    const labelLeft = document.querySelector(".orientation-label-left");
    const labelRight = document.querySelector(".orientation-label-right");
    if (labelLeft && labelRight) {
      if (isPortrait) {
        labelLeft.style.color = "var(--text-muted)";
        labelLeft.style.fontWeight = "600";
        labelRight.style.color = "var(--accent)";
        labelRight.style.fontWeight = "700";
      } else {
        labelLeft.style.color = "var(--accent)";
        labelLeft.style.fontWeight = "700";
        labelRight.style.color = "var(--text-muted)";
        labelRight.style.fontWeight = "600";
      }
    }
  }
}




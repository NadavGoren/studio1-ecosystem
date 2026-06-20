/* ============================================================
   UI UPDATES
   Functions for updating UI labels and visibility states
============================================================ */

import { draw } from '../rendering/renderer.js';
import { syncCanvasPresetFromInputs, updateOrientationLabel } from './canvas.js';

/**
 * Update view mode UI (show/hide perspective controls)
 */
export function updateViewModeUI() {
  const viewMode = document.getElementById("viewMode").value;
  const perspectiveControls = document.getElementById("perspectiveControls");
  const viewModeLabel = document.getElementById("viewModeLabel");
  
  if (viewMode === 'perspective') {
    perspectiveControls.style.display = 'block';
    viewModeLabel.textContent = 'Perspective';
  } else {
    perspectiveControls.style.display = 'none';
    viewModeLabel.textContent = 'Isometric';
  }
}

/**
 * Update all UI labels to reflect current control values
 */
export function updateLabels() {
  document.getElementById("canvasPresetLabel").textContent =
    document.getElementById("canvasPreset").options[document.getElementById("canvasPreset").selectedIndex].textContent.split(" (")[0];

  document.getElementById("canvasWidthValue").textContent =
    document.getElementById("canvasWidth").value;

  document.getElementById("canvasHeightValue").textContent =
    document.getElementById("canvasHeight").value;

  document.getElementById("marginValue").textContent =
    document.getElementById("margin").value;

  document.getElementById("strokeWidthValue").textContent =
    document.getElementById("strokeWidth").value;
  
  // View mode label
  const viewModeSelect = document.getElementById("viewMode");
  if (viewModeSelect) {
    document.getElementById("viewModeLabel").textContent =
      viewModeSelect.options[viewModeSelect.selectedIndex].textContent;
  }
  
  // Perspective strength label
  const perspectiveStrength = document.getElementById("perspectiveStrength").value;
  document.getElementById("perspectiveStrengthValue").textContent = perspectiveStrength;

  // Update single color label
  const singleColorEl = document.getElementById("singleColor");
  const singleColorValueEl = document.getElementById("singleColorValue");
  if (singleColorEl && singleColorValueEl) {
    singleColorValueEl.textContent = singleColorEl.value.toUpperCase();
  }

  // Update face color labels
  const faceColorIds = ['Top', 'Front', 'Back', 'Left', 'Right', 'Bottom'];
  faceColorIds.forEach(faceName => {
    const colorEl = document.getElementById(`face${faceName}Color`);
    const valueEl = document.getElementById(`face${faceName}ColorValue`);
    if (colorEl && valueEl) {
      valueEl.textContent = colorEl.value.toUpperCase();
    }
  });

  const cubeSizeInput = document.getElementById("cubeSizeInput");
  const cubeSizeSlider = document.getElementById("cubeSize");
  document.getElementById("cubeSizeValue").textContent =
    (cubeSizeInput && cubeSizeInput.value) || (cubeSizeSlider && cubeSizeSlider.value) || "50";

  document.getElementById("lightAngleValue").textContent =
    document.getElementById("lightAngle").value;

  document.getElementById("lightElevationValue").textContent =
    document.getElementById("lightElevation").value;

  document.getElementById("lightBrightnessValue").textContent =
    document.getElementById("lightBrightness").value;

  document.getElementById("ambientLightValue").textContent =
    document.getElementById("ambientLight").value;

  document.getElementById("hatchSpacingValue").textContent =
    document.getElementById("hatchSpacing").value;

  document.getElementById("minSpacingValue").textContent =
    document.getElementById("minSpacing").value;

  document.getElementById("hatchAngleValue").textContent =
    document.getElementById("hatchAngle").value;

  document.getElementById("lineJitterValue").textContent =
    document.getElementById("lineJitter").value;
  
  document.getElementById("jitterFrequencyValue").textContent =
    document.getElementById("jitterFrequency").value;
  
  document.getElementById("jitterRandomnessValue").textContent =
    document.getElementById("jitterRandomness").value;

  // Shadow falloff label
  const shadowFalloffEl = document.getElementById("shadowFalloff");
  const shadowFalloffValueEl = document.getElementById("shadowFalloffValue");
  if (shadowFalloffEl && shadowFalloffValueEl) {
    shadowFalloffValueEl.textContent = shadowFalloffEl.value;
  }
  
  // Render mode label
  const renderModeSelect = document.getElementById("renderMode");
  const renderModeLabel = document.getElementById("renderModeLabel");
  if (renderModeSelect && renderModeLabel) {
    const text = renderModeSelect.options[renderModeSelect.selectedIndex].text;
    renderModeLabel.textContent = text;
  }
}

/**
 * Full UI update - sync presets, update labels, and redraw
 * @param {number} orbitHorizontal - Current orbit angle
 */
export function fullUpdate(orbitHorizontal) {
  syncCanvasPresetFromInputs();
  updateViewModeUI();
  updateLabels();
  draw(orbitHorizontal);
}

// Store original click handlers to avoid duplicates
const collapsibleHeaderHandlers = new WeakMap();

/**
 * Setup collapsible sections in the UI
 * @param {boolean} preserveState - If true, don't change collapsed state of sections
 */
export function setupCollapsibleSections(preserveState = false) {
  document.querySelectorAll('.collapsible-header').forEach(header => {
    // Remove old listener if it exists
    const oldHandler = collapsibleHeaderHandlers.get(header);
    if (oldHandler) {
      header.removeEventListener('click', oldHandler);
    }
    
    // Create new handler
    const handler = (e) => {
      // Toggle the section
      const section = header.closest('.collapsible-section');
      if (section) {
        section.classList.toggle('collapsed');
      }
    };
    
    // Store handler for later removal
    collapsibleHeaderHandlers.set(header, handler);
    
    // Use normal event handling (bubble phase, same as modal)
    // The modal handler checks if modal is hidden first, so it won't interfere
    header.addEventListener('click', handler);
  });

  // Initialize: collapse Layers, Lighting, Shading, Animation, and Advanced Debug by default
  // Only if preserveState is false
  if (!preserveState) {
    const sectionsToCollapse = ['layers', 'lighting', 'shading', 'animation', 'advanced-debug'];
    sectionsToCollapse.forEach(sectionId => {
      const header = document.querySelector(`[data-section="${sectionId}"]`);
      if (header) {
        const section = header.closest('.collapsible-section');
        if (section) {
          section.classList.add('collapsed');
        }
      }
    });
  }
}


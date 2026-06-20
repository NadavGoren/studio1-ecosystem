/* ============================================================
   3D ISOMETRIC GENERATOR - Entry Point
   Renders 3D objects as line art with hatch shading
============================================================ */

// Import rendering
import { draw } from './src/rendering/renderer.js';

// Import UI modules
import { updateViewModeUI, updateLabels, setupCollapsibleSections } from './src/ui/updates.js';
import { setupControls, getOrbitHorizontal, setOrbitHorizontal } from './src/ui/controls.js';
import { setupExportButton } from './src/export/svgExporter.js';
import { setupVideoExporter } from './src/export/videoExporter.js';

// Import STL loader
import { initSTLLoader } from './src/loaders/stlLoader.js';

/* ============================================================
   GLOBAL REDRAW FUNCTION
============================================================ */

// Make redraw function available globally for STL loader
window.requestRedraw = function() {
  const orbitHorizontal = getOrbitHorizontal();
  draw(orbitHorizontal);
  console.log('Redraw requested');
};

/* ============================================================
   INITIALIZATION
============================================================ */

function initialize() {
  console.log('=== 3D Generator Initialization Starting ===');
  
  // Check if SVG element exists
  const svg = document.getElementById("svg");
  if (!svg) {
    console.error('CRITICAL: SVG element not found!');
    alert('ERROR: SVG canvas element not found. Please check HTML structure.');
    return;
  }
  console.log('✓ SVG element found');
  
  // Try to draw FIRST, before any UI setup
  try {
    console.log('Attempting initial draw...');
    draw(0); // Draw with orbit = 0
    console.log('✓ Initial draw succeeded!');
  } catch (error) {
    console.error('✗ Draw failed:', error);
    console.error('Stack:', error.stack);
    alert('ERROR drawing: ' + error.message);
    return;
  }
  
  // Now setup UI (these can fail without breaking rendering)
  try {
    console.log('Setting up UI...');
    updateViewModeUI();
    console.log('✓ View mode UI updated');
  } catch (error) {
    console.warn('View mode UI failed:', error.message);
  }
  
  try {
    updateLabels();
    console.log('✓ Labels updated');
  } catch (error) {
    console.warn('Labels update failed:', error.message);
  }
  
  try {
    setupCollapsibleSections();
    console.log('✓ Collapsible sections setup');
  } catch (error) {
    console.warn('Collapsible sections failed:', error.message);
  }
  
  try {
    setupControls();
    console.log('✓ Controls setup');
  } catch (error) {
    console.warn('Controls setup failed:', error.message);
  }
  
  try {
    setupExportButton();
    console.log('✓ Export button setup');
  } catch (error) {
    console.warn('Export setup failed:', error.message);
  }
  
  try {
    setupVideoExporter();
    console.log('✓ Video exporter setup');
  } catch (error) {
    console.warn('Video exporter setup failed:', error.message);
  }
  
  try {
    setupAnimationPreview();
    console.log('✓ Animation preview setup');
  } catch (error) {
    console.warn('Animation preview setup failed:', error.message);
  }
  
  try {
    initSTLLoader();
    console.log('✓ STL loader initialized');
  } catch (error) {
    console.warn('STL loader setup failed:', error.message);
  }
  
  console.log('=== Initialization Complete ===');
}

/* ============================================================
   ANIMATION PREVIEW
   Preview the turntable animation before generating video
============================================================ */

let previewAnimationId = null;
let isPreviewPlaying = false;
let previewStartAngle = 0; // Store start angle to restore on stop

// Check if video is generating (synchronous check using window flag)
function isVideoGenerating() {
  return window.__isGeneratingVideo === true;
}

// Export stopPreview so it can be called from video exporter
export function stopAnimationPreview() {
  // Set flag first to stop animation loop
  isPreviewPlaying = false;
  
  // Cancel any pending animation frames
  if (previewAnimationId !== null) {
    cancelAnimationFrame(previewAnimationId);
    previewAnimationId = null;
  }
  
  // Cancel any additional frames that might be queued
  // Request a frame and immediately cancel it to clear the queue
  const tempId = requestAnimationFrame(() => {});
  cancelAnimationFrame(tempId);
  
  const playBtn = document.getElementById('playPreview');
  if (playBtn) {
    playBtn.classList.remove('playing');
  }
  
  // Return to initial frame (start angle) if we have one stored
  if (previewStartAngle !== undefined) {
    setOrbitHorizontal(previewStartAngle);
    draw(previewStartAngle);
  }
  
  // Clear the stored start angle to prevent interference
  previewStartAngle = undefined;
}

function setupAnimationPreview() {
  const playBtn = document.getElementById('playPreview');
  if (!playBtn) return;
  
  playBtn.addEventListener('click', () => {
    if (isPreviewPlaying) {
      stopPreview();
    } else {
      startPreview();
    }
  });
}

function startPreview() {
  const playBtn = document.getElementById('playPreview');
  if (!playBtn) return;
  
  // CRITICAL: Check if video is generating - if so, DO NOT START PREVIEW
  if (isVideoGenerating()) {
    console.warn('⚠ Cannot start preview: video generation in progress');
    return;
  }
  
  // Get animation parameters
  const startAngle = parseFloat(document.getElementById('animStartAngle')?.value || 0);
  const endAngle = parseFloat(document.getElementById('animEndAngle')?.value || 360);
  const fps = parseInt(document.getElementById('animFps')?.value || 30);
  const frameCount = parseInt(document.getElementById('animFrameCount')?.value || 120);
  
  // Validation
  if (startAngle === endAngle) {
    alert('Start and end angles must be different');
    return;
  }
  
  // Store start angle to restore on stop
  previewStartAngle = startAngle;
  
  // Calculate animation parameters
  // Duration based on frame count and FPS (same as video generation)
  const duration = (frameCount / fps) * 1000; // Duration in milliseconds
  const angleRange = endAngle - startAngle;
  
  // Update button state
  playBtn.classList.add('playing');
  isPreviewPlaying = true;
  
  // Start from the initial angle
  setOrbitHorizontal(startAngle);
  draw(startAngle);
  
  // Start animation
  const startTime = performance.now();
  
  function animate(currentTime) {
    // CRITICAL: Check if video generation started - if so, STOP IMMEDIATELY
    // Check every frame to ensure we stop immediately
    if (isVideoGenerating()) {
      isPreviewPlaying = false;
      if (previewAnimationId !== null) {
        cancelAnimationFrame(previewAnimationId);
        previewAnimationId = null;
      }
      const playBtn = document.getElementById('playPreview');
      if (playBtn) {
        playBtn.classList.remove('playing');
      }
      return;
    }
    
    if (!isPreviewPlaying) {
      previewAnimationId = null;
      return;
    }
    
    const elapsed = currentTime - startTime;
    let progress = (elapsed / duration) % 1; // Loop animation (0 to 1)
    
    // Calculate current angle
    let currentAngle;
    if (startAngle < endAngle) {
      currentAngle = startAngle + (progress * angleRange);
    } else {
      // Handle wrap-around case (e.g., 350° to 10°)
      const normalizedRange = angleRange < 0 ? angleRange + 360 : angleRange - 360;
      currentAngle = startAngle + (progress * normalizedRange);
      if (currentAngle < 0) currentAngle += 360;
      if (currentAngle >= 360) currentAngle -= 360;
    }
    
    // Update orbit state for consistency
    setOrbitHorizontal(currentAngle);
    
    // Render frame at current angle
    draw(currentAngle);
    
    // Continue animation
    previewAnimationId = requestAnimationFrame(animate);
  }
  
  previewAnimationId = requestAnimationFrame(animate);
}

function stopPreview() {
  stopAnimationPreview();
  
  // Restore to current orbit angle from controls
  const currentAngle = getOrbitHorizontal();
  draw(currentAngle);
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

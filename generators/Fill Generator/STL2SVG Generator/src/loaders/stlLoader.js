/* ============================================================
   STL LOADER
   File upload and mesh loading UI component
============================================================ */

import { parseSTL, normalizeMesh } from './stlParser.js';

// Global state for loaded mesh
let currentMesh = null;
let originalParsedMesh = null; // Store original mesh before normalization for re-scaling
let meshMode = 'cube'; // 'cube' or 'stl'

// STL rotation state (in 90-degree increments: 0, 90, 180, 270)
let stlRotationX = 0;
let stlRotationY = 0;
let stlRotationZ = 0;

// LOD geometry cache (to avoid re-merging on every frame)
let geometryCache = {
  high: null,  // Strict merging (for final render)
  low: null    // Aggressive merging (for preview)
};

/**
 * Get current mesh (either cube or STL)
 * @returns {Object|null} Current mesh or null
 */
export function getCurrentMesh() {
  return currentMesh;
}

/**
 * Get current mesh mode
 * @returns {string} 'cube' or 'stl'
 */
export function getMeshMode() {
  return meshMode;
}

/**
 * Set mesh mode
 * @param {string} mode - 'cube' or 'stl'
 */
export function setMeshMode(mode) {
  meshMode = mode;
}

/**
 * Get current STL rotation angles
 * @returns {Object} {x, y, z} rotation angles in degrees
 */
export function getSTLRotation() {
  return { x: stlRotationX, y: stlRotationY, z: stlRotationZ };
}

/**
 * Rotate STL mesh around an axis by 90 degrees
 * @param {string} axis - 'x', 'y', or 'z'
 */
export function rotateSTL90(axis) {
  if (meshMode !== 'stl' || !currentMesh) {
    console.warn('Can only rotate in STL mode with loaded mesh');
    return;
  }
  
  // Increment rotation by 90 degrees (wrapping at 360)
  if (axis === 'x') {
    stlRotationX = (stlRotationX + 90) % 360;
  } else if (axis === 'y') {
    stlRotationY = (stlRotationY + 90) % 360;
  } else if (axis === 'z') {
    stlRotationZ = (stlRotationZ + 90) % 360;
  }
  
  console.log(`STL rotation: X=${stlRotationX}° Y=${stlRotationY}° Z=${stlRotationZ}°`);
  
  // Trigger redraw
  if (window.requestRedraw) {
    window.requestRedraw();
  }
}

/**
 * Update STL mesh size based on current size slider value
 * Called when the size slider changes
 */
export function updateSTLSize() {
  if (meshMode !== 'stl' || !originalParsedMesh) {
    return; // Only update if in STL mode with loaded mesh
  }
  
  // Get current target size from slider
  const cubeSize = parseFloat(document.getElementById('cubeSize')?.value || 120);
  
  // Re-normalize mesh with new size
  currentMesh = normalizeMesh(originalParsedMesh, cubeSize);
  
  // Clear cache when size changes (geometry needs re-processing)
  geometryCache = { high: null, low: null };
  console.log(`STL size updated to: ${cubeSize}mm (cache cleared)`);
  
  // Trigger redraw
  if (window.requestRedraw) {
    window.requestRedraw();
  }
}

/**
 * Get cached geometry for specified LOD level
 * @param {string} lodLevel - 'high' or 'low'
 * @returns {Object|null} Cached geometry or null if not cached
 */
export function getCachedGeometry(lodLevel) {
  return geometryCache[lodLevel];
}

/**
 * Set cached geometry for specified LOD level
 * @param {string} lodLevel - 'high' or 'low'
 * @param {Object} geometry - Geometry to cache
 */
export function setCachedGeometry(lodLevel, geometry) {
  geometryCache[lodLevel] = geometry;
}

/**
 * Initialize STL loader
 * Sets up file input and drag-drop handlers
 */
export function initSTLLoader() {
  const fileInput = document.getElementById('stlFileInput');
  const dropZone = document.getElementById('stlDropZone');
  const meshInfo = document.getElementById('meshInfo');
  const clearBtn = document.getElementById('clearSTL');
  const switchModeBtn = document.getElementById('switchMode');

  if (!fileInput || !dropZone) {
    console.warn('STL loader elements not found in DOM');
    return;
  }

  // File input change handler
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      await loadSTLFile(file);
    }
  });

  // Drop zone handlers
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.stl')) {
      await loadSTLFile(file);
    } else {
      showError('Please drop an STL file');
    }
  });

  // Click to upload
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  // Clear STL button
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearSTL();
    });
  }

  // Switch mode button
  if (switchModeBtn) {
    switchModeBtn.addEventListener('click', () => {
      toggleMeshMode();
    });
  }

  // STL rotation buttons
  const rotateX90Btn = document.getElementById('rotateX90');
  const rotateY90Btn = document.getElementById('rotateY90');
  const rotateZ90Btn = document.getElementById('rotateZ90');

  if (rotateX90Btn) {
    rotateX90Btn.addEventListener('click', () => {
      rotateSTL90('x');
    });
  }

  if (rotateY90Btn) {
    rotateY90Btn.addEventListener('click', () => {
      rotateSTL90('y');
    });
  }

  if (rotateZ90Btn) {
    rotateZ90Btn.addEventListener('click', () => {
      rotateSTL90('z');
    });
  }
}

/**
 * Load STL file and parse it
 * @param {File} file - The STL file to load
 */
async function loadSTLFile(file) {
  const dropZone = document.getElementById('stlDropZone');
  const meshInfo = document.getElementById('meshInfo');
  const statusEl = document.getElementById('meshStatus');
  
  try {
    // Show loading state
    if (dropZone) dropZone.classList.add('loading');
    if (statusEl) statusEl.textContent = 'Loading...';
    
    // Parse STL file
    const mesh = await parseSTL(file);
    
    // Store original parsed mesh for re-normalization when size changes
    originalParsedMesh = mesh;
    
    // Get target size from cube size control
    const cubeSize = parseFloat(document.getElementById('cubeSize')?.value || 120);
    
    // Normalize mesh to fit within target size
    const normalizedMesh = normalizeMesh(mesh, cubeSize);
    
    // Store mesh
    currentMesh = normalizedMesh;
    meshMode = 'stl';
    
    // Update UI
    updateMeshInfo(normalizedMesh, file.name);
    
    // Optimize hatch spacing for STL (reduce line density for better performance)
    const hatchSpacingInput = document.getElementById('hatchSpacing');
    const hatchSpacingValue = document.getElementById('hatchSpacingValue');
    if (hatchSpacingInput && parseFloat(hatchSpacingInput.value) < 3.0) {
      hatchSpacingInput.value = '3.0'; // Increase from default 2.0 to 3.0 for STL
      if (hatchSpacingValue) hatchSpacingValue.textContent = '3.0';
      console.log('Hatch spacing optimized for STL: 3.0mm (was <3.0mm)');
    }
    
    // Hide drop zone, show mesh info
    if (dropZone) dropZone.style.display = 'none';
    if (meshInfo) meshInfo.style.display = 'block';
    
    // Trigger redraw
    if (window.requestRedraw) {
      window.requestRedraw();
    }
    
    console.log('STL loaded:', {
      triangles: normalizedMesh.triangleCount,
      vertices: normalizedMesh.vertices.length,
      boundingBox: normalizedMesh.boundingBox
    });
    
  } catch (error) {
    console.error('Error loading STL:', error);
    showError(error.message || 'Failed to load STL file');
  } finally {
    if (dropZone) dropZone.classList.remove('loading');
  }
}

/**
 * Update mesh info display
 * @param {Object} mesh - The loaded mesh
 * @param {string} filename - Original filename
 */
function updateMeshInfo(mesh, filename) {
  const filenameEl = document.getElementById('meshFilename');
  const trianglesEl = document.getElementById('meshTriangles');
  const verticesEl = document.getElementById('meshVertices');
  const sizeEl = document.getElementById('meshSize');
  
  if (filenameEl) filenameEl.textContent = filename;
  if (trianglesEl) trianglesEl.textContent = mesh.triangleCount.toLocaleString();
  if (verticesEl) verticesEl.textContent = mesh.vertices.length.toLocaleString();
  
  if (sizeEl && mesh.originalBBox) {
    const bbox = mesh.originalBBox;
    const sizeStr = `${bbox.size.x.toFixed(1)} × ${bbox.size.y.toFixed(1)} × ${bbox.size.z.toFixed(1)} mm`;
    sizeEl.textContent = sizeStr;
  }
}

/**
 * Clear loaded STL and return to cube mode
 */
function clearSTL() {
  currentMesh = null;
  originalParsedMesh = null; // Clear stored original mesh
  meshMode = 'cube';
  
  // Reset rotations
  stlRotationX = 0;
  stlRotationY = 0;
  stlRotationZ = 0;
  
  // Clear geometry cache
  geometryCache = { high: null, low: null };
  
  const dropZone = document.getElementById('stlDropZone');
  const meshInfo = document.getElementById('meshInfo');
  const fileInput = document.getElementById('stlFileInput');
  
  if (dropZone) dropZone.style.display = 'flex';
  if (meshInfo) meshInfo.style.display = 'none';
  if (fileInput) fileInput.value = '';
  
  // Trigger redraw
  if (window.requestRedraw) {
    window.requestRedraw();
  }
  
  console.log('STL cleared, returned to cube mode');
}

/**
 * Toggle between cube and STL mode
 */
function toggleMeshMode() {
  if (meshMode === 'cube') {
    // Check if we have a loaded STL
    if (currentMesh) {
      meshMode = 'stl';
    } else {
      showError('No STL file loaded. Please upload an STL file first.');
      return;
    }
  } else {
    meshMode = 'cube';
  }
  
  updateModeUI();
  
  // Trigger redraw
  if (window.requestRedraw) {
    window.requestRedraw();
  }
}

/**
 * Update UI to reflect current mode
 */
function updateModeUI() {
  const switchBtn = document.getElementById('switchMode');
  const modeIndicator = document.getElementById('currentMode');
  
  if (switchBtn) {
    switchBtn.textContent = meshMode === 'cube' ? '📦 Switch to STL' : '🧊 Switch to Cube';
  }
  
  if (modeIndicator) {
    modeIndicator.textContent = meshMode === 'cube' ? 'Cube Mode' : 'STL Mode';
  }
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  const statusEl = document.getElementById('meshStatus');
  if (statusEl) {
    statusEl.textContent = `Error: ${message}`;
    statusEl.style.color = 'red';
    setTimeout(() => {
      statusEl.style.color = '';
      statusEl.textContent = '';
    }, 3000);
  }
  alert(message);
}


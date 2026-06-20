/* ============================================================
   VISIBILITY CHECKER
   Uses Three.js GPU rendering to determine which faces are visible
   via ID buffer technique (each face = unique color)
============================================================ */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Module state
let renderer = null;
let scene = null;
let camera = null;
let renderTarget = null;
let pixelBuffer = null;
let isInitialized = false;

// ============================================================
// VISIBILITY CACHE
// Caches GPU visibility results to avoid redundant rendering
// when only non-view parameters (lighting, colors) change
// ============================================================
let visibilityCache = {
  result: null,           // Set of visible face indices
  viewMode: null,         // 'isometric' or 'perspective'
  perspectiveStrength: null,
  vertexHash: null,       // Hash of vertex positions to detect mesh changes
  faceCount: null,        // Number of faces
  timestamp: null,        // When cache was created
  hits: 0,                // Cache hit counter
  misses: 0               // Cache miss counter
};

/**
 * Compute a simple hash of vertex positions for cache invalidation
 * Uses sampling for performance with large meshes
 * @param {Array} vertices - Array of {x, y, z} vertices
 * @returns {string} Hash string
 */
function computeVertexHash(vertices) {
  if (!vertices || vertices.length === 0) return 'empty';
  
  // Sample vertices for hash (every Nth vertex + first/last)
  const sampleSize = Math.min(20, vertices.length);
  const step = Math.max(1, Math.floor(vertices.length / sampleSize));
  
  let hash = vertices.length.toString();
  
  for (let i = 0; i < vertices.length; i += step) {
    const v = vertices[i];
    if (v) {
      // Round to 2 decimal places to avoid float precision issues
      hash += `|${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
    }
  }
  
  // Include last vertex
  const last = vertices[vertices.length - 1];
  if (last) {
    hash += `|L:${last.x.toFixed(2)},${last.y.toFixed(2)},${last.z.toFixed(2)}`;
  }
  
  return hash;
}

/**
 * Check if cached visibility result is still valid
 * @param {Array} vertices - Current vertices
 * @param {Array} faces - Current faces
 * @param {Object} params - Current view parameters
 * @returns {boolean} True if cache is valid
 */
function isCacheValid(vertices, faces, params) {
  if (!visibilityCache.result) return false;
  
  const { viewMode = 'isometric', perspectiveStrength = 0 } = params;
  
  // Check view parameters
  if (visibilityCache.viewMode !== viewMode) return false;
  if (visibilityCache.perspectiveStrength !== perspectiveStrength) return false;
  
  // Check face count
  if (visibilityCache.faceCount !== faces.length) return false;
  
  // Check vertex hash (detects mesh rotation/transformation)
  const currentHash = computeVertexHash(vertices);
  if (visibilityCache.vertexHash !== currentHash) return false;
  
  return true;
}

/**
 * Update the visibility cache with new results
 * @param {Set} result - Visible face indices
 * @param {Array} vertices - Vertices used
 * @param {Array} faces - Faces used
 * @param {Object} params - View parameters
 */
function updateCache(result, vertices, faces, params) {
  const { viewMode = 'isometric', perspectiveStrength = 0 } = params;
  
  visibilityCache = {
    result: new Set(result), // Clone the set
    viewMode,
    perspectiveStrength,
    vertexHash: computeVertexHash(vertices),
    faceCount: faces.length,
    timestamp: Date.now(),
    hits: visibilityCache.hits,
    misses: visibilityCache.misses + 1
  };
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getVisibilityCacheStats() {
  const total = visibilityCache.hits + visibilityCache.misses;
  const hitRate = total > 0 ? ((visibilityCache.hits / total) * 100).toFixed(1) : '0.0';
  
  return {
    hits: visibilityCache.hits,
    misses: visibilityCache.misses,
    hitRate: `${hitRate}%`,
    hasCache: visibilityCache.result !== null,
    cacheAge: visibilityCache.timestamp ? Date.now() - visibilityCache.timestamp : null
  };
}

/**
 * Clear the visibility cache (call when mesh changes)
 */
export function clearVisibilityCache() {
  visibilityCache = {
    result: null,
    viewMode: null,
    perspectiveStrength: null,
    vertexHash: null,
    faceCount: null,
    timestamp: null,
    hits: 0,
    misses: 0
  };
  console.log('Visibility cache cleared');
}

// Configuration
const BUFFER_SIZE = 512; // Resolution of visibility buffer

// ============================================================
// BOUNDING BOX UTILITIES
// For early rejection of face groups outside view frustum
// ============================================================

/**
 * Calculate axis-aligned bounding box for a set of vertices
 * @param {Array} vertices - Array of {x, y, z} vertices
 * @param {Array} indices - Optional array of indices to use
 * @returns {Object} Bounding box {min: {x,y,z}, max: {x,y,z}, center: {x,y,z}, size: number}
 */
export function calculateBoundingBox(vertices, indices = null) {
  const points = indices ? indices.map(i => vertices[i]) : vertices;
  
  if (points.length === 0) {
    return { min: {x:0,y:0,z:0}, max: {x:0,y:0,z:0}, center: {x:0,y:0,z:0}, size: 0 };
  }
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  
  for (const v of points) {
    if (!v) continue;
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
    if (v.z < minZ) minZ = v.z;
    if (v.z > maxZ) maxZ = v.z;
  }
  
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2
    },
    size: Math.max(maxX - minX, maxY - minY, maxZ - minZ)
  };
}

/**
 * Check if a bounding box is potentially visible from the isometric view direction
 * Uses a simplified frustum culling check based on the view direction
 * @param {Object} bbox - Bounding box from calculateBoundingBox
 * @param {Object} viewDir - View direction {x, y, z} (normalized)
 * @param {Object} meshBBox - Overall mesh bounding box for reference
 * @returns {boolean} True if the bbox might be visible
 */
export function isBoundingBoxPotentiallyVisible(bbox, viewDir, meshBBox) {
  // For isometric view, a face group is definitely hidden if:
  // 1. It's completely behind another bounding box along the view direction
  // 2. Its projected 2D bounds don't overlap with the mesh bounds
  
  // Simple depth-based check: faces at the back of the mesh (along view dir)
  // are potentially occluded. We use a conservative check here.
  
  // Calculate depth of bbox center along view direction
  const bboxDepth = bbox.center.x * viewDir.x + 
                    bbox.center.y * viewDir.y + 
                    bbox.center.z * viewDir.z;
  
  // Calculate depth range of entire mesh
  const meshMinDepth = meshBBox.min.x * viewDir.x + 
                       meshBBox.min.y * viewDir.y + 
                       meshBBox.min.z * viewDir.z;
  const meshMaxDepth = meshBBox.max.x * viewDir.x + 
                       meshBBox.max.y * viewDir.y + 
                       meshBBox.max.z * viewDir.z;
  
  // If this bbox is completely at the back, it might be occluded
  // But we can't be sure without full occlusion testing, so we
  // use this as a hint rather than a hard cull
  
  // For now, always return true (no early rejection)
  // The real culling happens in the GPU visibility check
  // This function is for future hierarchical culling optimization
  return true;
}

/**
 * Group faces by spatial octants for hierarchical processing
 * @param {Array} vertices - Array of {x, y, z} vertices
 * @param {Array} faces - Array of face objects with indices
 * @returns {Object} Groups with bounding boxes and face indices
 */
export function groupFacesByOctant(vertices, faces) {
  // Calculate overall mesh bounding box
  const meshBBox = calculateBoundingBox(vertices);
  const center = meshBBox.center;
  
  // Create 8 octants
  const octants = Array(8).fill(null).map(() => ({
    faceIndices: [],
    bbox: null
  }));
  
  // Assign each face to an octant based on its centroid
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    if (!face || !face.indices || face.indices.length < 3) continue;
    
    // Calculate face centroid
    let cx = 0, cy = 0, cz = 0;
    let validCount = 0;
    for (const idx of face.indices) {
      const v = vertices[idx];
      if (v) {
        cx += v.x;
        cy += v.y;
        cz += v.z;
        validCount++;
      }
    }
    
    if (validCount === 0) continue;
    
    cx /= validCount;
    cy /= validCount;
    cz /= validCount;
    
    // Determine octant (3-bit index based on position relative to center)
    const octantIndex = 
      (cx >= center.x ? 1 : 0) | 
      (cy >= center.y ? 2 : 0) | 
      (cz >= center.z ? 4 : 0);
    
    octants[octantIndex].faceIndices.push(i);
  }
  
  // Calculate bounding box for each non-empty octant
  for (const octant of octants) {
    if (octant.faceIndices.length === 0) continue;
    
    // Collect all vertices from faces in this octant
    const octantVertices = [];
    for (const faceIdx of octant.faceIndices) {
      const face = faces[faceIdx];
      for (const idx of face.indices) {
        const v = vertices[idx];
        if (v) octantVertices.push(v);
      }
    }
    
    octant.bbox = calculateBoundingBox(octantVertices);
  }
  
  return {
    octants: octants.filter(o => o.faceIndices.length > 0),
    meshBBox
  };
}

/**
 * Initialize the Three.js visibility checker (call once on startup)
 */
export function initVisibilityChecker() {
  if (isInitialized) return;
  
  console.log('Initializing Three.js visibility checker...');
  
  // Create offscreen WebGL renderer
  renderer = new THREE.WebGLRenderer({
    antialias: false,  // Must be false for exact color reading
    preserveDrawingBuffer: true,
    alpha: false
  });
  renderer.setSize(BUFFER_SIZE, BUFFER_SIZE);
  renderer.setClearColor(0x000000, 1); // Black background = no face
  
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  
  // Create orthographic camera (will be configured per-render)
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
  
  // Create render target for pixel reading
  renderTarget = new THREE.WebGLRenderTarget(BUFFER_SIZE, BUFFER_SIZE, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType
  });
  
  // Pixel buffer for reading back
  pixelBuffer = new Uint8Array(BUFFER_SIZE * BUFFER_SIZE * 4);
  
  isInitialized = true;
  console.log('✓ Visibility checker initialized');
}

/**
 * Encode face index as RGB color
 * Supports up to 16,777,215 faces (24-bit)
 * @param {number} index - Face index (0-based)
 * @returns {THREE.Color} Color encoding the index
 */
function faceIndexToColor(index) {
  // Add 1 to avoid black (0,0,0) which is our background
  const encodedIndex = index + 1;
  return new THREE.Color(
    (encodedIndex & 0xFF) / 255,
    ((encodedIndex >> 8) & 0xFF) / 255,
    ((encodedIndex >> 16) & 0xFF) / 255
  );
}

/**
 * Decode RGB color back to face index
 * @param {number} r - Red channel (0-255)
 * @param {number} g - Green channel (0-255)
 * @param {number} b - Blue channel (0-255)
 * @returns {number} Face index, or -1 if background
 */
function colorToFaceIndex(r, g, b) {
  if (r === 0 && g === 0 && b === 0) return -1; // Background
  const encodedIndex = r + (g << 8) + (b << 16);
  return encodedIndex - 1; // Subtract 1 to get original index
}

/**
 * Configure camera to match the app's isometric or perspective view
 * @param {Object} params - Camera parameters
 */
function configureCamera(params) {
  const { viewMode, perspectiveStrength, boundingSize, center } = params;
  
  // Add padding to ensure full visibility
  const size = boundingSize * 1.5;
  
  // Target point - center of the mesh, not origin
  const lookAtPoint = new THREE.Vector3(center.x, center.y, center.z);
  
  if (viewMode === 'isometric') {
    // Orthographic camera for isometric view
    camera = new THREE.OrthographicCamera(-size, size, size, -size, 0.1, 2000);
    
    // Position camera to match isometric projection
    // The app's isometric view shows top, front (+Y), and right (+X) faces
    // Camera at (1, 1, 1) direction from the mesh center
    const isoDir = new THREE.Vector3(1, 1, 1).normalize();
    camera.position.copy(lookAtPoint.clone().add(isoDir.multiplyScalar(500)));
    camera.lookAt(lookAtPoint);
    camera.up.set(0, 0, 1); // Z is up
  } else {
    // Perspective camera
    const fov = 45 + (perspectiveStrength * 10);
    camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 2000);
    
    const isoDir = new THREE.Vector3(1, 1, 1).normalize();
    camera.position.copy(lookAtPoint.clone().add(isoDir.multiplyScalar(size * 3)));
    camera.lookAt(lookAtPoint);
    camera.up.set(0, 0, 1);
  }
}

/**
 * Build Three.js geometry from mesh data with unique colors per face
 * @param {Array} vertices - Array of {x, y, z} vertices
 * @param {Array} faces - Array of face objects with indices
 * @returns {THREE.Mesh} Mesh with per-face colors
 */
function buildColoredMesh(vertices, faces) {
  const geometry = new THREE.BufferGeometry();
  
  // We need to create separate triangles for each face
  // Each triangle has 3 vertices, each vertex has: position (3) + color (3)
  const positions = [];
  const colors = [];
  
  for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
    const face = faces[faceIdx];
    if (!face || !face.indices || face.indices.length < 3) continue;
    
    const faceColor = faceIndexToColor(faceIdx);
    const indices = face.indices;
    
    // Triangulate the face (fan triangulation for convex polygons)
    for (let i = 1; i < indices.length - 1; i++) {
      const v0 = vertices[indices[0]];
      const v1 = vertices[indices[i]];
      const v2 = vertices[indices[i + 1]];
      
      if (!v0 || !v1 || !v2) continue;
      
      // Add triangle vertices in original order
      positions.push(v0.x, v0.y, v0.z);
      positions.push(v1.x, v1.y, v1.z);
      positions.push(v2.x, v2.y, v2.z);
      
      // Add face color to all 3 vertices
      colors.push(faceColor.r, faceColor.g, faceColor.b);
      colors.push(faceColor.r, faceColor.g, faceColor.b);
      colors.push(faceColor.r, faceColor.g, faceColor.b);
    }
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
  // Use vertex colors material (unlit, exact colors)
  // Use BackSide to flip which faces are visible (shows top, front, right instead of bottom, back, left)
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide // DEBUG: See all faces
  });
  
  return new THREE.Mesh(geometry, material);
}

/**
 * Get visible face indices using GPU ID buffer rendering
 * @param {Array} vertices - Transformed vertices (after all rotations)
 * @param {Array} faces - Face definitions with indices
 * @param {Object} params - Camera and transform parameters
 * @returns {Set<number>} Set of visible face indices
 */
export function getVisibleFaces(vertices, faces, params) {
  if (!isInitialized) {
    initVisibilityChecker();
  }
  
  const { viewMode = 'isometric', perspectiveStrength = 0 } = params;
  
  // ============================================================
  // CACHE CHECK: Return cached result if view hasn't changed
  // ============================================================
  if (isCacheValid(vertices, faces, params)) {
    visibilityCache.hits++;
    console.log(`Visibility cache HIT (${visibilityCache.result.size} faces, ${getVisibilityCacheStats().hitRate} hit rate)`);
    return visibilityCache.result;
  }
  
  // ============================================================
  // BOUNDING BOX ANALYSIS: Group faces by spatial octants
  // This enables hierarchical culling for large meshes
  // ============================================================
  const { octants, meshBBox } = groupFacesByOctant(vertices, faces);
  
  // Log octant distribution for debugging
  const octantStats = octants.map((o, i) => `O${i}:${o.faceIndices.length}`).join(' ');
  console.log(`Spatial distribution: ${octantStats} (${octants.length} non-empty octants)`);
  
  // Use mesh bounding box for camera setup
  const boundingSize = meshBBox.size;
  const centerX = meshBBox.center.x;
  const centerY = meshBBox.center.y;
  const centerZ = meshBBox.center.z;
  
  // Clear scene
  while (scene.children.length > 0) {
    const child = scene.children[0];
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
    scene.remove(child);
  }
  
  // Configure camera - pass center so it looks at the mesh, not origin
  configureCamera({
    viewMode,
    perspectiveStrength,
    boundingSize,
    center: { x: centerX, y: centerY, z: centerZ }
  });
  
  // Build mesh with per-face colors
  const mesh = buildColoredMesh(vertices, faces);
  scene.add(mesh);
  
  // Render to offscreen buffer
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);
  
  // Read pixels back
  renderer.readRenderTargetPixels(
    renderTarget,
    0, 0,
    BUFFER_SIZE, BUFFER_SIZE,
    pixelBuffer
  );
  
  // Reset render target
  renderer.setRenderTarget(null);
  
  // Collect visible face indices from pixel colors
  const visibleFaces = new Set();
  
  for (let i = 0; i < pixelBuffer.length; i += 4) {
    const r = pixelBuffer[i];
    const g = pixelBuffer[i + 1];
    const b = pixelBuffer[i + 2];
    
    const faceIndex = colorToFaceIndex(r, g, b);
    if (faceIndex >= 0 && faceIndex < faces.length) {
      visibleFaces.add(faceIndex);
    }
  }
  
  // ============================================================
  // UPDATE CACHE: Store result for future requests with same params
  // ============================================================
  updateCache(visibleFaces, vertices, faces, params);
  
  const stats = getVisibilityCacheStats();
  console.log(`Visibility check: ${visibleFaces.size} of ${faces.length} faces visible (cache MISS, ${stats.hitRate} hit rate)`);
  
  return visibleFaces;
}

/**
 * Clean up Three.js resources
 */
export function disposeVisibilityChecker() {
  if (renderTarget) {
    renderTarget.dispose();
    renderTarget = null;
  }
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  scene = null;
  camera = null;
  pixelBuffer = null;
  isInitialized = false;
  
  // Clear cache on dispose
  clearVisibilityCache();
  
  console.log('Visibility checker disposed');
}


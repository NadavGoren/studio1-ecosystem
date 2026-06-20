/* ============================================================
   GEOMETRY
   Cube and STL mesh geometry functions
============================================================ */

/**
 * Calculate the cross product of two 3D vectors
 */
function crossProduct(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

/**
 * Normalize a 3D vector, returns {0,0,1} if zero length
 */
function normalizeVector(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len < 1e-10) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Convert STL mesh to geometry format compatible with renderer
 * @param {Object} mesh - Mesh from STL parser with vertices and faces
 * @param {string} lodLevel - Level of detail: 'high' or 'low'
 * @param {Object} cache - Optional cache object with get/set methods
 * @returns {Object} Geometry object with vertices and faces
 */
export function convertSTLMesh(mesh, lodLevel = 'high', cache = null) {
  if (!mesh || !mesh.vertices || !mesh.faces) {
    throw new Error('Invalid mesh: missing vertices or faces');
  }

  // Check cache first if provided
  if (cache && cache.get) {
    const cached = cache.get(lodLevel);
    if (cached) {
      console.log(`Using CACHED geometry for LOD=${lodLevel}`);
      return cached;
    }
  }

  console.log(`Converting STL mesh: ${mesh.vertices.length} vertices, ${mesh.faces.length} triangles (LOD=${lodLevel})`);

  // Convert faces from triangles to renderer format
  const convertedFaces = mesh.faces.map((face, index) => {
    // Each STL face is a triangle with 3 vertex indices
    const indices = face.indices;
    
    // Normalize the normal vector from STL
    const normal = normalizeVector(face.normal);
    
    // Assign hatch angle based on face orientation (similar to cube faces)
    // This creates visual variety in the hatching
    const hatchAngleOffset = (index * 17) % 180; // Vary angle per face
    
    return {
      indices,
      normal,
      name: `face_${index}`,
      hatchAngleOffset
    };
  });

  const geometry = {
    vertices: mesh.vertices,
    faces: convertedFaces,
    isSTL: true
  };

  // MERGE COPLANAR FACES
  // This combines adjacent triangles on the same plane into unified polygons
  // Dramatically improves rendering quality for STL files
  const mergedGeometry = mergeCoplanarFaces(geometry, lodLevel);
  
  console.log(`STL conversion complete: ${convertedFaces.length} triangles → ${mergedGeometry.faces.length} faces`);
  const reductionPercent = ((1 - mergedGeometry.faces.length / convertedFaces.length) * 100).toFixed(1);
  console.log(`Face count reduced by ${reductionPercent}%`);

  // Store in cache if provided
  if (cache && cache.set) {
    cache.set(lodLevel, mergedGeometry);
    console.log(`Cached geometry for LOD=${lodLevel}`);
  }

  return mergedGeometry;
}

/**
 * Check if two normals are similar (within angle tolerance)
 * @param {Object} n1 - First normal {x, y, z}
 * @param {Object} n2 - Second normal {x, y, z}
 * @param {number} angleTolerance - Tolerance in radians
 * @returns {boolean} True if normals are similar
 */
function areNormalsSimilar(n1, n2, angleTolerance) {
  // Normalize both normals
  const len1 = Math.sqrt(n1.x ** 2 + n1.y ** 2 + n1.z ** 2);
  const len2 = Math.sqrt(n2.x ** 2 + n2.y ** 2 + n2.z ** 2);
  
  if (len1 < 1e-10 || len2 < 1e-10) return false;
  
  const norm1 = { x: n1.x / len1, y: n1.y / len1, z: n1.z / len1 };
  const norm2 = { x: n2.x / len2, y: n2.y / len2, z: n2.z / len2 };
  
  // Dot product gives cosine of angle between normals
  const dot = norm1.x * norm2.x + norm1.y * norm2.y + norm1.z * norm2.z;
  
  // Clamp to [-1, 1] to handle floating point errors
  const clampedDot = Math.max(-1, Math.min(1, dot));
  
  // Calculate angle between normals
  const angle = Math.acos(clampedDot);
  
  return angle < angleTolerance;
}

/**
 * Check if two triangular faces are coplanar
 * @param {Object} face1 - First face with vertices and normal
 * @param {Object} face2 - Second face with vertices and normal
 * @param {Array} vertices - Array of all vertices
 * @param {number} angleTolerance - Angle tolerance in radians
 * @param {number} distTolerance - Distance tolerance
 * @returns {boolean} True if faces are coplanar
 */
function areFacesCoplanar(face1, face2, vertices, angleTolerance, distTolerance) {
  // First check: normals must be similar
  if (!areNormalsSimilar(face1.normal, face2.normal, angleTolerance)) {
    return false;
  }
  
  // Second check: vertices of face2 must lie on plane of face1
  // Plane equation: n·(p - p0) = 0, where n is normal, p0 is a point on plane
  const n = face1.normal;
  const len = Math.sqrt(n.x ** 2 + n.y ** 2 + n.z ** 2);
  if (len < 1e-10) return false;
  
  // Normalize normal
  const nx = n.x / len;
  const ny = n.y / len;
  const nz = n.z / len;
  
  // Get a point on face1's plane
  const p0 = vertices[face1.indices[0]];
  
  // Check all vertices of face2
  for (const idx of face2.indices) {
    const p = vertices[idx];
    
    // Calculate distance from point to plane
    // distance = |n·(p - p0)|
    const dx = p.x - p0.x;
    const dy = p.y - p0.y;
    const dz = p.z - p0.z;
    
    const distance = Math.abs(nx * dx + ny * dy + nz * dz);
    
    if (distance > distTolerance) {
      return false;
    }
  }
  
  return true;
}

/**
 * Find shared edge between two triangular faces
 * @param {Object} face1 - First face with indices
 * @param {Object} face2 - Second face with indices
 * @returns {Array|null} Shared edge as [v1, v2] or null if no shared edge
 */
function findSharedEdge(face1, face2) {
  const indices1 = face1.indices;
  const indices2 = face2.indices;
  
  // Find vertices that appear in both faces
  const sharedVertices = indices1.filter(v => indices2.includes(v));
  
  // Need exactly 2 shared vertices for a shared edge
  if (sharedVertices.length !== 2) {
    return null;
  }
  
  // Check if these vertices form an edge in both faces
  const [v1, v2] = sharedVertices;
  
  // Check if v1 and v2 are adjacent in face1
  const isEdgeInFace1 = indices1.some((v, i) => {
    const next = indices1[(i + 1) % indices1.length];
    return (v === v1 && next === v2) || (v === v2 && next === v1);
  });
  
  // Check if v1 and v2 are adjacent in face2
  const isEdgeInFace2 = indices2.some((v, i) => {
    const next = indices2[(i + 1) % indices2.length];
    return (v === v1 && next === v2) || (v === v2 && next === v1);
  });
  
  if (isEdgeInFace1 && isEdgeInFace2) {
    return [v1, v2];
  }
  
  return null;
}

/**
 * Build a polygon from a group of connected triangular faces
 * @param {Array} faces - Array of face objects with indices
 * @param {Array} vertices - Array of all vertices
 * @returns {Array} Array of vertex indices forming the polygon boundary
 */
function buildPolygonFromTriangles(faces, vertices) {
  if (faces.length === 0) return [];
  if (faces.length === 1) return faces[0].indices;
  
  // Collect all edges and count their occurrences
  const edgeCount = new Map();
  
  for (const face of faces) {
    const indices = face.indices;
    for (let i = 0; i < indices.length; i++) {
      const v1 = indices[i];
      const v2 = indices[(i + 1) % indices.length];
      
      // Create edge key (sorted to make undirected)
      const edgeKey = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
      
      edgeCount.set(edgeKey, (edgeCount.get(edgeKey) || 0) + 1);
    }
  }
  
  // Boundary edges appear exactly once (internal edges appear twice)
  const boundaryEdges = [];
  for (const [edgeKey, count] of edgeCount.entries()) {
    if (count === 1) {
      const [v1, v2] = edgeKey.split('-').map(Number);
      boundaryEdges.push({ v1, v2 });
    }
  }
  
  if (boundaryEdges.length === 0) {
    // No boundary found, return first face
    return faces[0].indices;
  }
  
  // Build ordered polygon by connecting boundary edges
  const polygon = [];
  const usedEdges = new Set();
  
  // Start with first boundary edge
  let currentVertex = boundaryEdges[0].v1;
  let nextVertex = boundaryEdges[0].v2;
  polygon.push(currentVertex);
  usedEdges.add(0);
  
  // Follow the chain of edges
  while (polygon.length < boundaryEdges.length) {
    polygon.push(nextVertex);
    currentVertex = nextVertex;
    
    // Find next edge that starts with current vertex
    let foundNext = false;
    for (let i = 0; i < boundaryEdges.length; i++) {
      if (usedEdges.has(i)) continue;
      
      const edge = boundaryEdges[i];
      if (edge.v1 === currentVertex) {
        nextVertex = edge.v2;
        usedEdges.add(i);
        foundNext = true;
        break;
      } else if (edge.v2 === currentVertex) {
        nextVertex = edge.v1;
        usedEdges.add(i);
        foundNext = true;
        break;
      }
    }
    
    if (!foundNext) {
      // Chain broken, polygon might not be closed
      break;
    }
    
    // Check if we've returned to start
    if (nextVertex === polygon[0]) {
      break;
    }
  }
  
  // Remove duplicate vertices
  const uniquePolygon = [];
  for (let i = 0; i < polygon.length; i++) {
    if (i === polygon.length - 1 || polygon[i] !== polygon[i + 1]) {
      uniquePolygon.push(polygon[i]);
    }
  }
  
  return uniquePolygon;
}

/**
 * Calculate normal vector for a polygon using Newell's method
 * More robust than cross product for complex/concave polygons
 * @param {Array} indices - Vertex indices of the polygon
 * @param {Array} vertices - Array of all vertices
 * @returns {Object} Normal vector {x, y, z} or null if calculation fails
 */
function calculatePolygonNormal(indices, vertices) {
  if (indices.length < 3) return null;
  
  // Newell's method: sum of cross products of consecutive edges
  // More stable for polygons with many vertices
  let nx = 0, ny = 0, nz = 0;
  
  for (let i = 0; i < indices.length; i++) {
    const curr = vertices[indices[i]];
    const next = vertices[indices[(i + 1) % indices.length]];
    
    if (!curr || !next) continue;
    
    // Accumulate cross product components
    nx += (curr.y - next.y) * (curr.z + next.z);
    ny += (curr.z - next.z) * (curr.x + next.x);
    nz += (curr.x - next.x) * (curr.y + next.y);
  }
  
  // Normalize
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < 1e-10) return null;
  
  return {
    x: nx / len,
    y: ny / len,
    z: nz / len
  };
}

/**
 * Merge coplanar triangular faces into larger polygons
 * This reduces the number of faces and improves rendering performance
 * @param {Object} geometry - Geometry with triangular faces
 * @param {string} lodLevel - Level of detail: 'high' (strict, final) or 'low' (aggressive, preview)
 * @returns {Object} Geometry with merged faces
 */
export function mergeCoplanarFaces(geometry, lodLevel = 'high') {
  if (!geometry || !geometry.faces || !geometry.vertices) {
    return geometry;
  }
  
  // Skip merging for non-STL geometries (like cube)
  if (!geometry.isSTL) {
    return geometry;
  }
  
  const faces = geometry.faces;
  const vertices = geometry.vertices;
  
  // Adjust tolerances based on LOD level
  let ANGLE_TOLERANCE, DIST_TOLERANCE;
  
  if (lodLevel === 'low') {
    // Aggressive merging for preview/navigation (10x more lenient)
    ANGLE_TOLERANCE = 10 * Math.PI / 180; // 10 degrees (vs 1 degree)
    DIST_TOLERANCE = 2.0; // 2mm (vs 0.1mm)
    console.log(`Starting AGGRESSIVE LOD merging (preview): ${faces.length} faces`);
  } else {
    // Strict merging for final output
    ANGLE_TOLERANCE = 1 * Math.PI / 180; // 1 degree
    DIST_TOLERANCE = 0.1; // 0.1mm
    console.log(`Starting STRICT merging (final): ${faces.length} faces`);
  }
  
  // Step 1: Group faces by similar normals
  const groups = [];
  const assigned = new Array(faces.length).fill(false);
  
  for (let i = 0; i < faces.length; i++) {
    if (assigned[i]) continue;
    
    const group = [i];
    assigned[i] = true;
    
    // Find all faces with similar normals
    for (let j = i + 1; j < faces.length; j++) {
      if (assigned[j]) continue;
      
      if (areNormalsSimilar(faces[i].normal, faces[j].normal, ANGLE_TOLERANCE)) {
        group.push(j);
        assigned[j] = true;
      }
    }
    
    groups.push(group);
  }
  
  console.log(`Grouped into ${groups.length} normal-based groups`);
  
  // Step 2: Within each group, find coplanar and connected faces
  const mergedFaces = [];
  
  for (const group of groups) {
    const groupFaces = group.map(idx => faces[idx]);
    
    // Build adjacency list for this group
    const adjacency = new Map();
    for (let i = 0; i < groupFaces.length; i++) {
      adjacency.set(i, []);
    }
    
    // Find adjacent faces (share an edge and are coplanar)
    for (let i = 0; i < groupFaces.length; i++) {
      for (let j = i + 1; j < groupFaces.length; j++) {
        // Check if coplanar
        if (areFacesCoplanar(groupFaces[i], groupFaces[j], vertices, ANGLE_TOLERANCE, DIST_TOLERANCE)) {
          // Check if they share an edge
          const sharedEdge = findSharedEdge(groupFaces[i], groupFaces[j]);
          if (sharedEdge) {
            adjacency.get(i).push(j);
            adjacency.get(j).push(i);
          }
        }
      }
    }
    
    // Step 3: Find connected components (groups of adjacent coplanar faces)
    const visited = new Array(groupFaces.length).fill(false);
    
    for (let i = 0; i < groupFaces.length; i++) {
      if (visited[i]) continue;
      
      // BFS to find all connected faces
      const component = [];
      const queue = [i];
      visited[i] = true;
      
      while (queue.length > 0) {
        const current = queue.shift();
        component.push(current);
        
        for (const neighbor of adjacency.get(current)) {
          if (!visited[neighbor]) {
            visited[neighbor] = true;
            queue.push(neighbor);
          }
        }
      }
      
      // Build polygon from this component
      const componentFaces = component.map(idx => groupFaces[idx]);
      
      if (componentFaces.length === 1) {
        // Single face, keep as is
        mergedFaces.push(componentFaces[0]);
      } else {
        // Multiple faces, merge into polygon
        const polygonIndices = buildPolygonFromTriangles(componentFaces, vertices);
        
        // CRITICAL FIX: Check depth range of merged polygon ALONG VIEW DIRECTION
        // For isometric view, depth is not just Z, but a combination of X, Y, Z
        // Using isometric depth formula: depth = z + (x + y) * sin(30°)
        const polygonVertices = polygonIndices.map(idx => vertices[idx]);
        const ISO_SIN = Math.sin(Math.PI / 6); // sin(30°) ≈ 0.5
        
        // Calculate isometric depth for each vertex
        const depths = polygonVertices.map(v => v.z + (v.x + v.y) * ISO_SIN);
        const minDepth = Math.min(...depths);
        const maxDepth = Math.max(...depths);
        const depthRange = maxDepth - minDepth;
        
        // Maximum allowed depth range for merging (3.0mm)
        // Reduced from 5.0 to be more conservative
        // Faces spanning more than this should stay as separate triangles
        const MAX_MERGE_DEPTH_RANGE = 3.0;
        
        if (depthRange > MAX_MERGE_DEPTH_RANGE || polygonIndices.length > 20) {
          // Depth range too large OR too many vertices - keep as separate triangles
          // Large polygons (>20 vertices) are likely problem cases
          if (depthRange > MAX_MERGE_DEPTH_RANGE) {
            console.log(`⚠️ Skipping merge: depth range ${depthRange.toFixed(2)} > ${MAX_MERGE_DEPTH_RANGE} (${componentFaces.length} triangles, ${polygonIndices.length} vertices)`);
          } else {
            console.log(`⚠️ Skipping merge: too many vertices (${polygonIndices.length} > 20, ${componentFaces.length} triangles)`);
          }
          componentFaces.forEach(face => mergedFaces.push(face));
        } else {
          // Depth range acceptable - safe to merge
          
          // Calculate normal from merged polygon vertices
          // Don't trust first triangle's normal - compute from actual polygon
          const polygonNormal = calculatePolygonNormal(polygonIndices, vertices);
          
          // Fallback to first face's normal if calculation fails
          const finalNormal = (polygonNormal && 
                              Math.abs(polygonNormal.x) + Math.abs(polygonNormal.y) + Math.abs(polygonNormal.z) > 0.1)
            ? polygonNormal
            : componentFaces[0].normal;
          
          // Create merged face
          const mergedFace = {
            indices: polygonIndices,
            normal: finalNormal,
            name: `merged_${mergedFaces.length}`,
            hatchAngleOffset: componentFaces[0].hatchAngleOffset || 0
          };
          
          mergedFaces.push(mergedFace);
        }
      }
    }
  }
  
  console.log(`Merged result: ${mergedFaces.length} faces (reduced from ${faces.length})`);
  
  // Log statistics
  const vertexCounts = {};
  for (const face of mergedFaces) {
    const count = face.indices.length;
    vertexCounts[count] = (vertexCounts[count] || 0) + 1;
  }
  console.log('Face vertex distribution:', vertexCounts);
  
  return {
    vertices: geometry.vertices,
    faces: mergedFaces,
    isSTL: true
  };
}

export function createCube(size) {
  const s = size / 2;
  // Cube centered on origin with bottom face on floor (z=0)
  // Z is up/down, Y is forward/back, X is left/right
  // Bottom face at z=0, top face at z=size
  // All planes (XY, XZ, YZ) cut the cube exactly in half
  const vertices = [
    { x: -s, y: -s, z: 0 }, // 0: bottom-left-back
    { x:  s, y: -s, z: 0 }, // 1: bottom-right-back
    { x:  s, y: -s, z: size }, // 2: top-right-back
    { x: -s, y: -s, z: size }, // 3: top-left-back
    { x: -s, y:  s, z: 0 }, // 4: bottom-left-front
    { x:  s, y:  s, z: 0 }, // 5: bottom-right-front
    { x:  s, y:  s, z: size }, // 6: top-right-front
    { x: -s, y:  s, z: size }  // 7: top-left-front
  ];

  // Faces defined by vertex indices
  // Bottom face at z=0, top face at z=size
  // Vertices: 0=BLB, 1=BRB, 2=TRB, 3=TLB, 4=BLF, 5=BRF, 6=TRF, 7=TLF
  // Normals point OUTWARD from the cube
  const faces = [
    { indices: [0, 1, 2, 3], normal: { x: 0, y: -1, z: 0 }, name: 'back', hatchAngleOffset: 0 },    // back (y = -s): outward = negative Y
    { indices: [4, 7, 6, 5], normal: { x: 0, y: 1, z: 0 }, name: 'front', hatchAngleOffset: 60 },    // front (y = +s): outward = positive Y
    { indices: [0, 4, 5, 1], normal: { x: 0, y: 0, z: -1 }, name: 'bottom', hatchAngleOffset: 30 },  // bottom (z = 0): outward = negative Z
    { indices: [3, 2, 6, 7], normal: { x: 0, y: 0, z: 1 }, name: 'top', hatchAngleOffset: 90 },      // top (z = +size): outward = positive Z
    { indices: [0, 3, 7, 4], normal: { x: -1, y: 0, z: 0 }, name: 'left', hatchAngleOffset: 120 },    // left (x = -s): outward = negative X
    { indices: [1, 5, 6, 2], normal: { x: 1, y: 0, z: 0 }, name: 'right', hatchAngleOffset: 150 }     // right (x = +s): outward = positive X
  ];

  return { vertices, faces };
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function convexHull(points) {
  if (points.length < 3) return points;
  
  // Remove duplicate points first with tighter tolerance
  const uniquePoints = [];
  const POINT_EPSILON = 0.001; // Tighter tolerance: 0.001mm for better precision
  
  for (const p of points) {
    const isDuplicate = uniquePoints.some(existing => 
      Math.hypot(p.x - existing.x, p.y - existing.y) < POINT_EPSILON
    );
    if (!isDuplicate) {
      uniquePoints.push(p);
    }
  }
  
  if (uniquePoints.length < 3) return uniquePoints;
  
  // Find leftmost-bottommost point (guaranteed to be on hull)
  // Use bottommost first (largest Y in SVG coordinates), then leftmost
  let start = uniquePoints[0];
  for (const p of uniquePoints) {
    // In SVG, Y increases downward, so bottommost = largest Y
    if (p.y > start.y || (Math.abs(p.y - start.y) < 1e-10 && p.x < start.x)) {
      start = p;
    }
  }
  
  const hull = [];
  let current = start;
  let iterations = 0;
  const maxIterations = uniquePoints.length * 2; // Safety limit
  
  // Numerical tolerance for floating point comparisons
  const ANGLE_EPSILON = 1e-10;
  const DISTANCE_EPSILON = 1e-10;
  
  do {
    hull.push(current);
    let next = uniquePoints[0];
    
    // Find the point that makes the smallest left turn (most counterclockwise)
    for (const candidate of uniquePoints) {
      // Skip current point (with tighter tolerance)
      if (Math.hypot(candidate.x - current.x, candidate.y - current.y) < DISTANCE_EPSILON) {
        continue;
      }
      
      // Calculate cross product to determine turn direction
      // Positive = left turn (counterclockwise), Negative = right turn (clockwise)
      const cross = (next.x - current.x) * (candidate.y - current.y) - 
                   (next.y - current.y) * (candidate.x - current.x);
      
      // If next == current, or candidate is more counterclockwise, update next
      if (Math.hypot(next.x - current.x, next.y - current.y) < DISTANCE_EPSILON || cross > ANGLE_EPSILON) {
        next = candidate;
      } else if (Math.abs(cross) < ANGLE_EPSILON) {
        // Collinear points - choose the farthest point to ensure we capture all hull vertices
        const distToNext = Math.hypot(next.x - current.x, next.y - current.y);
        const distToCandidate = Math.hypot(candidate.x - current.x, candidate.y - current.y);
        if (distToCandidate > distToNext) {
          next = candidate;
        }
      }
    }
    
    current = next;
    iterations++;
    
    // Break if we've gone too many iterations (safety check)
    if (iterations > maxIterations) {
      console.warn("Convex hull: Too many iterations, breaking");
      break;
    }
    
  } while (Math.hypot(current.x - start.x, current.y - start.y) > DISTANCE_EPSILON && hull.length < uniquePoints.length);
  
  // Remove duplicate start point if it was added
  if (hull.length > 1 && Math.hypot(hull[hull.length - 1].x - hull[0].x, hull[hull.length - 1].y - hull[0].y) < DISTANCE_EPSILON) {
    hull.pop();
  }
  
  // Validation: Verify hull encloses all original points
  // This is a safety check to ensure the algorithm worked correctly
  if (hull.length >= 3) {
    const allPointsEnclosed = uniquePoints.every(point => {
      // Check if point is on or inside the hull
      // Either the point is a hull vertex, or it's inside the hull polygon
      const isHullVertex = hull.some(hullPoint => 
        Math.hypot(hullPoint.x - point.x, hullPoint.y - point.y) < POINT_EPSILON
      );
      return isHullVertex || pointInPolygon(point, hull);
    });
    
    if (!allPointsEnclosed) {
      console.warn("Convex hull validation failed: not all points enclosed");
      // Fallback: return bounding box as a safe conservative hull
      const minX = Math.min(...uniquePoints.map(p => p.x));
      const maxX = Math.max(...uniquePoints.map(p => p.x));
      const minY = Math.min(...uniquePoints.map(p => p.y));
      const maxY = Math.max(...uniquePoints.map(p => p.y));
      return [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
      ];
    }
  }
  
  return hull;
}


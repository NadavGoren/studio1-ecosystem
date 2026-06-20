/* ============================================================
   STL PARSER
   Parse binary and ASCII STL files to mesh format
============================================================ */

/**
 * Check if STL file is ASCII or binary format
 * @param {ArrayBuffer} buffer - The file buffer
 * @returns {boolean} True if ASCII format
 */
function isASCIISTL(buffer) {
  const view = new Uint8Array(buffer);
  const text = new TextDecoder('ascii').decode(view.slice(0, 80));
  return text.trim().toLowerCase().startsWith('solid');
}

/**
 * Parse ASCII STL file
 * @param {string} text - The STL file as text
 * @returns {Object} Mesh object with vertices and faces
 */
function parseASCIISTL(text) {
  const vertices = [];
  const faces = [];
  const vertexMap = new Map(); // For vertex deduplication

  const lines = text.split('\n');
  let currentNormal = null;
  let currentVertices = [];
  let insideLoop = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.startsWith('facet normal')) {
      // Extract normal vector
      const match = line.match(/facet normal\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)/i);
      if (match) {
        currentNormal = {
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          z: parseFloat(match[3])
        };
        currentVertices = [];
        insideLoop = false;
      }
    } else if (lowerLine.startsWith('outer loop')) {
      insideLoop = true;
      currentVertices = [];
    } else if (lowerLine.startsWith('endloop')) {
      insideLoop = false;
    } else if (insideLoop && lowerLine.startsWith('vertex')) {
      // Extract vertex
      const match = line.match(/vertex\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)/i);
      if (match) {
        const vertex = {
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          z: parseFloat(match[3])
        };
        currentVertices.push(vertex);
      }
    } else if (lowerLine.startsWith('endfacet')) {
      // Complete face
      if (currentNormal && currentVertices.length >= 3) {
        const indices = [];
        
        // Add vertices and get indices (deduplicate)
        for (const vertex of currentVertices) {
          const key = `${vertex.x.toFixed(6)},${vertex.y.toFixed(6)},${vertex.z.toFixed(6)}`;
          if (!vertexMap.has(key)) {
            vertexMap.set(key, vertices.length);
            vertices.push(vertex);
          }
          indices.push(vertexMap.get(key));
        }

        // Create face (handle polygons with more than 3 vertices by triangulating)
        if (indices.length === 3) {
          faces.push({
            indices,
            normal: currentNormal
          });
        } else if (indices.length > 3) {
          // Triangulate polygon (fan triangulation)
          for (let j = 1; j < indices.length - 1; j++) {
            faces.push({
              indices: [indices[0], indices[j], indices[j + 1]],
              normal: currentNormal
            });
          }
        }
      }
      currentNormal = null;
      currentVertices = [];
      insideLoop = false;
    }
  }

  if (vertices.length === 0 || faces.length === 0) {
    throw new Error('Invalid STL file: No geometry found');
  }

  return {
    vertices,
    faces,
    triangleCount: faces.length
  };
}

/**
 * Parse binary STL file
 * @param {ArrayBuffer} buffer - The file buffer
 * @returns {Object} Mesh object with vertices and faces
 */
function parseBinarySTL(buffer) {
  const view = new DataView(buffer);
  const vertices = [];
  const faces = [];
  const vertexMap = new Map();

  // Skip 80-byte header
  let offset = 80;

  // Read triangle count (4 bytes, little-endian)
  const triangleCount = view.getUint32(offset, true);
  offset += 4;

  if (triangleCount > 10000000) {
    throw new Error('Invalid STL file: Triangle count too large (max 10M triangles)');
  }

  // Read triangles (50 bytes each: 12 bytes normal + 36 bytes vertices + 2 bytes attribute)
  for (let i = 0; i < triangleCount; i++) {
    // Read normal (12 bytes, 3 floats)
    const normal = {
      x: view.getFloat32(offset, true),
      y: view.getFloat32(offset + 4, true),
      z: view.getFloat32(offset + 8, true)
    };
    offset += 12;

    // Read vertices (36 bytes, 9 floats)
    const triangleVertices = [];
    for (let j = 0; j < 3; j++) {
      triangleVertices.push({
        x: view.getFloat32(offset, true),
        y: view.getFloat32(offset + 4, true),
        z: view.getFloat32(offset + 8, true)
      });
      offset += 12;
    }

    // Skip attribute byte count (2 bytes)
    offset += 2;

    // Add vertices and get indices (deduplicate)
    const indices = [];
    for (const vertex of triangleVertices) {
      const key = `${vertex.x.toFixed(6)},${vertex.y.toFixed(6)},${vertex.z.toFixed(6)}`;
      if (!vertexMap.has(key)) {
        vertexMap.set(key, vertices.length);
        vertices.push(vertex);
      }
      indices.push(vertexMap.get(key));
    }

    faces.push({
      indices,
      normal
    });
  }

  if (vertices.length === 0 || faces.length === 0) {
    throw new Error('Invalid STL file: No geometry found');
  }

  return {
    vertices,
    faces,
    triangleCount: faces.length
  };
}

/**
 * Calculate bounding box for mesh
 * @param {Array} vertices - Array of vertex objects {x, y, z}
 * @returns {Object} Bounding box {min, max, center, size}
 */
export function calculateBoundingBox(vertices) {
  if (vertices.length === 0) {
    return { min: {x: 0, y: 0, z: 0}, max: {x: 0, y: 0, z: 0}, center: {x: 0, y: 0, z: 0}, size: {x: 0, y: 0, z: 0} };
  }

  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };

  for (const v of vertices) {
    min.x = Math.min(min.x, v.x);
    min.y = Math.min(min.y, v.y);
    min.z = Math.min(min.z, v.z);
    max.x = Math.max(max.x, v.x);
    max.y = Math.max(max.y, v.y);
    max.z = Math.max(max.z, v.z);
  }

  const center = {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2
  };

  const size = {
    x: max.x - min.x,
    y: max.y - min.y,
    z: max.z - min.z
  };

  return { min, max, center, size };
}

/**
 * Center and normalize mesh to fit within target size
 * @param {Object} mesh - Mesh object with vertices and faces
 * @param {number} targetSize - Target size to fit the mesh within
 * @returns {Object} Transformed mesh
 */
export function normalizeMesh(mesh, targetSize = 100) {
  const bbox = calculateBoundingBox(mesh.vertices);
  
  // Find the largest dimension
  const maxDim = Math.max(bbox.size.x, bbox.size.y, bbox.size.z);
  
  if (maxDim === 0) {
    return mesh; // Avoid division by zero
  }
  
  // Scale factor to fit within target size
  const scale = targetSize / maxDim;
  
  // Transform vertices: center and scale
  const transformedVertices = mesh.vertices.map(v => ({
    x: (v.x - bbox.center.x) * scale,
    y: (v.y - bbox.center.y) * scale,
    z: (v.z - bbox.min.z) * scale // Place bottom at z=0
  }));
  
  return {
    vertices: transformedVertices,
    faces: mesh.faces, // Faces indices remain the same
    triangleCount: mesh.triangleCount,
    originalBBox: bbox,
    scale
  };
}

/**
 * Main STL parser function
 * @param {File} file - The STL file to parse
 * @returns {Promise<Object>} Promise resolving to mesh object
 */
export async function parseSTL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        if (!buffer) {
          reject(new Error('Failed to read file'));
          return;
        }

        let mesh;

        if (isASCIISTL(buffer)) {
          const text = new TextDecoder('ascii').decode(buffer);
          mesh = parseASCIISTL(text);
        } else {
          mesh = parseBinarySTL(buffer);
        }

        // Store original vertices for reset functionality
        mesh.originalVertices = mesh.vertices.map(v => ({ ...v }));
        
        // Calculate bounding box
        mesh.boundingBox = calculateBoundingBox(mesh.vertices);

        resolve(mesh);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to parse STL file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}









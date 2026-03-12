import { Mesh, Face, Vector3, STLParseResult } from './types';

/**
 * Check if STL file is ASCII or binary format
 */
function isASCIISTL(buffer: ArrayBuffer): boolean {
  const view = new Uint8Array(buffer);
  const text = new TextDecoder('ascii').decode(view.slice(0, 80));
  return text.trim().toLowerCase().startsWith('solid');
}

/**
 * Parse ASCII STL file
 */
function parseASCIISTL(text: string): Mesh {
  const vertices: Vector3[] = [];
  const faces: Face[] = [];
  const vertexMap = new Map<string, number>(); // For indexing

  const lines = text.split('\n');
  let currentNormal: Vector3 | null = null;
  let currentVertices: Vector3[] = [];
  let insideLoop = false; // Track if we're inside an "outer loop" block

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.startsWith('facet normal')) {
      // Extract normal vector
      const match = line.match(/facet normal\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i);
      if (match) {
        currentNormal = {
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          z: parseFloat(match[3]),
        };
        currentVertices = [];
        insideLoop = false; // Reset loop state for new facet
      }
    } else if (lowerLine.startsWith('outer loop')) {
      // Start of vertex loop
      insideLoop = true;
      currentVertices = []; // Reset vertices for this loop
    } else if (lowerLine.startsWith('endloop')) {
      // End of vertex loop
      insideLoop = false;
    } else if (insideLoop && lowerLine.startsWith('vertex')) {
      // Extract vertex (only when inside an outer loop)
      const match = line.match(/vertex\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i);
      if (match) {
        const vertex: Vector3 = {
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          z: parseFloat(match[3]),
        };
        currentVertices.push(vertex);
      }
    } else if (lowerLine.startsWith('endfacet')) {
      // Complete face
      if (currentNormal && currentVertices.length >= 3) {
        const indices: number[] = [];
        
        // Add vertices and get indices
        for (const vertex of currentVertices) {
          const key = `${vertex.x},${vertex.y},${vertex.z}`;
          if (!vertexMap.has(key)) {
            vertexMap.set(key, vertices.length);
            vertices.push(vertex);
          }
          indices.push(vertexMap.get(key)!);
        }

        // Create face (handle polygons with more than 3 vertices by triangulating)
        if (indices.length === 3) {
          faces.push({
            indices,
            normal: currentNormal,
          });
        } else if (indices.length > 3) {
          // Triangulate polygon (fan triangulation)
          for (let j = 1; j < indices.length - 1; j++) {
            faces.push({
              indices: [indices[0], indices[j], indices[j + 1]],
              normal: currentNormal,
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
    normals: [], // Will be computed if needed
  };
}

/**
 * Parse binary STL file
 */
function parseBinarySTL(buffer: ArrayBuffer): Mesh {
  const view = new DataView(buffer);
  const vertices: Vector3[] = [];
  const faces: Face[] = [];
  const vertexMap = new Map<string, number>();

  // Skip 80-byte header
  let offset = 80;

  // Read triangle count (4 bytes, little-endian)
  const triangleCount = view.getUint32(offset, true);
  offset += 4;

  if (triangleCount > 1000000) {
    throw new Error('Invalid STL file: Triangle count too large');
  }

  // Read triangles (50 bytes each: 12 bytes normal + 36 bytes vertices + 2 bytes attribute)
  for (let i = 0; i < triangleCount; i++) {
    // Read normal (12 bytes, 3 floats)
    const normal: Vector3 = {
      x: view.getFloat32(offset, true),
      y: view.getFloat32(offset + 4, true),
      z: view.getFloat32(offset + 8, true),
    };
    offset += 12;

    // Read vertices (36 bytes, 9 floats)
    const triangleVertices: Vector3[] = [];
    for (let j = 0; j < 3; j++) {
      triangleVertices.push({
        x: view.getFloat32(offset, true),
        y: view.getFloat32(offset + 4, true),
        z: view.getFloat32(offset + 8, true),
      });
      offset += 12;
    }

    // Skip attribute byte count (2 bytes)
    offset += 2;

    // Add vertices and get indices
    const indices: number[] = [];
    for (const vertex of triangleVertices) {
      const key = `${vertex.x},${vertex.y},${vertex.z}`;
      if (!vertexMap.has(key)) {
        vertexMap.set(key, vertices.length);
        vertices.push(vertex);
      }
      indices.push(vertexMap.get(key)!);
    }

    faces.push({
      indices,
      normal,
    });
  }

  if (vertices.length === 0 || faces.length === 0) {
    throw new Error('Invalid STL file: No geometry found');
  }

  return {
    vertices,
    faces,
    normals: [],
  };
}

/**
 * Main STL parser function
 */
export async function parseSTL(file: File): Promise<STLParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) {
          reject(new Error('Failed to read file'));
          return;
        }

        let mesh: Mesh;

        if (isASCIISTL(buffer)) {
          const text = new TextDecoder('ascii').decode(buffer);
          mesh = parseASCIISTL(text);
        } else {
          mesh = parseBinarySTL(buffer);
        }

        // Store original vertices for reset functionality
        mesh.originalVertices = mesh.vertices.map(v => ({ ...v }));

        resolve({
          mesh,
          triangleCount: mesh.faces.length,
        });
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

/**
 * Parse STL from ArrayBuffer (for Web Workers)
 */
export function parseSTLFromBuffer(buffer: ArrayBuffer): STLParseResult {
  let mesh: Mesh;

  if (isASCIISTL(buffer)) {
    const text = new TextDecoder('ascii').decode(buffer);
    mesh = parseASCIISTL(text);
  } else {
    mesh = parseBinarySTL(buffer);
  }

  mesh.originalVertices = mesh.vertices.map(v => ({ ...v }));

  return {
    mesh,
    triangleCount: mesh.faces.length,
  };
}



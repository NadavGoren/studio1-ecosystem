import { parseSTL } from '../core/stlParser';
import { processMesh, calculateBoundingBox } from '../core/geometry';
import type { MeshSlice } from '../ui/store/meshSlice';

/**
 * Load the default STL file from the 3D Assets folder
 */
export async function loadDefaultSTL(
  setMesh: (mesh: any) => void,
  setBoundingBox: (bbox: any) => void,
  setCenterOfMass: (com: any) => void,
  setTriangleCount: (count: number) => void,
  setIsLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
): Promise<void> {
  try {
    setIsLoading(true);
    setError(null);

    // Load the default STL file from public folder
    // Note: Vite serves files from public folder at root
    // Try both encoded and non-encoded paths
    let filePath = '/3D Assets/Andarta New v47.stl';
    let response = await fetch(filePath);
    
    if (!response.ok) {
      // Try with encoded path
      filePath = encodeURI('/3D Assets/Andarta New v47.stl');
      response = await fetch(filePath);
    }
    
    if (!response.ok) {
      console.error('Failed to fetch default STL:', {
        status: response.status,
        statusText: response.statusText,
        url: filePath
      });
      throw new Error(`Failed to load default STL: ${response.status} ${response.statusText}. Tried: ${filePath}`);
    }

    const blob = await response.blob();
    const file = new File([blob], 'Andarta New v47.stl', { type: 'model/stl' });

    console.log('Loading default STL file:', file.name);

      // Parse STL file
      const result = await parseSTL(file);
      console.log('Default STL parsed:', result.triangleCount, 'triangles');

      // Check original bounding box to understand orientation
      const originalBbox = calculateBoundingBox(result.mesh.vertices);
      console.log('Original bounding box:', {
        size: originalBbox.size,
        min: originalBbox.min,
        max: originalBbox.max
      });

      // Convert orientation: Rotate to stand upright (Y->Z)
      const { rotateToStandUpright } = await import('../core/geometry');
      let orientedMesh = rotateToStandUpright(result.mesh);
      
      // Check bounding box after rotation
      const rotatedBbox = calculateBoundingBox(orientedMesh.vertices);
      console.log('After rotation bounding box:', {
        size: rotatedBbox.size,
        min: rotatedBbox.min,
        max: rotatedBbox.max
      });
      
      // Process mesh (calculate bbox, COM, adjacency)
      let processedMesh = processMesh(orientedMesh);
      
      // Position mesh so bottom face sits on floor (Z=0)
      const { positionOnFloor } = await import('../core/geometry');
      processedMesh = positionOnFloor(processedMesh);
      // Re-process to update bbox and COM after floor positioning
      processedMesh = processMesh(processedMesh);
    
    // Normalize mesh to reasonable size if it's too large or too small
    if (processedMesh.boundingBox) {
      const maxDim = Math.max(
        processedMesh.boundingBox.size.x,
        processedMesh.boundingBox.size.y,
        processedMesh.boundingBox.size.z
      );
      
      // If mesh is very large (>1000) or very small (<0.1), normalize it
      if (maxDim > 1000 || maxDim < 0.1) {
        console.log('Normalizing default mesh size:', maxDim);
        const { normalizeMesh } = await import('../core/geometry');
        processedMesh = normalizeMesh(processedMesh, 100); // Normalize to ~100 units
        // Re-process to update bbox and COM
        processedMesh = processMesh(processedMesh);
      }
    }
    
    console.log('Default mesh processed:', processedMesh);

    // Update store
    setMesh(processedMesh);
    if (processedMesh.boundingBox) {
      setBoundingBox(processedMesh.boundingBox);
    }
    if (processedMesh.centerOfMass) {
      setCenterOfMass(processedMesh.centerOfMass);
    }
    setTriangleCount(result.triangleCount);

    console.log('Default STL loaded successfully');
  } catch (error) {
    console.error('Error loading default STL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to load default STL file';
    setError(errorMessage);
    
    // Clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  } finally {
    setIsLoading(false);
  }
}


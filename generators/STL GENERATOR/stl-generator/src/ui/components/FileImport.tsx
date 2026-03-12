import React from 'react';
import { parseSTL } from '../../core/stlParser';
import { processMesh } from '../../core/geometry';
import { useMeshSlice } from '../store/meshSlice';
import { useUISlice } from '../store/uiSlice';
import { useSVGViewportSlice } from '../store/svgViewportSlice';

export function FileImport() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const setMesh = useMeshSlice((state) => state.setMesh);
  const setBoundingBox = useMeshSlice((state) => state.setBoundingBox);
  const setCenterOfMass = useMeshSlice((state) => state.setCenterOfMass);
  const setTriangleCount = useMeshSlice((state) => state.setTriangleCount);
  const setIsLoading = useUISlice((state) => state.setIsLoading);
  const setError = useUISlice((state) => state.setError);
  const isLoading = useUISlice((state) => state.ui.isLoading);
  const resetView = useSVGViewportSlice((state) => state.resetView);

  const handleClick = () => {
    if (!isLoading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input so same file can be loaded again
    event.target.value = '';

    try {
      setIsLoading(true);
      setError(null);
      console.log('Loading STL file:', file.name);

      // Parse STL file
      const result = await parseSTL(file);
      console.log('STL parsed:', result.triangleCount, 'triangles');

      // Keep original orientation (Z-up is the desired coordinate system)
      // STL files use Z-up, and we want to maintain that for the flow plane (X-Y)
      let orientedMesh = result.mesh;

      // Process mesh (calculate bbox, COM, adjacency)
      let processedMesh = processMesh(orientedMesh);
      
      // Position mesh so bottom face sits on floor (Z=0)
      const { positionOnFloor } = await import('../../core/geometry');
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
          console.log('Normalizing mesh size:', maxDim);
          const { normalizeMesh } = await import('../../core/geometry');
          processedMesh = normalizeMesh(processedMesh, 100); // Normalize to ~100 units
          // Re-process to update bbox and COM
          processedMesh = processMesh(processedMesh);
        }
      }
      
      console.log('Mesh processed:', processedMesh);

      // Update store
      setMesh(processedMesh);
      if (processedMesh.boundingBox) {
        setBoundingBox(processedMesh.boundingBox);
      }
      if (processedMesh.centerOfMass) {
        setCenterOfMass(processedMesh.centerOfMass);
      }
      setTriangleCount(result.triangleCount);

      // Reset view to default isometric when new file is loaded
      resetView();

      console.log('STL loaded successfully');
    } catch (error) {
      console.error('Error loading STL:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load STL file';
      setError(errorMessage);
      
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".stl"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={handleClick}
        type="button"
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed duration-200"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {isLoading ? 'Loading...' : 'Load STL File'}
      </button>
    </>
  );
}

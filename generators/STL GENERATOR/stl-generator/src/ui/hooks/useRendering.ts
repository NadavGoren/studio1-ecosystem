import { useEffect, useMemo } from 'react';
import { Vector3 } from '../../core/types';
import { useMeshSlice } from '../store';
import { useTransformSlice } from '../store';
import { useCanvasSlice } from '../store';
import { useRenderingSlice } from '../store';
import { useSVGViewportSlice } from '../store';
import { useRenderedDataSlice } from '../store';
import { useUISlice } from '../store';
import { applyTransforms } from '../../core/transforms';
import { renderMeshToSVG } from '../../rendering/pipeline';
import { calculateCenterOfMass } from '../../core/geometry';

/**
 * Hook to manage rendering pipeline
 * Watches all relevant state and triggers rendering when changes occur
 */
export function useRendering() {
  const mesh = useMeshSlice((state) => state.mesh);
  const transform = useTransformSlice((state) => state.transform);
  const canvas = useCanvasSlice((state) => state.canvas);
  const rendering = useRenderingSlice((state) => state.rendering);
  const viewRotation = useSVGViewportSlice((state) => state.viewRotation);
  const viewZoom = useSVGViewportSlice((state) => state.viewZoom);
  const baseScale = useSVGViewportSlice((state) => state.baseScale);
  const setBaseScale = useSVGViewportSlice((state) => state.setBaseScale);
  const setSVGData = useRenderedDataSlice((state) => state.setSVGData);
  const setError = useUISlice((state) => state.setError);

  // Apply transforms to mesh
  const transformedMesh = useMemo(() => {
    if (!mesh) return null;
    try {
      return applyTransforms(mesh, transform);
    } catch (error) {
      console.error('Error applying transforms:', error);
      setError('Failed to apply transforms');
      return null;
    }
  }, [mesh, transform, setError]);

  // Calculate camera position from view rotation, orbiting around mesh center
  const cameraPosition = useMemo(() => {
    if (!transformedMesh) {
      // Default position if no mesh (using corrected camera calculation)
      const distance = 1000;
      const azRad = (viewRotation.azimuth * Math.PI) / 180;
      const elRad = (viewRotation.elevation * Math.PI) / 180;
      return {
        x: distance * Math.sin(elRad) * Math.cos(azRad),
        y: distance * Math.sin(elRad) * Math.sin(azRad),
        z: distance * Math.cos(elRad),
      };
    }

    // Get mesh center of mass
    const meshCenter = transformedMesh.centerOfMass || calculateCenterOfMass(transformedMesh.vertices);
    
    // Calculate camera distance based on mesh bounding box
    const bbox = transformedMesh.boundingBox;
    let distance = 1000; // Default distance
    if (bbox) {
      const maxSize = Math.max(bbox.size.x, bbox.size.y, bbox.size.z);
      // Set distance to be 3x the mesh size for good viewing
      distance = maxSize * 3;
      // Ensure minimum distance
      if (distance < 100) distance = 100;
    }

    // Calculate camera position relative to origin
    const azRad = (viewRotation.azimuth * Math.PI) / 180;
    const elRad = (viewRotation.elevation * Math.PI) / 180;
    
    // Fixed camera position calculation (matching the projection.ts fix)
    const relativeCameraPos = {
      x: distance * Math.sin(elRad) * Math.cos(azRad),
      y: distance * Math.sin(elRad) * Math.sin(azRad),
      z: distance * Math.cos(elRad),
    };

    // Offset camera position to orbit around mesh center
    return {
      x: meshCenter.x + relativeCameraPos.x,
      y: meshCenter.y + relativeCameraPos.y,
      z: meshCenter.z + relativeCameraPos.z,
    };
  }, [viewRotation, transformedMesh]);

  // Reset base scale when mesh or canvas size changes
  useEffect(() => {
    setBaseScale(1.0); // Reset to trigger recalculation
  }, [mesh, canvas.width, canvas.height, setBaseScale]);

  // Trigger rendering when dependencies change
  useEffect(() => {
    if (!transformedMesh) {
      setSVGData([], '', { lineCount: 0, pathLength: 0, estimatedPlotTime: 0 }, 1, { x: 0, y: 0 });
      return;
    }

    try {
      // First render or when mesh/canvas changes: calculate base scale via auto-fit
      // Subsequent renders: use baseScale * viewZoom for fixed scaling
      const shouldRecalculateBaseScale = baseScale === 1.0; // Default value means not yet calculated
      
      const result = renderMeshToSVG(
        transformedMesh,
        cameraPosition,
        rendering.mode,
        rendering.viewMode,
        canvas,
        rendering.perspectiveStrength,
        viewRotation,
        shouldRecalculateBaseScale ? undefined : baseScale * viewZoom
      );

      // If we just calculated a new base scale, store it
      if (shouldRecalculateBaseScale) {
        setBaseScale(result.scale);
      }

      setSVGData(
        result.svgLines,
        result.svgContent,
        result.metrics,
        result.scale,
        result.offset
      );
    } catch (error) {
      console.error('Error rendering mesh:', error);
      setError(error instanceof Error ? error.message : 'Failed to render mesh');
      setSVGData([], '', { lineCount: 0, pathLength: 0, estimatedPlotTime: 0 }, 1, { x: 0, y: 0 });
    }
  }, [
    transformedMesh,
    cameraPosition,
    rendering.mode,
    rendering.viewMode,
    rendering.perspectiveStrength,
    canvas,
    viewRotation,
    viewZoom,
    baseScale,
    setBaseScale,
    setSVGData,
    setError,
  ]);
}


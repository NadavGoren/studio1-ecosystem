import { useRef, useEffect, useState } from 'react';
import { useMeshSlice, useUISlice, useSVGViewportSlice } from '../ui/store';
import { useRenderedDataSlice } from '../ui/store';
import { useCanvasSlice } from '../ui/store';
import { projectIsometric } from '../core/projection';
import { Vector3 } from '../core/types';

export function SVGViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Mouse interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'orbit' | 'pan' | null>(null);
  const [lastMousePos, setLastMousePos] = useState<{ x: number; y: number } | null>(null);

  // Get state from stores
  const mesh = useMeshSlice((state) => state.mesh);
  const setError = useUISlice((state) => state.setError);
  const viewRotation = useSVGViewportSlice((state) => state.viewRotation);
  const viewPan = useSVGViewportSlice((state) => state.viewPan);
  const viewZoom = useSVGViewportSlice((state) => state.viewZoom);
  const setViewRotation = useSVGViewportSlice((state) => state.setViewRotation);
  const setViewPan = useSVGViewportSlice((state) => state.setViewPan);
  const setViewZoom = useSVGViewportSlice((state) => state.setViewZoom);
  const svgContent = useRenderedDataSlice((state) => state.svgContent);
  const canvas = useCanvasSlice((state) => state.canvas);
  const showGrid = useSVGViewportSlice((state) => state.showGrid);
  const meshScale = useRenderedDataSlice((state) => state.scale);
  const meshOffset = useRenderedDataSlice((state) => state.offset);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.button === 0) {
      // Left mouse button - orbit (CAD-style)
      e.preventDefault();
      setIsDragging(true);
      setDragType('orbit');
      setLastMousePos({ x, y });
      containerRef.current.style.cursor = 'grabbing';
    } else if (e.button === 1) {
      // Middle mouse button - pan (CAD-style)
      e.preventDefault();
      setIsDragging(true);
      setDragType('pan');
      setLastMousePos({ x, y });
      containerRef.current.style.cursor = 'move';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !lastMousePos || !containerRef.current) return;

    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const deltaX = x - lastMousePos.x;
    const deltaY = y - lastMousePos.y;

    if (dragType === 'orbit') {
      // CAD-style orbit: horizontal drag rotates around vertical axis, vertical drag rotates around horizontal axis
      const sensitivity = 0.5; // degrees per pixel
      // Horizontal movement: rotate around Z-axis (azimuth) - drag right rotates view left (CCW)
      const newAzimuth = (viewRotation.azimuth - deltaX * sensitivity + 360) % 360;
      // Vertical movement: rotate around horizontal axis (elevation)
      const newElevation = Math.max(0, Math.min(180, viewRotation.elevation - deltaY * sensitivity));
      setViewRotation({ azimuth: newAzimuth, elevation: newElevation });
    } else if (dragType === 'pan') {
      // CAD-style pan: drag to move the view
      const panSensitivity = 1.0; // pixels per pixel (direct mapping)
      const newPanX = viewPan.x + deltaX * panSensitivity;
      const newPanY = viewPan.y + deltaY * panSensitivity;
      setViewPan({ x: newPanX, y: newPanY });
    }

    setLastMousePos({ x, y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragType(null);
    setLastMousePos(null);
    if (containerRef.current) {
      containerRef.current.style.cursor = 'default';
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSpeed = 0.001; // More sensitive zoom
    const zoomDelta = -e.deltaY * zoomSpeed; // Negative so scroll up zooms in
    const newZoom = Math.max(0.1, Math.min(10, viewZoom * (1 + zoomDelta)));
    setViewZoom(newZoom);
  };

  // Update cursor on hover
  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    
    const handleMouseEnter = () => {
      if (!isDragging) {
        container.style.cursor = 'default';
      }
    };

    const handleMouseLeave = () => {
      if (!isDragging) {
        container.style.cursor = 'default';
      }
    };

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isDragging]);

  // Generate 3D grid lines (floor plane at z=0 for Z-up coordinate system)
  const generateGridLines = (): Array<{ start: Vector3; end: Vector3; type: 'grid' | 'axis' }> => {
    if (!mesh || !mesh.boundingBox) {
      return [];
    }

    const bbox = mesh.boundingBox;
    const lines: Array<{ start: Vector3; end: Vector3; type: 'grid' | 'axis' }> = [];

    // Calculate grid size based on mesh size
    // Grid needs to be HUGE in 3D space because it will be scaled down by meshScale
    const maxDim = Math.max(bbox.size.x, bbox.size.y, bbox.size.z);
    const gridExtent = maxDim * 100; // Grid extends 100x - massive grid!
    const gridSize = maxDim * 15; // MUCH larger spacing - only 6-7 lines total per direction
    
    console.log('[Grid Debug]', {
      bboxSize: bbox.size,
      bboxCenter: bbox.center,
      bboxMin: bbox.min,
      bboxMax: bbox.max,
      maxDim,
      gridExtent,
      gridSize
    });

    // Center the grid around the mesh's X-Y center
    const centerX = bbox.center.x;
    const centerY = bbox.center.y;
    
    // Generate grid lines on the floor plane (z=0, which is the horizontal X-Y plane for Z-up)
    // Grid centered around mesh's X-Y position
    const minX = centerX - gridExtent;
    const maxX = centerX + gridExtent;
    const minY = centerY - gridExtent;
    const maxY = centerY + gridExtent;
    
    // X-axis lines (varying X, fixed Y, z=0)
    for (let y = minY; y <= maxY; y += gridSize) {
      lines.push({
        start: { x: minX, y, z: 0 },
        end: { x: maxX, y, z: 0 },
        type: 'grid'
      });
    }

    // Y-axis lines (varying Y, fixed X, z=0)
    for (let x = minX; x <= maxX; x += gridSize) {
      lines.push({
        start: { x, y: minY, z: 0 },
        end: { x, y: maxY, z: 0 },
        type: 'grid'
      });
    }

    // Add axis lines starting from mesh center, extending in positive directions
    const axisLength = maxDim * 60; // Very long axes to match the massive grid
    
    // X axis (red) - horizontal right from center
    lines.push({ 
      start: { x: centerX, y: centerY, z: 0 }, 
      end: { x: centerX + axisLength, y: centerY, z: 0 },
      type: 'axis'
    });
    
    // Y axis (green) - horizontal forward from center
    lines.push({ 
      start: { x: centerX, y: centerY, z: 0 }, 
      end: { x: centerX, y: centerY + axisLength, z: 0 },
      type: 'axis'
    });
    
    // Z axis (blue) - vertical up from floor
    lines.push({ 
      start: { x: centerX, y: centerY, z: 0 }, 
      end: { x: centerX, y: centerY, z: axisLength },
      type: 'axis'
    });

    return lines;
  };

  // Display SVG with canvas boundaries and grid
  useEffect(() => {
    if (!svgContainerRef.current) return;

    // Clear previous SVG
    if (svgRef.current && svgContainerRef.current.contains(svgRef.current)) {
      svgContainerRef.current.removeChild(svgRef.current);
      svgRef.current = null;
    }

    // Create SVG container with padding offset
    const svgNS = 'http://www.w3.org/2000/svg';
    const padding = 20; // Offset from container edges
    const viewBoxWidth = canvas.width + padding * 2;
    const viewBoxHeight = canvas.height + padding * 2;
    
    const svgElement = document.createElementNS(svgNS, 'svg');
    svgElement.setAttribute('width', '100%');
    svgElement.setAttribute('height', '100%');
    svgElement.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgElement.style.display = 'block';
    svgElement.style.pointerEvents = 'none';
    svgElement.style.backgroundColor = 'hsl(var(--card))';

    // Add canvas boundary (fixed, not affected by zoom) with offset
    const canvasRect = document.createElementNS(svgNS, 'rect');
    canvasRect.setAttribute('x', padding.toString());
    canvasRect.setAttribute('y', padding.toString());
    canvasRect.setAttribute('width', canvas.width.toString());
    canvasRect.setAttribute('height', canvas.height.toString());
    canvasRect.setAttribute('fill', 'none');
    canvasRect.setAttribute('stroke', 'hsl(var(--border))');
    canvasRect.setAttribute('stroke-width', '1');
    canvasRect.setAttribute('stroke-dasharray', '5,5');
    canvasRect.setAttribute('opacity', '0.5');
    canvasRect.setAttribute('data-preview-only', 'true');
    svgElement.appendChild(canvasRect);

    // Add margin boundary (fixed, not affected by zoom) - solid stroke
    if (canvas.margins > 0) {
      const marginRect = document.createElementNS(svgNS, 'rect');
      marginRect.setAttribute('x', (padding + canvas.margins).toString());
      marginRect.setAttribute('y', (padding + canvas.margins).toString());
      marginRect.setAttribute('width', (canvas.width - 2 * canvas.margins).toString());
      marginRect.setAttribute('height', (canvas.height - 2 * canvas.margins).toString());
      marginRect.setAttribute('fill', 'none');
      marginRect.setAttribute('stroke', 'hsl(var(--muted-foreground))');
      marginRect.setAttribute('stroke-width', '0.5');
      // Removed stroke-dasharray for solid stroke
      marginRect.setAttribute('opacity', '0.6');
      marginRect.setAttribute('data-preview-only', 'true');
      svgElement.appendChild(marginRect);
    }

    // Create a group for zoomable/panable content (mesh and grid)
    // Account for padding offset
    const canvasCenterX = canvas.width / 2 + padding;
    const canvasCenterY = canvas.height / 2 + padding;
    const contentGroup = document.createElementNS(svgNS, 'g');
    // Apply zoom and pan transforms to the content group
    // Transform origin is at canvas center (with padding offset)
    const transform = `translate(${canvasCenterX + viewPan.x}, ${canvasCenterY + viewPan.y}) scale(${viewZoom}) translate(${-canvasCenterX}, ${-canvasCenterY})`;
    contentGroup.setAttribute('transform', transform);

    // Add 3D grid if enabled
    if (showGrid && mesh) {
      const gridLines = generateGridLines();
      
      // Separate axis lines for label positioning
      const axisLines: Array<{ line: typeof gridLines[0]; index: number }> = [];
      
      // Project and draw grid lines
      for (let i = 0; i < gridLines.length; i++) {
        const line = gridLines[i];
        const start2D = projectIsometric(line.start, viewRotation);
        const end2D = projectIsometric(line.end, viewRotation);
        
        // Use the same scale and offset as the mesh for proper alignment
        const startX = start2D.x * meshScale + meshOffset.x + padding;
        const startY = start2D.y * meshScale + meshOffset.y + padding;
        const endX = end2D.x * meshScale + meshOffset.x + padding;
        const endY = end2D.y * meshScale + meshOffset.y + padding;
        
        const gridLine = document.createElementNS(svgNS, 'line');
        gridLine.setAttribute('x1', startX.toString());
        gridLine.setAttribute('y1', startY.toString());
        gridLine.setAttribute('x2', endX.toString());
        gridLine.setAttribute('y2', endY.toString());
        
        if (line.type === 'axis') {
          // Axis lines: thicker and colored
          const axisIndex = axisLines.length;
          axisLines.push({ line, index: i });
          const colors = ['#ff0000', '#00ff00', '#0000ff']; // Red (X), Green (Y), Blue (Z)
          gridLine.setAttribute('stroke', colors[axisIndex]);
          gridLine.setAttribute('stroke-width', '2.5');
          gridLine.setAttribute('opacity', '0.9');
        } else {
          // Grid lines: thin, elegant light gray
          gridLine.setAttribute('stroke', '#b0b0b0');
          gridLine.setAttribute('stroke-width', '1');
          gridLine.setAttribute('opacity', '0.5');
        }
        gridLine.setAttribute('data-preview-only', 'true');
        contentGroup.appendChild(gridLine);
      }

      // Add axis labels (Z-up coordinate system)
      // X = red (horizontal right), Y = green (horizontal forward), Z = blue (vertical up)
      const axisNames = ['X', 'Y', 'Z'];
      const axisColors = ['#ff0000', '#00ff00', '#0000ff'];
      
      // Different offsets for each axis based on their orientation in isometric view
      const labelOffsets = [
        { x: 25, y: 0 },   // X axis: offset right
        { x: -10, y: 25 },  // Y axis: offset down-left
        { x: 0, y: -25 }   // Z axis: offset up
      ];

      for (let i = 0; i < axisLines.length; i++) {
        const { line } = axisLines[i];
        const end2D = projectIsometric(line.end, viewRotation);
        const labelX = end2D.x * meshScale + meshOffset.x + padding;
        const labelY = end2D.y * meshScale + meshOffset.y + padding;
        
        // Apply axis-specific offset
        const offset = labelOffsets[i];
        const labelText = document.createElementNS(svgNS, 'text');
        labelText.setAttribute('x', (labelX + offset.x).toString());
        labelText.setAttribute('y', (labelY + offset.y).toString());
        labelText.setAttribute('fill', axisColors[i]);
        labelText.setAttribute('font-size', '18');
        labelText.setAttribute('font-family', 'Arial, sans-serif');
        labelText.setAttribute('font-weight', 'bold');
        labelText.setAttribute('opacity', '1.0');
        labelText.setAttribute('text-anchor', 'middle');
        labelText.setAttribute('data-preview-only', 'true');
        labelText.textContent = axisNames[i];
        contentGroup.appendChild(labelText);
      }
    }

    // Add content SVG if available
    if (svgContent) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = svgContent;
      const contentSvg = tempDiv.querySelector('svg') as SVGSVGElement;
      
      if (contentSvg) {
        // Copy all children from content SVG to the content group
        while (contentSvg.firstChild) {
          const child = contentSvg.firstChild;
          contentSvg.removeChild(child);
          contentGroup.appendChild(child);
        }
      }
    }

    // Append the content group to the SVG
    svgElement.appendChild(contentGroup);

    if (svgContainerRef.current) {
      svgContainerRef.current.appendChild(svgElement);
      svgRef.current = svgElement;
    }

    // Cleanup
    return () => {
      if (svgRef.current && svgContainerRef.current && svgContainerRef.current.contains(svgRef.current)) {
        svgContainerRef.current.removeChild(svgRef.current);
        svgRef.current = null;
      }
    };
  }, [svgContent, canvas.width, canvas.height, canvas.margins, viewPan, viewZoom, viewRotation, showGrid, mesh, meshScale, meshOffset]);

  if (!mesh) {
    return (
      <div className="w-full h-full flex flex-col bg-background">
        <div className="bg-card border-b border-border/20 px-6 py-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground tracking-tight">
            Canvas Preview
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">No SVG preview available</p>
            <p className="text-xs text-muted-foreground">Load an STL file to see the 2D projection</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border/20 px-6 py-4 flex-shrink-0 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground tracking-tight mb-1.5">
          Canvas Preview
        </h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">{canvas.preset}</span>
          <span>•</span>
          <span>{canvas.width} × {canvas.height} mm</span>
          <span>•</span>
          <span className="capitalize">{canvas.orientation}</span>
        </div>
      </div>

      {/* Viewport Container with padding */}
      <div className="flex-1 overflow-hidden p-6 bg-background">
        <div
          ref={containerRef}
          className="w-full h-full relative bg-card rounded-xl border border-border/20 shadow-lg hover:shadow-xl transition-shadow duration-200"
          style={{ 
            touchAction: 'none',
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()} // Prevent right-click menu
          onAuxClick={(e) => e.preventDefault()} // Prevent middle-click default behavior
        >
          {/* SVG Container */}
          <div
            ref={svgContainerRef}
            className="absolute inset-0 w-full h-full rounded-xl"
            style={{ minHeight: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}

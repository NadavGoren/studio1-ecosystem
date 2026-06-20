import { useRef, useCallback, useState } from 'react';
import { useAppStore } from '../store';
import { shapeToPath, pointInShape, getShapePoints, moveShapePoint, getShapeBounds } from '../lib/geometry';
import { generateAllHatchLines } from '../lib/hatching';
import { calculateViewBoxDimensions, screenToWorld as screenToWorldLib } from '../lib/coords';
import { getNearestSnap, type SnapGuide } from '../lib/snapping';
import { SelectionOverlay } from './SelectionOverlay';
import type { GroupShape } from '../types';

export function Canvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, centerX: 0, centerY: 0 });
  const isDrawing = useRef(false);
  const drawingShapeId = useRef<string | null>(null);
  const startPoint = useRef({ x: 0, y: 0 });
  const drawingTool = useRef<string | null>(null);
  const hasDragged = useRef(false);
  const minDragDistance = 2; // Minimum distance in mm to consider it a drag
  const draggingPoint = useRef<any>(null);
  const isDraggingShape = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPoint = useRef({ x: 0, y: 0 });
  const initialShapePositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const constraintAxis = useRef<'horizontal' | 'vertical' | null>(null); // Track axis constraint for Shift+drag
  const lockedDelta = useRef<{ dx: number; dy: number } | null>(null); // Track deltas when constraint is activated
  const pointDragStart = useRef<{ x: number; y: number } | null>(null); // Track initial point position when dragging starts

  const { 
    paper, shapes, viewTransform, selectedShapeIds, tool, hatchParams, eyedropperMode, showMargins,
    setViewTransform, addShape, updateShape, selectShape, deselectAll, toggleSelection, commitState, pushState, setHatchParams
  } = useAppStore();

  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    let rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) rect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    return screenToWorldLib(screenX, screenY, rect, paper, viewTransform);
  }, [paper, viewTransform]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) { isPanning.current = true; panStart.current = { x: e.clientX, y: e.clientY, centerX: viewTransform.centerX, centerY: viewTransform.centerY }; return; }
    if (e.button !== 0) return;

    const worldPoint = screenToWorld(e.clientX, e.clientY);

    // Check if a shape was clicked (before handling drawing or selection)
    const clickedShape = [...shapes].reverse().find(s => s.visible && pointInShape(worldPoint.x, worldPoint.y, s, shapes));

    // EYEDROPPER - Let the hit target handle it completely, don't interfere here
    if (tool === 'eyedropper' && clickedShape) {
      // Shape clicks with eyedropper are handled by the hit target's onMouseDown
      // Don't do anything here to avoid interfering with selection
      return;
    }

    // DRAWING
    if (tool !== 'select' && tool !== 'direct_select' && tool !== 'eyedropper') {
       // Allow drawing even when clicking on existing shapes - drawing tools should always create new shapes
       // The existing shape selection is handled by the hit target's onClick, which stops propagation
       
       const snap = getNearestSnap({ x: worldPoint.x, y: worldPoint.y, width: 0, height: 0 }, useAppStore.getState(), []);
       const start = { x: worldPoint.x + snap.deltaX, y: worldPoint.y + snap.deltaY };
       startPoint.current = start;
       
       const id = crypto.randomUUID();
       drawingShapeId.current = id;
       drawingTool.current = tool;
       hasDragged.current = false;
       
       const base = { id, x: start.x, y: start.y, rotation: 0, visible: true, locked: false, strokeWidth: paper.globalStrokeWidth, color: '#000000' };
       if (tool === 'rectangle') addShape({ ...base, type: 'rectangle', width: 0, height: 0 });
       else if (tool === 'ellipse') addShape({ ...base, type: 'ellipse', radiusX: 0, radiusY: 0 });
       else if (tool === 'line') addShape({ ...base, type: 'line', width: 0, height: 0 });
       else if (tool === 'polygon') addShape({ ...base, type: 'polygon', radius: 0, sides: 6 });
       
       isDrawing.current = true;
       return;
    }

    // SELECT - Only handle background clicks here, shape clicks are handled by hit target onClick
    if (!clickedShape) {
       // Click on background - deselect all (unless shift is held for future marquee selection)
       if (!e.shiftKey) {
         deselectAll();
       }
    }
    // If a shape was clicked, let the hit target's onClick handler deal with it
  }, [tool, viewTransform, screenToWorld, shapes, selectedShapeIds]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
       const rect = containerRef.current!.getBoundingClientRect();
       const { viewWidthMM } = calculateViewBoxDimensions(rect, paper, viewTransform);
       const pxPerMM = rect.width / viewWidthMM;
       setViewTransform({
          centerX: panStart.current.centerX - (e.clientX - panStart.current.x) / pxPerMM,
          centerY: panStart.current.centerY - (e.clientY - panStart.current.y) / pxPerMM
       });
       return;
    }

    const curr = screenToWorld(e.clientX, e.clientY);

    // DRAWING
    if (isDrawing.current && drawingShapeId.current) {
       const dx = curr.x - startPoint.current.x;
       const dy = curr.y - startPoint.current.y;
       const distance = Math.hypot(dx, dy);
       
       // Track if user has dragged enough
       if (distance > minDragDistance) {
         hasDragged.current = true;
       }
       
       // Handle shift key for proportional shapes
       const shiftKey = e.shiftKey;
       
      if (drawingTool.current === 'rectangle') {
        // Anchor at start point - start point is one corner, mouse is opposite corner
        // Only snap the mouse position (end point)
        let endX = curr.x;
        let endY = curr.y;
        
        // Create temporary bounds for snapping check
        const tempBounds = {
          x: Math.min(startPoint.current.x, endX),
          y: Math.min(startPoint.current.y, endY),
          width: Math.abs(endX - startPoint.current.x),
          height: Math.abs(endY - startPoint.current.y)
        };
        
        // Apply snapping - only pass mouse position as additional point
        const snap = getNearestSnap(
          tempBounds,
          useAppStore.getState(),
          [drawingShapeId.current],
          undefined,
          5,
          [{ x: endX, y: endY }] // Mouse position (end corner) only
        );
        setSnapGuides(snap.guides);
        
        // Apply snap deltas to the end corner to maintain anchor
        endX += snap.deltaX;
        endY += snap.deltaY;
        
        // Recalculate width/height and center from fixed start point and snapped end point
        let dx = endX - startPoint.current.x;
        let dy = endY - startPoint.current.y;
        let width = Math.abs(dx);
        let height = Math.abs(dy);
        let centerX = startPoint.current.x + dx / 2;
        let centerY = startPoint.current.y + dy / 2;
        
        if (shiftKey) {
          // Maintain square aspect ratio - use the larger dimension
          const size = Math.max(width, height);
          width = size;
          height = size;
          // Adjust center to maintain anchor at start point
          centerX = startPoint.current.x + (dx >= 0 ? size / 2 : -size / 2);
          centerY = startPoint.current.y + (dy >= 0 ? size / 2 : -size / 2);
        }
        
        updateShape(drawingShapeId.current, { 
          x: centerX, 
          y: centerY, 
          width, 
          height 
        });
      } else if (drawingTool.current === 'ellipse') {
        // Anchor center at start point - center stays fixed
        const centerX = startPoint.current.x;
        const centerY = startPoint.current.y;
        
        // Calculate the extent point (where mouse is)
        let extentX = curr.x;
        let extentY = curr.y;
        
        // Calculate preliminary bounds for snapping check
        const tempRadiusX = Math.abs(extentX - centerX);
        const tempRadiusY = Math.abs(extentY - centerY);
        const tempBounds = {
          x: centerX - tempRadiusX,
          y: centerY - tempRadiusY,
          width: tempRadiusX * 2,
          height: tempRadiusY * 2
        };
        
        // Apply snapping - only pass mouse position as additional point
        const snap = getNearestSnap(
          tempBounds,
          useAppStore.getState(),
          [drawingShapeId.current],
          undefined,
          5,
          [{ x: extentX, y: extentY }] // Mouse position (extent point) only
        );
        setSnapGuides(snap.guides);
        
        // Apply snap deltas to the extent point to maintain anchor
        extentX += snap.deltaX;
        extentY += snap.deltaY;
        
        // Recalculate radius from fixed center and snapped extent
        let radiusX = Math.abs(extentX - centerX);
        let radiusY = Math.abs(extentY - centerY);
        
        if (shiftKey) {
          // Maintain circle aspect ratio - use the larger dimension
          const radius = Math.max(radiusX, radiusY);
          radiusX = radius;
          radiusY = radius;
        }
        
        updateShape(drawingShapeId.current, { 
          x: centerX, 
          y: centerY, 
          radiusX, 
          radiusY 
        });
      } else if (drawingTool.current === 'line') {
        // Anchor one end at start point, other end follows mouse
        let endX = curr.x;
        let endY = curr.y;
        
        // For line, create bounds that represent the line's bounding box
        const tempDx = endX - startPoint.current.x;
        const tempDy = endY - startPoint.current.y;
        const lineBounds = {
          x: Math.min(startPoint.current.x, endX),
          y: Math.min(startPoint.current.y, endY),
          width: Math.abs(tempDx),
          height: Math.abs(tempDy)
        };
        
        // Apply snapping - only pass mouse position as additional point
        const snap = getNearestSnap(
          lineBounds,
          useAppStore.getState(),
          [drawingShapeId.current],
          undefined,
          5,
          [{ x: endX, y: endY }] // Mouse position (end point) only
        );
        setSnapGuides(snap.guides);
        
        // Apply snap deltas to the end point to maintain anchor
        endX += snap.deltaX;
        endY += snap.deltaY;
        
        // Recalculate center, width, and rotation from fixed start point and snapped end point
        const centerX = (startPoint.current.x + endX) / 2;
        const centerY = (startPoint.current.y + endY) / 2;
        const finalDx = endX - startPoint.current.x;
        const finalDy = endY - startPoint.current.y;
        const width = Math.hypot(finalDx, finalDy);
        const rotation = Math.atan2(finalDy, finalDx) * 180 / Math.PI;
        
        updateShape(drawingShapeId.current, { 
          x: centerX, 
          y: centerY, 
          width, 
          rotation 
        });
      } else if (drawingTool.current === 'polygon') {
        // Anchor center at start point, radius is distance from start
        const centerX = startPoint.current.x;
        const centerY = startPoint.current.y;
        
        // Calculate the extent point (where mouse is)
        let extentX = curr.x;
        let extentY = curr.y;
        
        // Calculate preliminary bounds for snapping check
        const tempRadius = Math.hypot(extentX - centerX, extentY - centerY);
        const tempBounds = {
          x: centerX - tempRadius,
          y: centerY - tempRadius,
          width: tempRadius * 2,
          height: tempRadius * 2
        };
        
        // Apply snapping - only pass mouse position as additional point
        const snap = getNearestSnap(
          tempBounds,
          useAppStore.getState(),
          [drawingShapeId.current],
          undefined,
          5,
          [{ x: extentX, y: extentY }] // Mouse position (extent point) only
        );
        setSnapGuides(snap.guides);
        
        // Apply snap deltas to the extent point to maintain anchor
        extentX += snap.deltaX;
        extentY += snap.deltaY;
        
        // Recalculate radius from fixed center and snapped extent
        const radius = Math.hypot(extentX - centerX, extentY - centerY);
        
        updateShape(drawingShapeId.current, { 
          x: centerX, 
          y: centerY, 
          radius 
        });
      }
       return;
    }

    // DRAGGING SELECTED SHAPES
    if (isDraggingShape.current && (tool === 'select' || tool === 'eyedropper')) {
       let dx = curr.x - dragStartPoint.current.x;
       let dy = curr.y - dragStartPoint.current.y;
       
       // Constrain to horizontal or vertical axis when Shift is pressed
       const shiftKey = e.shiftKey;
       
       if (shiftKey) {
         // If constraint axis hasn't been determined yet, determine it now
         if (constraintAxis.current === null) {
           const absDx = Math.abs(dx);
           const absDy = Math.abs(dy);
           
           // Determine which axis has larger movement (or default to horizontal if equal)
           constraintAxis.current = absDx >= absDy ? 'horizontal' : 'vertical';
           // Store the current deltas when constraint is activated
           lockedDelta.current = { dx, dy };
         }
         
         // Apply the constraint: lock the perpendicular axis to its value when Shift was pressed
         if (constraintAxis.current === 'horizontal' && lockedDelta.current !== null) {
           // Constrain to horizontal: allow X movement, lock Y to value when Shift was pressed
           dy = lockedDelta.current.dy;
         } else if (constraintAxis.current === 'vertical' && lockedDelta.current !== null) {
           // Constrain to vertical: allow Y movement, lock X to value when Shift was pressed
           dx = lockedDelta.current.dx;
         }
       } else {
         // Shift released - unlock constraint
         constraintAxis.current = null;
         lockedDelta.current = null;
       }
       
       // Get shapes that are being dragged (from initialShapePositions)
       const draggedShapeIds = Array.from(initialShapePositions.current.keys());
       const draggedShapes = shapes.filter(s => draggedShapeIds.includes(s.id));
       
       if (draggedShapes.length > 0) {
         // Calculate combined bounds at initial positions, then offset by movement
         let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
         draggedShapes.forEach(shape => {
           const initialPos = initialShapePositions.current.get(shape.id);
           if (initialPos) {
             // Get bounds of shape at initial position
             const shapeAtInitialPos = { ...shape, x: initialPos.x, y: initialPos.y };
             const b = getShapeBounds(shapeAtInitialPos);
             minX = Math.min(minX, b.x);
             minY = Math.min(minY, b.y);
             maxX = Math.max(maxX, b.x + b.width);
             maxY = Math.max(maxY, b.y + b.height);
           }
         });
         
         // Apply movement delta to get current bounds
         const currentBounds = {
           x: Number.isFinite(minX) ? minX + dx : 0,
           y: Number.isFinite(minY) ? minY + dy : 0,
           width: Number.isFinite(maxX - minX) ? maxX - minX : 0,
           height: Number.isFinite(maxY - minY) ? maxY - minY : 0
         };
         
         // Calculate all corners, edge midpoints, and center point for comprehensive snapping
         const corners = [
           { x: currentBounds.x, y: currentBounds.y }, // Top-left
           { x: currentBounds.x + currentBounds.width, y: currentBounds.y }, // Top-right
           { x: currentBounds.x, y: currentBounds.y + currentBounds.height }, // Bottom-left
           { x: currentBounds.x + currentBounds.width, y: currentBounds.y + currentBounds.height } // Bottom-right
         ];
         const edgeMidpoints = [
           { x: currentBounds.x + currentBounds.width / 2, y: currentBounds.y }, // Top edge midpoint
           { x: currentBounds.x + currentBounds.width / 2, y: currentBounds.y + currentBounds.height }, // Bottom edge midpoint
           { x: currentBounds.x + currentBounds.width, y: currentBounds.y + currentBounds.height / 2 }, // Right edge midpoint
           { x: currentBounds.x, y: currentBounds.y + currentBounds.height / 2 } // Left edge midpoint
         ];
         const centerPoint = {
           x: currentBounds.x + currentBounds.width / 2,
           y: currentBounds.y + currentBounds.height / 2
         };
         
         // Apply comprehensive snapping with all relevant points
         const snap = getNearestSnap(
           currentBounds,
           useAppStore.getState(),
           draggedShapeIds,
           undefined,
           5,
           [
             ...corners,
             ...edgeMidpoints,
             centerPoint
           ]
         );
         setSnapGuides(snap.guides);
         const snappedDx = dx + snap.deltaX;
         const snappedDy = dy + snap.deltaY;
         
         // Update all shapes that are being dragged
         // If dragging a group, move its children instead
         initialShapePositions.current.forEach((initialPos, shapeId) => {
            const shape = shapes.find(s => s.id === shapeId);
            if (shape && shape.type === 'group') {
              // Move all children of the group
              const group = shape as GroupShape;
              group.childrenIds.forEach((childId: string) => {
                const child = shapes.find(s => s.id === childId);
                if (child) {
                  const childInitialPos = initialShapePositions.current.get(childId);
                  if (childInitialPos) {
                    updateShape(childId, { x: childInitialPos.x + snappedDx, y: childInitialPos.y + snappedDy });
                  } else {
                    // Fallback: use current position
                    updateShape(childId, { x: child.x + snappedDx, y: child.y + snappedDy });
                  }
                }
              });
              // Also update group position
              updateShape(shapeId, { x: initialPos.x + snappedDx, y: initialPos.y + snappedDy });
            } else {
              updateShape(shapeId, { x: initialPos.x + snappedDx, y: initialPos.y + snappedDy });
            }
         });
       } else {
         // Fallback if no shapes found
         initialShapePositions.current.forEach((initialPos, shapeId) => {
            updateShape(shapeId, { x: initialPos.x + dx, y: initialPos.y + dy });
         });
       }
       return;
    }

    // DIRECT SELECT DRAG
    if (draggingPoint.current) {
       const { shapeId, idx } = draggingPoint.current;
       const s = shapes.find(sh => sh.id === shapeId);
       if(s) {
         // Initialize point drag start position if not set
         if (pointDragStart.current === null) {
           const point = getShapePoints(s)[idx];
           pointDragStart.current = { x: point.x, y: point.y };
           // Reset constraint state when starting new point drag
           constraintAxis.current = null;
           lockedDelta.current = null;
         }
         
         // Calculate movement delta from initial point position
         let dx = curr.x - pointDragStart.current.x;
         let dy = curr.y - pointDragStart.current.y;
         
         // Constrain to horizontal or vertical axis when Shift is pressed
         const shiftKey = e.shiftKey;
         
         if (shiftKey) {
           // If constraint axis hasn't been determined yet, determine it now
           if (constraintAxis.current === null) {
             const absDx = Math.abs(dx);
             const absDy = Math.abs(dy);
             
             // Determine which axis has larger movement (or default to horizontal if equal)
             constraintAxis.current = absDx >= absDy ? 'horizontal' : 'vertical';
             // Store the current deltas when constraint is activated
             lockedDelta.current = { dx, dy };
           }
           
           // Apply the constraint: lock the perpendicular axis to its value when Shift was pressed
           if (constraintAxis.current === 'horizontal' && lockedDelta.current !== null) {
             // Constrain to horizontal: allow X movement, lock Y to value when Shift was pressed
             dy = lockedDelta.current.dy;
           } else if (constraintAxis.current === 'vertical' && lockedDelta.current !== null) {
             // Constrain to vertical: allow Y movement, lock X to value when Shift was pressed
             dx = lockedDelta.current.dx;
           }
         } else {
           // Shift released - unlock constraint
           constraintAxis.current = null;
           lockedDelta.current = null;
         }
         
         // Calculate constrained point position
         const constrainedX = pointDragStart.current.x + dx;
         const constrainedY = pointDragStart.current.y + dy;
         
         // Apply snapping to the constrained point position
         const pointBounds = { x: constrainedX, y: constrainedY, width: 0, height: 0 };
         const snap = getNearestSnap(pointBounds, useAppStore.getState(), [shapeId]);
         setSnapGuides(snap.guides);
         const snappedX = constrainedX + snap.deltaX;
         const snappedY = constrainedY + snap.deltaY;
         updateShape(shapeId, moveShapePoint(s, idx, snappedX, snappedY));
       }
    }

  }, [viewTransform, paper, screenToWorld, shapes, selectedShapeIds, updateShape]);

  const handleMouseUp = () => {
    isPanning.current = false;
    
    // Handle drawing completion - only keep shape if it was dragged enough
    if (isDrawing.current && drawingShapeId.current) {
      const shape = shapes.find(s => s.id === drawingShapeId.current);
      if (shape && hasDragged.current) {
        // Check if shape has minimum size
        let hasMinSize = false;
        if (shape.type === 'rectangle') {
          hasMinSize = shape.width >= minDragDistance && shape.height >= minDragDistance;
        } else if (shape.type === 'ellipse') {
          hasMinSize = shape.radiusX * 2 >= minDragDistance && shape.radiusY * 2 >= minDragDistance;
        } else if (shape.type === 'line') {
          hasMinSize = shape.width >= minDragDistance;
        } else if (shape.type === 'polygon') {
          hasMinSize = shape.radius * 2 >= minDragDistance;
        }
        
        if (hasMinSize) {
          commitState();
        } else {
          // Delete the shape if it's too small
          const { deleteShapes } = useAppStore.getState();
          deleteShapes([drawingShapeId.current]);
        }
      } else {
        // No drag happened or shape is too small - delete it
        const { deleteShapes } = useAppStore.getState();
        if (drawingShapeId.current) {
          deleteShapes([drawingShapeId.current]);
        }
      }
    } else if (draggingPoint.current || isDraggingShape.current) {
      commitState();
    }
    
    isDrawing.current = false;
    drawingShapeId.current = null;
    draggingPoint.current = null;
    pointDragStart.current = null; // Reset point drag start position
    isDraggingShape.current = false;
    setIsDragging(false);
    hasDragged.current = false;
    initialShapePositions.current.clear();
    setSnapGuides([]);
    // Reset constraint state
    constraintAxis.current = null;
    lockedDelta.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const newScale = Math.max(0.1, Math.min(20, viewTransform.scale * (e.deltaY > 0 ? 0.9 : 1.1)));
    setViewTransform({ scale: newScale });
  };

  const { viewBoxX, viewBoxY, viewWidthMM, viewHeightMM } = calculateViewBoxDimensions(
    containerRef.current?.getBoundingClientRect() || new DOMRect(0,0,100,100), paper, viewTransform
  );

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 bg-gray-100 overflow-hidden" 
      style={{ cursor: isDragging ? 'grabbing' : 'default' }}
      onMouseDown={handleMouseDown} 
      onMouseMove={handleMouseMove} 
      onMouseUp={handleMouseUp} 
      onWheel={handleWheel}
    >
      <svg ref={svgRef} viewBox={`${viewBoxX} ${viewBoxY} ${viewWidthMM} ${viewHeightMM}`} className="w-full h-full block">
        {/* Paper background */}
        <rect x="0" y="0" width={paper.width} height={paper.height} fill={paper.canvasColor} stroke="#ccc" strokeWidth="0.2"/>
        
        {/* Margin visualization */}
        {showMargins && paper.margin > 0 && (
          <rect 
            x={paper.margin} 
            y={paper.margin} 
            width={paper.width - paper.margin * 2} 
            height={paper.height - paper.margin * 2} 
            fill="none" 
            stroke="#999" 
            strokeWidth="0.2" 
            strokeDasharray="3,3"
            opacity="0.7"
          />
        )}
        
        {/* Snap guides */}
        {snapGuides.map((guide, idx) => {
          // Green for margins and canvas centers, pink for other guides
          const strokeColor = (guide.isMargin === true || guide.isCenter === true) ? "#00ff00" : "#ff0066";
          if (guide.type === 'vertical') {
            return (
              <line
                key={`v-${idx}`}
                x1={guide.offset}
                y1={-10000}
                x2={guide.offset}
                y2={10000}
                stroke={strokeColor}
                strokeWidth="0.3"
                strokeDasharray="2,2"
                opacity="0.8"
                pointerEvents="none"
              />
            );
          } else {
            return (
              <line
                key={`h-${idx}`}
                x1={-10000}
                y1={guide.offset}
                x2={10000}
                y2={guide.offset}
                stroke={strokeColor}
                strokeWidth="0.3"
                strokeDasharray="2,2"
                opacity="0.8"
                pointerEvents="none"
              />
            );
          }
        })}
        
        <g>
          {shapes.map(s => {
             const hatch = hatchParams[s.id];
             const lines = hatch?.enabled ? generateAllHatchLines(s, hatch) : [];
             // Groups don't render outline (they're just containers), other shapes follow hatch settings
             // Lines always show outline, polylines respect renderOutline setting (unlike before)
             const showOutline = s.type !== 'group' && (!hatch?.enabled || hatch?.renderOutline || s.type === 'line');
             // Use global color if override is enabled, otherwise use shape's color
             const strokeColor = paper.globalColorOverride ? paper.globalColor : s.color;
             // Each shape carries its own stroke width; fall back to the global default if unset.
             const strokeWidth = s.strokeWidth ?? paper.globalStrokeWidth;

             return (
               <g key={s.id}>
                 {/* Hatching */}
                 {lines.map((d, i) => <path key={i} d={d} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" />)}

                 {/* Outline - FIX: fillRule="evenodd" allows holes to render correctly */}
                 {/* Groups don't render their bounding box outline */}
                 {showOutline && <path d={shapeToPath(s, shapes)} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" fillRule="evenodd" />}
                 
                 {/* Hit Target */}
                 <path 
                   d={shapeToPath(s, shapes)} 
                   stroke="transparent" 
                   strokeWidth={5} 
                   fill="transparent" 
                   fillRule="evenodd" 
                   style={{ 
                     cursor: tool === 'eyedropper' ? 'crosshair' : (tool === 'select' ? 'grab' : 'default')
                   }}
                   onMouseDown={(e) => { 
                         if (e.button !== 0) return;
                         
                         // Handle eyedropper tool FIRST - before any other logic
                         if (tool === 'eyedropper') {
                           e.preventDefault();
                           e.stopPropagation();
                           if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
                             e.nativeEvent.stopImmediatePropagation();
                           }
                           
                           // Get the clicked shape's properties
                           const sourceShape = s;
                           const sourceHatchParams = hatchParams[sourceShape.id];
                           
                           // Copy properties to currently selected shapes (excluding the source shape itself)
                           const shapesToUpdate = selectedShapeIds.filter(id => id !== s.id);
                           
                           if (shapesToUpdate.length > 0) {
                             pushState();
                             
                             // Copy properties based on eyedropperMode settings
                             shapesToUpdate.forEach(targetId => {
                               if (eyedropperMode.copyColor) {
                                 updateShape(targetId, { color: sourceShape.color });
                               }
                               if (eyedropperMode.copyStroke) {
                                 updateShape(targetId, { strokeWidth: sourceShape.strokeWidth });
                               }
                               if (eyedropperMode.copyHatch && sourceHatchParams) {
                                 setHatchParams(targetId, { ...sourceHatchParams });
                               }
                             });
                           }
                           
                           // Don't change selection - keep current selection unchanged
                           // Don't allow dragging with eyedropper - it's just for copying properties
                           return;
                         }
                         
                         // Don't stop propagation for drawing tools - allow them to create new shapes
                         if (tool === 'select' || tool === 'direct_select') {
                           e.stopPropagation();
                         }
                         
                         if (e.button === 0) {
                           
                           // Only handle selection/dragging for select tools
                           if (tool === 'select') {
                             const wasSelected = selectedShapeIds.includes(s.id);
                             
                             // Only change selection if:
                             // 1. Shift is held (toggle selection)
                             // 2. Shape is not already selected (clicking on unselected shape)
                             if (e.shiftKey) {
                               toggleSelection(s.id);
                             } else if (!wasSelected) {
                               // Only change selection if clicking on an unselected shape
                               selectShape(s.id);
                             }
                             // If shape is already selected and no Shift, keep current selection
                             
                             // Prepare for dragging if using select tool and shape is/will be selected
                             const willBeSelected = e.shiftKey ? !wasSelected : (wasSelected || !wasSelected);
                             if (willBeSelected) {
                               const worldPoint = screenToWorld(e.clientX, e.clientY);
                               
                               // Check for Option/Alt key for duplication
                               const isDuplicating = e.altKey || (e.nativeEvent as MouseEvent)?.altKey;
                               
                               // Calculate which shapes will be selected after the toggle/select
                               // If clicking on an already-selected shape, drag all selected shapes
                               let shapesToDrag = e.shiftKey 
                                 ? (wasSelected 
                                     ? selectedShapeIds.filter(id => id !== s.id)
                                     : [...selectedShapeIds, s.id])
                                 : wasSelected 
                                   ? selectedShapeIds  // Keep all selected shapes if clicking on already-selected shape
                                   : [s.id];  // Only drag the clicked shape if it wasn't selected
                               
                               // If Option is pressed, duplicate the shapes first
                               if (isDuplicating) {
                                 console.log('Option+drag detected - duplicating shapes');
                                 pushState();
                                 
                                 const state = useAppStore.getState();
                                 const shapesToDuplicate = state.shapes.filter(sh => shapesToDrag.includes(sh.id));
                                 
                                 // Create ID mapping for duplication
                                 const idMap = new Map<string, string>();
                                 shapesToDuplicate.forEach(sh => {
                                   idMap.set(sh.id, crypto.randomUUID());
                                   if (sh.type === 'group') {
                                     const group = sh as GroupShape;
                                     group.childrenIds.forEach((childId: string) => {
                                       if (!idMap.has(childId)) {
                                         idMap.set(childId, crypto.randomUUID());
                                       }
                                     });
                                   }
                                 });
                                 
                                 // Clone shapes
                                 const duplicates: any[] = [];
                                 const newHatchParams: Record<string, any> = {};
                                 
                                 shapesToDuplicate.forEach(originalShape => {
                                   const newId = idMap.get(originalShape.id)!;
                                   const duplicate = JSON.parse(JSON.stringify(originalShape));
                                   duplicate.id = newId;
                                   
                                   // Handle groups
                                   if (originalShape.type === 'group') {
                                     const group = duplicate as GroupShape;
                                     group.childrenIds = group.childrenIds.map(cid => idMap.get(cid)!).filter((id): id is string => !!id);
                                   }
                                   
                                   // Handle groupId references
                                   if (duplicate.groupId && idMap.has(duplicate.groupId)) {
                                     duplicate.groupId = idMap.get(duplicate.groupId);
                                   } else {
                                     delete duplicate.groupId;
                                   }
                                   
                                   duplicates.push(duplicate);
                                   
                                   // Copy hatch params
                                   if (state.hatchParams[originalShape.id]) {
                                     newHatchParams[newId] = JSON.parse(JSON.stringify(state.hatchParams[originalShape.id]));
                                   }
                                   
                                   // Handle group children
                                   if (originalShape.type === 'group') {
                                     const group = originalShape as GroupShape;
                                     group.childrenIds.forEach((childId: string) => {
                                       const child = state.shapes.find(sh => sh.id === childId);
                                       if (child) {
                                         const newChildId = idMap.get(childId)!;
                                         const childDuplicate = JSON.parse(JSON.stringify(child));
                                         childDuplicate.id = newChildId;
                                         
                                         if (childDuplicate.groupId && idMap.has(childDuplicate.groupId)) {
                                           childDuplicate.groupId = idMap.get(childDuplicate.groupId);
                                         } else {
                                           delete childDuplicate.groupId;
                                         }
                                         
                                         duplicates.push(childDuplicate);
                                         
                                         if (state.hatchParams[childId]) {
                                           newHatchParams[newChildId] = JSON.parse(JSON.stringify(state.hatchParams[childId]));
                                         }
                                       }
                                     });
                                   }
                                 });
                                 
                                 // Add duplicates to store and select them
                                 const newShapeIds = duplicates.map(d => d.id);
                                 useAppStore.setState((state) => ({
                                   shapes: [...state.shapes, ...duplicates],
                                   selectedShapeIds: newShapeIds,
                                   hatchParams: { ...state.hatchParams, ...newHatchParams }
                                 }));
                                 
                                 // Update shapesToDrag to use the duplicated shapes
                                 shapesToDrag = newShapeIds;
                                 console.log('Duplication complete - new shape IDs:', newShapeIds);
                               }
                               
                              // Push state before starting drag operation
                              if (!isDuplicating) {
                                pushState();
                              }
                              
                              isDraggingShape.current = true;
                              setIsDragging(true);
                              dragStartPoint.current = worldPoint;
                              initialShapePositions.current.clear();
                              // Reset constraint state
                              constraintAxis.current = null;
                              lockedDelta.current = null;
                               
                               // Get fresh shapes from store (in case we duplicated)
                               const currentShapes = useAppStore.getState().shapes;
                               
                               // Store initial positions for all shapes to drag, including group children
                               currentShapes.filter(sh => shapesToDrag.includes(sh.id)).forEach(sh => {
                                 initialShapePositions.current.set(sh.id, { x: sh.x, y: sh.y });
                                 // If it's a group, also store positions of all children
                                 if (sh.type === 'group') {
                                   const group = sh as GroupShape;
                                   group.childrenIds.forEach((childId: string) => {
                                     const child = currentShapes.find(c => c.id === childId);
                                     if (child && !initialShapePositions.current.has(childId)) {
                                       initialShapePositions.current.set(childId, { x: child.x, y: child.y });
                                     }
                                   });
                                 }
                               });
                               
                               // commitState will be called on mouseUp
                             }
                           }
                         }
                       }} />
                 
                 {/* Selection Highlight */}
                 {selectedShapeIds.includes(s.id) && <path d={shapeToPath(s, shapes)} stroke="#0066ff" strokeWidth={1} fill="none" fillRule="evenodd" pointerEvents="none" />}
               </g>
             );
          })}
        </g>
        
        <SelectionOverlay containerRef={containerRef} paper={paper} viewTransform={viewTransform} />
        
        {/* Direct Select Points */}
        {tool === 'direct_select' && shapes.filter(s => selectedShapeIds.includes(s.id)).map(s => (
           (s.type === 'polyline' || s.type === 'polygon' || s.type === 'rectangle') && getShapePoints(s).map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={2} fill="white" stroke="#0066ff" strokeWidth="0.5" 
                      style={{cursor: 'move'}}
                      onMouseDown={(e) => { 
                        e.stopPropagation(); 
                        pushState(); // Push state before starting point edit
                        draggingPoint.current = { shapeId: s.id, idx: i }; 
                      }} />
           ))
        ))}
      </svg>
    </div>
  );
}
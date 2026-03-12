import { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { getShapeBounds, getShapeCentroid } from '../lib/geometry';
import { screenToWorld } from '../lib/coords';
import { getNearestSnap, type SnapGuide, type ActiveEdges } from '../lib/snapping';
import type { PaperSettings, ViewTransform, Shape, PolylineShape, GroupShape } from '../types';

interface SelectionOverlayProps {
  containerRef: React.RefObject<HTMLDivElement>;
  paper: PaperSettings;
  viewTransform: ViewTransform;
}

export function SelectionOverlay({ containerRef, paper, viewTransform }: SelectionOverlayProps) {
  const { shapes, selectedShapeIds, updateShape, tool } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  
  const dragMode = useRef<'move' | 'resize' | 'rotate' | null>(null);
  const resizeHandle = useRef<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialShapeState = useRef<Map<string, Shape>>(new Map());
  const initialBounds = useRef({ x: 0, y: 0, width: 0, height: 0, centerX: 0, centerY: 0 });
  const rotationAnchor = useRef({ x: 0, y: 0 }); // Centroid for rotation
  const anchorPoint = useRef({ x: 0, y: 0 });
  const isDuplicating = useRef(false); // Track if we're duplicating shapes
  const duplicatedShapeIds = useRef<string[]>([]); // Store IDs of duplicated shapes
  const constraintAxis = useRef<'horizontal' | 'vertical' | null>(null); // Track axis constraint for Shift+drag
  const lockedDelta = useRef<{ dx: number; dy: number } | null>(null); // Track deltas when constraint is activated
  const currentBounds = useRef({ x: 0, y: 0, width: 0, height: 0 }); // Track current bounds during resize
  const initialRotationAngle = useRef<number>(0); // Track initial rotation angle for 45-degree snapping
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  const selectedShapes = shapes.filter((shape) => selectedShapeIds.includes(shape.id));
  const hasSelection = selectedShapes.length > 0;

  // Calculate Group Bounds
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  selectedShapes.forEach((shape) => {
    const b = getShapeBounds(shape, shapes);
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height);
  });
  
  const bounds = { 
    x: Number.isFinite(minX) ? minX : 0, 
    y: Number.isFinite(minY) ? minY : 0, 
    width: Number.isFinite(maxX - minX) ? maxX - minX : 0, 
    height: Number.isFinite(maxY - minY) ? maxY - minY : 0 
  };

  // Helper function to map handle name to active edges
  const getActiveEdgesFromHandle = (handle: string | null): ActiveEdges | undefined => {
    if (!handle) return undefined;
    
    switch (handle) {
      case 'nw':
        return { left: true, top: true, corners: ['nw'] };
      case 'ne':
        return { right: true, top: true, corners: ['ne'] };
      case 'sw':
        return { left: true, bottom: true, corners: ['sw'] };
      case 'se':
        return { right: true, bottom: true, corners: ['se'] };
      case 'n':
        return { top: true };
      case 's':
        return { bottom: true };
      case 'e':
        return { right: true };
      case 'w':
        return { left: true };
      default:
        return undefined;
    }
  };

  const prepareDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    
    // Get fresh shapes from store (in case we recentered polylines or duplicated)
    const currentShapes = useAppStore.getState().shapes;
    // Use duplicated shape IDs if we're duplicating, otherwise use selected IDs from store
    const currentSelectedIds = useAppStore.getState().selectedShapeIds;
    const idsToUse = isDuplicating.current ? duplicatedShapeIds.current : currentSelectedIds;
    const currentSelectedShapes = currentShapes.filter((shape) => idsToUse.includes(shape.id));
    
    // If duplicating and no shapes found, something went wrong - fall back to original selection
    if (isDuplicating.current && currentSelectedShapes.length === 0) {
      isDuplicating.current = false;
      duplicatedShapeIds.current = [];
      const fallbackShapes = currentShapes.filter((shape) => currentSelectedIds.includes(shape.id));
      if (fallbackShapes.length > 0) {
        return screenToWorld(e.clientX, e.clientY, containerRef.current!.getBoundingClientRect(), paper, viewTransform);
      }
    }
    
    // Recalculate bounds with current shapes
    let recalcMinX = Infinity, recalcMinY = Infinity, recalcMaxX = -Infinity, recalcMaxY = -Infinity;
    currentSelectedShapes.forEach((shape) => {
      const b = getShapeBounds(shape, currentShapes);
      recalcMinX = Math.min(recalcMinX, b.x);
      recalcMinY = Math.min(recalcMinY, b.y);
      recalcMaxX = Math.max(recalcMaxX, b.x + b.width);
      recalcMaxY = Math.max(recalcMaxY, b.y + b.height);
    });
    
    const currentBounds = {
      x: Number.isFinite(recalcMinX) ? recalcMinX : 0,
      y: Number.isFinite(recalcMinY) ? recalcMinY : 0,
      width: Number.isFinite(recalcMaxX - recalcMinX) ? recalcMaxX - recalcMinX : 0,
      height: Number.isFinite(recalcMaxY - recalcMinY) ? recalcMaxY - recalcMinY : 0
    };
    
    initialShapeState.current.clear();
    currentSelectedShapes.forEach(s => {
      initialShapeState.current.set(s.id, JSON.parse(JSON.stringify(s)));
      // If it's a group, also store all children
      if (s.type === 'group') {
        const group = s as GroupShape;
        group.childrenIds.forEach((childId: string) => {
          const child = currentShapes.find(c => c.id === childId);
          if (child) {
            initialShapeState.current.set(childId, JSON.parse(JSON.stringify(child)));
          }
        });
      }
    });
    
    initialBounds.current = {
      x: currentBounds.x, 
      y: currentBounds.y, 
      width: currentBounds.width, 
      height: currentBounds.height,
      centerX: currentBounds.x + currentBounds.width/2, 
      centerY: currentBounds.y + currentBounds.height/2
    };
    
    // Calculate the centroid (geometric center) for rotation anchor point
    // This is better than bounding box center for complex unioned shapes
    if (currentSelectedShapes.length === 1) {
      const shape = currentSelectedShapes[0];
      const centroid = getShapeCentroid(shape, currentShapes);
      rotationAnchor.current = { x: centroid.x, y: centroid.y };
    } else {
      // For multiple shapes, calculate centroid of each shape and average them
      // This gives a better result than averaging all vertices
      const centroids: { x: number; y: number }[] = [];
      currentSelectedShapes.forEach(shape => {
        const centroid = getShapeCentroid(shape, currentShapes);
        centroids.push(centroid);
      });
      if (centroids.length > 0) {
        const sumX = centroids.reduce((sum, c) => sum + c.x, 0);
        const sumY = centroids.reduce((sum, c) => sum + c.y, 0);
        rotationAnchor.current = {
          x: sumX / centroids.length,
          y: sumY / centroids.length
        };
      } else {
        rotationAnchor.current = {
          x: initialBounds.current.centerX,
          y: initialBounds.current.centerY
        };
      }
    }

    const rect = containerRef.current!.getBoundingClientRect();
    return screenToWorld(e.clientX, e.clientY, rect, paper, viewTransform);
  };

  const handleStart = (e: React.MouseEvent, mode: 'move'|'resize'|'rotate', handle?: string) => {
    e.preventDefault(); // Prevent default behavior
    e.stopPropagation(); // Stop event from bubbling
    
    console.log('=== handleStart CALLED ===');
    console.log('Mode:', mode);
    console.log('Event type:', e.type);
    console.log('e.altKey:', e.altKey);
    console.log('e.shiftKey:', e.shiftKey);
    console.log('e.ctrlKey:', e.ctrlKey);
    console.log('e.metaKey:', e.metaKey);
    
    // Get the native event
    const nativeEvent = e.nativeEvent as MouseEvent;
    console.log('nativeEvent.altKey:', nativeEvent?.altKey);
    console.log('nativeEvent.type:', nativeEvent?.type);
    
    // Try multiple ways to detect Option key
    // On Mac, Option key should set altKey to true
    const altKeyState = e.altKey || (nativeEvent && nativeEvent.altKey);
    const isDuplicateMode = mode === 'move' && altKeyState;
    
    console.log('altKeyState:', altKeyState);
    console.log('isDuplicateMode:', isDuplicateMode);
    console.log('selectedShapes.length:', selectedShapes.length);
    
    useAppStore.getState().pushState();
    
    isDuplicating.current = isDuplicateMode;
    duplicatedShapeIds.current = [];
    
    // If duplicating, create duplicates before starting the drag
    if (isDuplicateMode) {
      console.log('>>> DUPLICATION MODE ACTIVATED <<<');
      const state = useAppStore.getState();
      // Get fresh selected shapes from store (don't rely on component's selectedShapes)
      const shapesToDuplicate = state.shapes.filter((shape) => state.selectedShapeIds.includes(shape.id));
      
      console.log('shapesToDuplicate.length:', shapesToDuplicate.length);
      console.log('selectedShapeIds:', state.selectedShapeIds);
      
      // Only proceed if we have shapes to duplicate
      if (shapesToDuplicate.length === 0) {
        console.log('WARNING: No shapes to duplicate!');
        // Reset duplication state if no shapes to duplicate
        isDuplicating.current = false;
      } else {
        console.log('Creating duplicates for', shapesToDuplicate.length, 'shapes');
      
      const idMap = new Map<string, string>();
      const shapeMap = new Map(state.shapes.map(s => [s.id, s]));
      
      // First pass: Recursively collect all IDs (including nested groups)
      const collectChildren = (shape: Shape) => {
        if (!idMap.has(shape.id)) {
          idMap.set(shape.id, crypto.randomUUID());
        }
        
        if (shape.type === 'group') {
          const group = shape as GroupShape;
          group.childrenIds.forEach((childId: string) => {
            const child = shapeMap.get(childId);
            if (child) {
              collectChildren(child); // Recursively collect nested groups
            }
          });
        }
      };
      
      shapesToDuplicate.forEach(collectChildren);
      
      // Second pass: Clone all shapes (children first, then top-level)
      const duplicates: Shape[] = [];
      const newHatchParams: Record<string, any> = {};
      const processed = new Set<string>();
      
      const duplicateShape = (original: Shape): void => {
        if (processed.has(original.id)) {
          return; // Already processed
        }
        
        const newId = idMap.get(original.id);
        if (!newId) {
          return; // Not in duplication set
        }
        
        processed.add(original.id);
        const duplicate = JSON.parse(JSON.stringify(original)); // Deep clone
        duplicate.id = newId;
        // Don't add offset - user will drag to position
        
        // Handle groupId references
        if (duplicate.groupId && idMap.has(duplicate.groupId)) {
          duplicate.groupId = idMap.get(duplicate.groupId);
        } else if (duplicate.groupId) {
          delete duplicate.groupId;
        }
        
        // Handle groups: remap childrenIds and duplicate children first
        if (original.type === 'group') {
          const group = duplicate as GroupShape;
          const newChildrenIds: string[] = [];
          
          // Duplicate all children first (recursively)
          (original as GroupShape).childrenIds.forEach((childId: string) => {
            const child = shapeMap.get(childId);
            if (child && idMap.has(childId)) {
              duplicateShape(child); // Recursively duplicate child
              newChildrenIds.push(idMap.get(childId)!);
            }
          });
          
          group.childrenIds = newChildrenIds;
        }
        
        duplicates.push(duplicate);
        
        // Copy hatch params
        if (state.hatchParams[original.id]) {
          newHatchParams[newId] = JSON.parse(JSON.stringify(state.hatchParams[original.id]));
        }
      };
      
      // Duplicate all top-level shapes (children will be duplicated recursively)
      shapesToDuplicate.forEach(shape => {
        duplicateShape(shape);
        const newId = idMap.get(shape.id);
        if (newId) {
          duplicatedShapeIds.current.push(newId);
        }
      });
      
        // Add duplicates to store using Zustand's setState
        // This is synchronous, so the state will be updated immediately
        console.log('Adding', duplicates.length, 'duplicates to store');
        console.log('Duplicated shape IDs:', duplicatedShapeIds.current);
        useAppStore.setState((state) => {
          const newShapes = [...state.shapes, ...duplicates];
          const newSelectedIds = duplicatedShapeIds.current;
          const newHatch = { ...state.hatchParams, ...newHatchParams };
          console.log('Store updated - new total shapes:', newShapes.length);
          console.log('New selected IDs:', newSelectedIds);
          return {
            shapes: newShapes,
            selectedShapeIds: newSelectedIds,
            hatchParams: newHatch
          };
        });
        
        // Verify the update
        const verifyState = useAppStore.getState();
        const foundDuplicates = verifyState.shapes.filter(s => duplicatedShapeIds.current.includes(s.id));
        console.log('Verification - found', foundDuplicates.length, 'duplicates in store');
      }
    } else {
      console.log('Not in duplicate mode - normal drag');
    }
    
    // Don't recenter shapes before rotation - this causes unwanted jumps
    // The rotation anchor will be calculated from the current shape position
    const start = prepareDrag(e);
    dragMode.current = mode;
    constraintAxis.current = null; // Reset constraint axis
    lockedDelta.current = null; // Reset locked delta
    
    // Store initial rotation angle for 45-degree snapping
    if (mode === 'rotate') {
      const anchorX = rotationAnchor.current.x;
      const anchorY = rotationAnchor.current.y;
      initialRotationAngle.current = Math.atan2(start.y - anchorY, start.x - anchorX);
    }
    if (handle) {
      resizeHandle.current = handle;
      // Calculate anchor point (opposite handle)
      const initB = initialBounds.current;
      if (handle.includes('w')) anchorPoint.current.x = initB.x + initB.width; // East edge
      else if (handle.includes('e')) anchorPoint.current.x = initB.x; // West edge
      else anchorPoint.current.x = initB.x + initB.width / 2; // Center (for n/s only)
      
      if (handle.includes('n')) anchorPoint.current.y = initB.y + initB.height; // South edge
      else if (handle.includes('s')) anchorPoint.current.y = initB.y; // North edge
      else anchorPoint.current.y = initB.y + initB.height / 2; // Center (for e/w only)
    }
    dragStart.current = start;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const mouse = screenToWorld(e.clientX, e.clientY, rect, paper, viewTransform);
      const start = dragStart.current;
      
      if (dragMode.current === 'move') {
        let dx = mouse.x - start.x;
        let dy = mouse.y - start.y;
        
        // Constrain to horizontal or vertical axis when Shift is pressed
        // Check shiftKey the same way resize does
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
            console.log('Shift constraint activated:', constraintAxis.current, 'dx:', dx, 'dy:', dy);
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
          if (constraintAxis.current !== null) {
            console.log('Shift constraint released');
          }
          constraintAxis.current = null;
          lockedDelta.current = null;
        }
        
        // Use duplicated shape IDs if we're duplicating, otherwise use selected IDs
        const shapeIdsToMove = isDuplicating.current ? duplicatedShapeIds.current : selectedShapeIds;
        
        // Calculate current bounds after movement
        const currentBounds = {
          x: initialBounds.current.x + dx,
          y: initialBounds.current.y + dy,
          width: initialBounds.current.width,
          height: initialBounds.current.height
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
        const state = useAppStore.getState();
         const snap = getNearestSnap(
           currentBounds,
           state,
           shapeIdsToMove,
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
        
        initialShapeState.current.forEach((initS, id) => {
           if (shapeIdsToMove.includes(id)) {
             // If it's a group, move all children
             if (initS.type === 'group') {
               const group = initS as GroupShape;
               group.childrenIds.forEach((childId: string) => {
                 const childInit = initialShapeState.current.get(childId);
                 if (childInit) {
                   updateShape(childId, { x: childInit.x + snappedDx, y: childInit.y + snappedDy });
                 }
               });
             }
             // Also update the group/shape itself
             updateShape(id, { x: initS.x + snappedDx, y: initS.y + snappedDy });
           }
        });
      }
      
      if (dragMode.current === 'rotate') {
        // Use the centroid (geometric center) as the rotation anchor point
        // This provides better rotation behavior for complex unioned shapes
        const anchorX = rotationAnchor.current.x;
        const anchorY = rotationAnchor.current.y;
        
        // Calculate initial angle from anchor to drag start
        const startAngle = initialRotationAngle.current;
        // Calculate current angle from anchor to mouse
        const currentAngle = Math.atan2(mouse.y - anchorY, mouse.x - anchorX);
        // Calculate rotation delta
        const deltaAngle = currentAngle - startAngle;
        let deltaDegrees = (deltaAngle * 180) / Math.PI;
        
        // Snap to 45-degree increments when Shift is pressed
        if (e.shiftKey) {
          // Get the initial rotation of the first selected shape to calculate total rotation
          const shapeIdsToRotate = isDuplicating.current ? duplicatedShapeIds.current : selectedShapeIds;
          const firstShapeId = shapeIdsToRotate[0];
          if (firstShapeId) {
            const firstInitShape = initialShapeState.current.get(firstShapeId);
            if (firstInitShape) {
              const initialRotation = firstInitShape.rotation || 0;
              // Calculate total rotation (initial + delta)
              const totalRotation = (initialRotation + deltaDegrees + 360) % 360;
              // Snap to nearest 45-degree increment
              const snappedTotal = Math.round(totalRotation / 45) * 45;
              // Calculate snapped delta
              deltaDegrees = snappedTotal - initialRotation;
              // Normalize to -180 to 180 range for better behavior
              if (deltaDegrees > 180) deltaDegrees -= 360;
              if (deltaDegrees < -180) deltaDegrees += 360;
            }
          }
        }
        
        // Use duplicated shape IDs if we're duplicating, otherwise use selected IDs
        const shapeIdsToRotate = isDuplicating.current ? duplicatedShapeIds.current : selectedShapeIds;
        
        // Get current shapes to recalculate centroids (they may have changed)
        const currentShapesForRotation = useAppStore.getState().shapes;
        
        // Apply rotation to all selected shapes (including group children)
        initialShapeState.current.forEach((initS, id) => {
          if (shapeIdsToRotate.includes(id)) {
            // Get current shape
            const currentShape = currentShapesForRotation.find(s => s.id === id);
            if (!currentShape) return;
            
            // The anchor point IS the centroid at the start of rotation
            // We want to rotate around this fixed point
            const shapeCenterX = currentShape.x;
            const shapeCenterY = currentShape.y;
            const offsetX = shapeCenterX - anchorX;
            const offsetY = shapeCenterY - anchorY;
            
            // Rotate the offset by the rotation delta
            const rad = (deltaDegrees * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const rotatedOffsetX = offsetX * cos - offsetY * sin;
            const rotatedOffsetY = offsetX * sin + offsetY * cos;
            
            // New shape center maintains the anchor point
            const newCenterX = anchorX + rotatedOffsetX;
            const newCenterY = anchorY + rotatedOffsetY;
            
            // For polylines, we also need to adjust points to rotate around centroid
            // Points are stored relative to x,y, so we need to transform them
            if (initS.type === 'polyline') {
              const polyline = initS as PolylineShape;
              
              // Transform points: rotate around anchor (centroid), then translate to keep centroid at anchor
              // First, we need to find where the centroid is relative to the shape's origin
              // Calculate rotation values outside the map functions
              const polylineInitialRotation = initS.rotation || 0;
              const polylineNewRotation = (polylineInitialRotation + deltaDegrees) % 360;
              const currentRad = (polylineInitialRotation * Math.PI) / 180;
              const currentCos = Math.cos(currentRad);
              const currentSin = Math.sin(currentRad);
              const newRad = (polylineNewRotation * Math.PI) / 180;
              const newCos = Math.cos(-newRad);
              const newSin = Math.sin(-newRad);
              
              // Transform points: rotate around anchor (centroid)
              const newPoints = polyline.points.map(p => {
                // Point in world coords relative to shape origin (accounting for initial rotation)
                const rotatedPX = p.x * currentCos - p.y * currentSin;
                const rotatedPY = p.x * currentSin + p.y * currentCos;
                const worldX = initS.x + rotatedPX;
                const worldY = initS.y + rotatedPY;
                
                // Translate to anchor-relative coordinates (anchor is the centroid)
                const relToAnchorX = worldX - anchorX;
                const relToAnchorY = worldY - anchorY;
                
                // Rotate around anchor
                const rotatedRelX = relToAnchorX * cos - relToAnchorY * sin;
                const rotatedRelY = relToAnchorX * sin + relToAnchorY * cos;
                
                // Translate back: new world position
                const newWorldX = anchorX + rotatedRelX;
                const newWorldY = anchorY + rotatedRelY;
                
                // Convert back to local coordinates relative to new center (unrotated)
                const newRelX = newWorldX - newCenterX;
                const newRelY = newWorldY - newCenterY;
                
                // Unrotate to get local coordinates
                return {
                  x: newRelX * newCos - newRelY * newSin,
                  y: newRelX * newSin + newRelY * newCos
                };
              });
              
              // Transform holes the same way
              let newHoles: { x: number; y: number }[][] | undefined;
              if (polyline.holes && polyline.holes.length > 0) {
                newHoles = polyline.holes.map(hole =>
                  hole.map(p => {
                    const rotatedPX = p.x * currentCos - p.y * currentSin;
                    const rotatedPY = p.x * currentSin + p.y * currentCos;
                    const worldX = initS.x + rotatedPX;
                    const worldY = initS.y + rotatedPY;
                    const relToAnchorX = worldX - anchorX;
                    const relToAnchorY = worldY - anchorY;
                    const rotatedRelX = relToAnchorX * cos - relToAnchorY * sin;
                    const rotatedRelY = relToAnchorX * sin + relToAnchorY * cos;
                    const newWorldX = anchorX + rotatedRelX;
                    const newWorldY = anchorY + rotatedRelY;
                    const newRelX = newWorldX - newCenterX;
                    const newRelY = newWorldY - newCenterY;
                    return {
                      x: newRelX * newCos - newRelY * newSin,
                      y: newRelX * newSin + newRelY * newCos
                    };
                  })
                );
              }
              
              updateShape(id, {
                rotation: polylineNewRotation,
                x: newCenterX,
                y: newCenterY,
                points: newPoints,
                ...(newHoles && { holes: newHoles })
              });
            } else if (initS.type === 'group') {
              // If it's a group, rotate all children
              const group = initS as GroupShape;
              group.childrenIds.forEach((childId: string) => {
                const childInit = initialShapeState.current.get(childId);
                if (childInit) {
                  // Calculate child's offset from anchor
                  const childCurrent = currentShapesForRotation.find((s: Shape) => s.id === childId);
                  if (!childCurrent) return;
                  
                  const childOffsetX = childCurrent.x - anchorX;
                  const childOffsetY = childCurrent.y - anchorY;
                  const childRotatedOffsetX = childOffsetX * cos - childOffsetY * sin;
                  const childRotatedOffsetY = childOffsetX * sin + childOffsetY * cos;
                  
                  const initialRotation = childInit.rotation || 0;
                  const newRotation = (initialRotation + deltaDegrees) % 360;
                  updateShape(childId, { 
                    rotation: newRotation,
                    x: anchorX + childRotatedOffsetX,
                    y: anchorY + childRotatedOffsetY
                  });
                }
              });
              // Also update the group itself
              const initialRotation = initS.rotation || 0;
              const newRotation = (initialRotation + deltaDegrees) % 360;
              updateShape(id, { 
                rotation: newRotation,
                x: newCenterX,
                y: newCenterY
              });
            } else {
              // For other shape types, just rotate around anchor
              const initialRotation = initS.rotation || 0;
              const newRotation = (initialRotation + deltaDegrees) % 360;
              updateShape(id, { 
                rotation: newRotation,
                x: newCenterX,
                y: newCenterY
              });
            }
          }
        });
        return;
      }
      
      if (dragMode.current === 'resize' && resizeHandle.current) {
         // Use duplicated shape IDs if we're duplicating, otherwise use selected IDs
         const shapeIdsToResize = isDuplicating.current ? duplicatedShapeIds.current : selectedShapeIds;
         
         const initB = initialBounds.current;
         const anchor = anchorPoint.current;
         const handle = resizeHandle.current;
         
         // Check for modifiers
         const shiftKey = e.shiftKey; // Preserve aspect ratio
         const altKey = e.altKey; // Resize from center
         
         // Calculate current bounds from actual shapes to maintain continuity when shift is pressed
         let recalcMinX = Infinity, recalcMinY = Infinity, recalcMaxX = -Infinity, recalcMaxY = -Infinity;
         const currentShapes = useAppStore.getState().shapes;
         const shapesToCheck = currentShapes.filter((shape) => shapeIdsToResize.includes(shape.id));
         shapesToCheck.forEach((shape) => {
           const b = getShapeBounds(shape, currentShapes);
           recalcMinX = Math.min(recalcMinX, b.x);
           recalcMinY = Math.min(recalcMinY, b.y);
           recalcMaxX = Math.max(recalcMaxX, b.x + b.width);
           recalcMaxY = Math.max(recalcMaxY, b.y + b.height);
         });
         currentBounds.current = {
           x: Number.isFinite(recalcMinX) ? recalcMinX : initB.x,
           y: Number.isFinite(recalcMinY) ? recalcMinY : initB.y,
           width: Number.isFinite(recalcMaxX - recalcMinX) ? recalcMaxX - recalcMinX : initB.width,
           height: Number.isFinite(recalcMaxY - recalcMinY) ? recalcMaxY - recalcMinY : initB.height
         };
         
         // Determine anchor point (opposite handle, or center if Alt)
         // When shift is pressed, recalculate anchor from current bounds to maintain continuity
         const boundsForAnchor = shiftKey ? currentBounds.current : initB;
         let anchorX: number;
         let anchorY: number;
         if (altKey) {
           anchorX = boundsForAnchor.x + boundsForAnchor.width / 2;
           anchorY = boundsForAnchor.y + boundsForAnchor.height / 2;
         } else {
           // Use the original anchor point calculation but relative to current bounds if shift is pressed
           if (shiftKey) {
             // Recalculate anchor point from current bounds
             if (handle.includes('w')) anchorX = boundsForAnchor.x + boundsForAnchor.width; // East edge
             else if (handle.includes('e')) anchorX = boundsForAnchor.x; // West edge
             else anchorX = boundsForAnchor.x + boundsForAnchor.width / 2; // Center (for n/s only)
             
             if (handle.includes('n')) anchorY = boundsForAnchor.y + boundsForAnchor.height; // South edge
             else if (handle.includes('s')) anchorY = boundsForAnchor.y; // North edge
             else anchorY = boundsForAnchor.y + boundsForAnchor.height / 2; // Center (for e/w only)
           } else {
             // Use original anchor point
             anchorX = anchor.x;
             anchorY = anchor.y;
           }
         }
         
         // Apply snapping to mouse position (handle position)
         // Calculate a simple test bounds where the active handle is at the mouse position
         // This allows activeEdges to check the handle position from bounds
         const state = useAppStore.getState();
         
         // Calculate test bounds with handle at mouse position (simplified, just for snapping)
         let testBounds = { ...initB };
         if (handle.includes('e')) testBounds.width = Math.max(0.1, mouse.x - initB.x);
         else if (handle.includes('w')) {
           testBounds.width = Math.max(0.1, initB.x + initB.width - mouse.x);
           testBounds.x = mouse.x;
         }
         if (handle.includes('s')) testBounds.height = Math.max(0.1, mouse.y - initB.y);
         else if (handle.includes('n')) {
           testBounds.height = Math.max(0.1, initB.y + initB.height - mouse.y);
           testBounds.y = mouse.y;
         }
         
         // Get active edges based on the handle being dragged
         const activeEdges = getActiveEdgesFromHandle(resizeHandle.current);
         
         // Get snap result - activeEdges will check the active edge/corner coordinates from test bounds
         // Mouse position is passed as additionalPoints as fallback
         const snap = getNearestSnap(testBounds, state, shapeIdsToResize, activeEdges, 5, [
           { x: mouse.x, y: mouse.y } // Mouse position (handle position) only
         ]);
         setSnapGuides(snap.guides);
         
         // Apply snap deltas to the MOUSE POSITION only
         // This keeps the anchor point fixed while allowing the handle to snap
         const snappedMouseX = mouse.x + snap.deltaX;
         const snappedMouseY = mouse.y + snap.deltaY;
         
         // Recalculate bounds from fixed anchor point to snapped mouse position
         // This ensures the anchor stays fixed while the handle snaps
         const aspectRatio = initB.width / initB.height;
         
         // Use current bounds when shift is pressed to maintain continuity, otherwise use initial bounds
         const boundsForResize = shiftKey ? currentBounds.current : initB;
         let finalBounds = { ...boundsForResize };
         
         // Recalculate bounds based on snapped mouse position and fixed anchor
         if (shiftKey) {
           // When preserving aspect ratio, recalculate from anchor to snapped mouse
           // Use current bounds position to maintain continuity
           if (altKey) {
             // Resize from center
             const dx = snappedMouseX - anchorX;
             const dy = snappedMouseY - anchorY;
             if (handle.includes('e') || handle.includes('w')) {
               const halfWidth = Math.abs(dx);
               finalBounds.width = Math.max(0.1, halfWidth * 2);
               finalBounds.height = finalBounds.width / aspectRatio;
               finalBounds.x = anchorX - halfWidth;
               finalBounds.y = anchorY - finalBounds.height / 2;
             } else if (handle.includes('n') || handle.includes('s')) {
               const halfHeight = Math.abs(dy);
               finalBounds.height = Math.max(0.1, halfHeight * 2);
               finalBounds.width = finalBounds.height * aspectRatio;
               finalBounds.x = anchorX - finalBounds.width / 2;
               finalBounds.y = anchorY - halfHeight;
             } else {
               // Corner handle
               const halfWidth = Math.abs(dx);
               const halfHeight = Math.abs(dy);
               if (halfWidth > halfHeight) {
                 finalBounds.width = Math.max(0.1, halfWidth * 2);
                 finalBounds.height = finalBounds.width / aspectRatio;
               } else {
                 finalBounds.height = Math.max(0.1, halfHeight * 2);
                 finalBounds.width = finalBounds.height * aspectRatio;
               }
               finalBounds.x = anchorX - finalBounds.width / 2;
               finalBounds.y = anchorY - finalBounds.height / 2;
             }
           } else {
             // Resize from edge - maintain current edge position in perpendicular direction
             if (handle.includes('e') || handle.includes('w')) {
               let tempWidth = handle.includes('e') 
                 ? Math.max(0.1, snappedMouseX - anchorX)
                 : Math.max(0.1, anchorX - snappedMouseX);
               finalBounds.width = tempWidth;
               finalBounds.height = tempWidth / aspectRatio;
               finalBounds.x = handle.includes('e') ? anchorX : anchorX - tempWidth;
               // Maintain current Y position, don't center
               finalBounds.y = boundsForResize.y;
             } else if (handle.includes('n') || handle.includes('s')) {
               let tempHeight = handle.includes('s')
                 ? Math.max(0.1, snappedMouseY - anchorY)
                 : Math.max(0.1, anchorY - snappedMouseY);
               finalBounds.height = tempHeight;
               finalBounds.width = tempHeight * aspectRatio;
               // Maintain current X position, don't center
               finalBounds.x = boundsForResize.x;
               finalBounds.y = handle.includes('s') ? anchorY : anchorY - tempHeight;
             } else {
               // Corner handle
               let tempWidth = handle.includes('e')
                 ? Math.max(0.1, snappedMouseX - anchorX)
                 : handle.includes('w')
                 ? Math.max(0.1, anchorX - snappedMouseX)
                 : boundsForResize.width;
               let tempHeight = handle.includes('s')
                 ? Math.max(0.1, snappedMouseY - anchorY)
                 : handle.includes('n')
                 ? Math.max(0.1, anchorY - snappedMouseY)
                 : boundsForResize.height;
               const widthChange = Math.abs(tempWidth - boundsForResize.width);
               const heightChange = Math.abs(tempHeight - boundsForResize.height);
               if (widthChange > heightChange) {
                 finalBounds.width = tempWidth;
                 finalBounds.height = tempWidth / aspectRatio;
               } else {
                 finalBounds.height = tempHeight;
                 finalBounds.width = tempHeight * aspectRatio;
               }
               finalBounds.x = handle.includes('e') ? anchorX : anchorX - finalBounds.width;
               finalBounds.y = handle.includes('s') ? anchorY : anchorY - finalBounds.height;
             }
           }
         } else {
           // Normal resizing without aspect ratio preservation
           if (altKey) {
             // Resize from center: distance from center determines half-dimension
             if (handle.includes('e') || handle.includes('w')) {
               const halfWidth = Math.abs(snappedMouseX - anchorX);
               finalBounds.width = Math.max(0.1, halfWidth * 2);
               finalBounds.x = anchorX - halfWidth;
             }
             if (handle.includes('s') || handle.includes('n')) {
               const halfHeight = Math.abs(snappedMouseY - anchorY);
               finalBounds.height = Math.max(0.1, halfHeight * 2);
               finalBounds.y = anchorY - halfHeight;
             }
           } else {
             // Resize from edge: normal calculation from fixed anchor to snapped mouse
             if (handle.includes('e')) {
               finalBounds.width = Math.max(0.1, snappedMouseX - anchorX);
               finalBounds.x = anchorX;
             } else if (handle.includes('w')) {
               finalBounds.width = Math.max(0.1, anchorX - snappedMouseX);
               finalBounds.x = anchorX - finalBounds.width;
             }
             
             if (handle.includes('s')) {
               finalBounds.height = Math.max(0.1, snappedMouseY - anchorY);
               finalBounds.y = anchorY;
             } else if (handle.includes('n')) {
               finalBounds.height = Math.max(0.1, anchorY - snappedMouseY);
               finalBounds.y = anchorY - finalBounds.height;
             }
           }
         }
         
         // Ensure minimum dimensions
         finalBounds.width = Math.max(0.1, finalBounds.width);
         finalBounds.height = Math.max(0.1, finalBounds.height);
         
         // Use finalBounds for scale factors and position
         // This ensures snaps are preserved exactly
         const sx = initB.width > 0 ? finalBounds.width / initB.width : 1;
         const sy = initB.height > 0 ? finalBounds.height / initB.height : 1;
         
         initialShapeState.current.forEach((initS, id) => {
            if (!shapeIdsToResize.includes(id)) return;
            
            // Get initial bounds of this shape
            const allShapesArray = Array.from(initialShapeState.current.values());
            const initShapeBounds = getShapeBounds(initS, allShapesArray);
            
            // Calculate relative position from initial selection bounds
            const relX = initShapeBounds.x - initB.x;
            const relY = initShapeBounds.y - initB.y;
            const relWidth = initShapeBounds.width;
            const relHeight = initShapeBounds.height;
            
            // Calculate new bounds using finalBounds as the base
            // This preserves the snap adjustment
            const newShapeBoundsX = finalBounds.x + relX * sx;
            const newShapeBoundsY = finalBounds.y + relY * sy;
            const newShapeBoundsWidth = relWidth * sx;
            const newShapeBoundsHeight = relHeight * sy;
            
            // Handle groups - resize all children
            if (initS.type === 'group') {
              const group = initS as GroupShape;
              group.childrenIds.forEach((childId: string) => {
                const childInit = initialShapeState.current.get(childId);
                if (childInit) {
                  const childBounds = getShapeBounds(childInit, allShapesArray);
                  const childRelX = childBounds.x - initB.x;
                  const childRelY = childBounds.y - initB.y;
                  const childRelWidth = childBounds.width;
                  const childRelHeight = childBounds.height;
                  
                  const newChildBoundsX = finalBounds.x + childRelX * sx;
                  const newChildBoundsY = finalBounds.y + childRelY * sy;
                  const newChildBoundsWidth = childRelWidth * sx;
                  const newChildBoundsHeight = childRelHeight * sy;
                  
                  // Apply same transformation logic as individual shapes
                  const childUpdates: any = {};
                  
                  if (childInit.type === 'rectangle') {
                    const newCenterX = newChildBoundsX + newChildBoundsWidth / 2;
                    const newCenterY = newChildBoundsY + newChildBoundsHeight / 2;
                    childUpdates.x = newCenterX;
                    childUpdates.y = newCenterY;
                    childUpdates.width = Math.max(0.1, (childInit as any).width * sx);
                    childUpdates.height = Math.max(0.1, (childInit as any).height * sy);
                  } else if (childInit.type === 'ellipse') {
                    const newCenterX = newChildBoundsX + newChildBoundsWidth / 2;
                    const newCenterY = newChildBoundsY + newChildBoundsHeight / 2;
                    childUpdates.x = newCenterX;
                    childUpdates.y = newCenterY;
                    childUpdates.radiusX = Math.max(0.1, (childInit as any).radiusX * sx);
                    childUpdates.radiusY = Math.max(0.1, (childInit as any).radiusY * sy);
                  } else if (childInit.type === 'polyline') {
                    const ps = childInit as PolylineShape;
                    const newChildX = newChildBoundsX;
                    const newChildY = newChildBoundsY;
                    
                    // Transform each point relative to initial selection bounds
                    childUpdates.points = ps.points.map(p => {
                      const worldX = childInit.x + p.x;
                      const worldY = childInit.y + p.y;
                      const relWorldX = worldX - initB.x;
                      const relWorldY = worldY - initB.y;
                      const transformedX = finalBounds.x + relWorldX * sx;
                      const transformedY = finalBounds.y + relWorldY * sy;
                      return {
                        x: transformedX - newChildX,
                        y: transformedY - newChildY
                      };
                    });
                    
                    childUpdates.x = newChildX;
                    childUpdates.y = newChildY;
                    
                    if (ps.holes) {
                      childUpdates.holes = ps.holes.map(h => h.map(p => {
                        const worldX = childInit.x + p.x;
                        const worldY = childInit.y + p.y;
                        const relWorldX = worldX - initB.x;
                        const relWorldY = worldY - initB.y;
                        const transformedX = finalBounds.x + relWorldX * sx;
                        const transformedY = finalBounds.y + relWorldY * sy;
                        return {
                          x: transformedX - newChildX,
                          y: transformedY - newChildY
                        };
                      }));
                    }
                  } else if (childInit.type === 'polygon') {
                    const newCenterX = newChildBoundsX + newChildBoundsWidth / 2;
                    const newCenterY = newChildBoundsY + newChildBoundsHeight / 2;
                    childUpdates.x = newCenterX;
                    childUpdates.y = newCenterY;
                    childUpdates.radius = Math.max(0.1, (childInit as any).radius * Math.min(sx, sy));
                  } else if (childInit.type === 'line') {
                    const newCenterX = newChildBoundsX + newChildBoundsWidth / 2;
                    const newCenterY = newChildBoundsY + newChildBoundsHeight / 2;
                    childUpdates.x = newCenterX;
                    childUpdates.y = newCenterY;
                    childUpdates.width = Math.max(0.1, (childInit as any).width * Math.hypot(sx, sy));
                  }
                  
                  updateShape(childId, childUpdates);
                }
              });
              // Update group bounds using finalBounds as reference
              const newGroupCenterX = finalBounds.x + (initShapeBounds.x - initB.x + initShapeBounds.width / 2) * sx;
              const newGroupCenterY = finalBounds.y + (initShapeBounds.y - initB.y + initShapeBounds.height / 2) * sy;
              updateShape(id, { 
                x: newGroupCenterX, 
                y: newGroupCenterY, 
                width: initShapeBounds.width * sx, 
                height: initShapeBounds.height * sy 
              });
              return; // Skip normal shape processing for groups
            }
            
            // Convert bounds back to shape-specific properties
            const updates: any = {};
            
            if (initS.type === 'rectangle') {
               // Rectangle: x,y is center, width/height are dimensions
               const newCenterX = newShapeBoundsX + newShapeBoundsWidth / 2;
               const newCenterY = newShapeBoundsY + newShapeBoundsHeight / 2;
               
               updates.x = newCenterX;
               updates.y = newCenterY;
               updates.width = Math.max(0.1, (initS as any).width * sx);
               updates.height = Math.max(0.1, (initS as any).height * sy);
            } else if (initS.type === 'ellipse') {
               // Ellipse: x,y is center, radiusX/radiusY are radii
               const newCenterX = newShapeBoundsX + newShapeBoundsWidth / 2;
               const newCenterY = newShapeBoundsY + newShapeBoundsHeight / 2;
               
               updates.x = newCenterX;
               updates.y = newCenterY;
               updates.radiusX = Math.max(0.1, (initS as any).radiusX * sx);
               updates.radiusY = Math.max(0.1, (initS as any).radiusY * sy);
            } else if (initS.type === 'polyline') {
               // Polyline: x,y is position, points are offsets
               const ps = initS as PolylineShape;
               
               // CRITICAL FIX for unioned shapes: The shape's x,y might not match the bounds origin
               // We need to ensure we're transforming based on actual geometry, not shape position
               
               // Calculate the new x,y position (bounds origin)
               const newX = newShapeBoundsX;
               const newY = newShapeBoundsY;
               
               // Transform each point relative to initial selection bounds
               // Points are stored as offsets from x,y, so world coords = x + p.x, y + p.y
               // For unioned shapes, points might already be in world coordinates (x=0,y=0 case)
               updates.points = ps.points.map(p => {
                  // Convert to world coordinates using the shape's current x,y
                  const worldX = initS.x + p.x;
                  const worldY = initS.y + p.y;
                  
                  // Transform relative to initial selection bounds, scale, then transform to final bounds
                  // Use initB (initial selection bounds) as the reference, not initShapeBounds
                  // This ensures consistent transformation even if shape x,y != bounds origin
                  const relWorldX = worldX - initB.x;
                  const relWorldY = worldY - initB.y;
                  const transformedX = finalBounds.x + relWorldX * sx;
                  const transformedY = finalBounds.y + relWorldY * sy;
                  
                  // Convert back to offset coordinates relative to new bounds origin
                  return {
                     x: transformedX - newX,
                     y: transformedY - newY
                  };
               });
               
               // Update position to the new bounds origin
               updates.x = newX;
               updates.y = newY;
               
               // Transform holes the same way
               if (ps.holes) {
                  updates.holes = ps.holes.map(h => h.map(p => {
                     const worldX = initS.x + p.x;
                     const worldY = initS.y + p.y;
                     const relWorldX = worldX - initB.x;
                     const relWorldY = worldY - initB.y;
                     const transformedX = finalBounds.x + relWorldX * sx;
                     const transformedY = finalBounds.y + relWorldY * sy;
                     return {
                        x: transformedX - newX,
                        y: transformedY - newY
                     };
                  }));
               }
            } else if (initS.type === 'polygon') {
               // Polygon: x,y is center, radius is radius
               const newCenterX = newShapeBoundsX + newShapeBoundsWidth / 2;
               const newCenterY = newShapeBoundsY + newShapeBoundsHeight / 2;
               
               updates.x = newCenterX;
               updates.y = newCenterY;
               updates.radius = Math.max(0.1, (initS as any).radius * Math.min(sx, sy));
            } else if (initS.type === 'line') {
               // Line: x,y is center, width is length
               const newCenterX = newShapeBoundsX + newShapeBoundsWidth / 2;
               const newCenterY = newShapeBoundsY + newShapeBoundsHeight / 2;
               
               updates.x = newCenterX;
               updates.y = newCenterY;
               updates.width = Math.max(0.1, (initS as any).width * Math.hypot(sx, sy));
            }
            updateShape(id, updates);
         });
      }
    };

    const handleMouseUp = () => { 
      if(isDragging) useAppStore.getState().commitState(); 
      setIsDragging(false);
      setSnapGuides([]);
      // Reset duplication state
      isDuplicating.current = false;
      duplicatedShapeIds.current = [];
      // Reset constraint axis
      constraintAxis.current = null;
      lockedDelta.current = null;
      // Reset initial rotation angle
      initialRotationAngle.current = 0;
    };
    window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging, containerRef, paper, viewTransform]);

  if (tool === 'direct_select' || !hasSelection || bounds.width <= 0) return null;

  const b = bounds;
  const Handle = ({ x, y, cur, name }: any) => (
    <rect x={x-3} y={y-3} width={6} height={6} fill="#0066ff" stroke="white" strokeWidth="1" style={{cursor: cur}} onMouseDown={(e) => handleStart(e, 'resize', name)} />
  );
  
  const RotateHandle = ({ x, y }: { x: number; y: number }) => {
    const handleSize = 8;
    const handleOffset = 20; // Distance from top edge
    const handleY = y - handleOffset;
    
    return (
      <g>
        {/* Line connecting handle to top center */}
        <line 
          x1={x} 
          y1={y} 
          x2={x} 
          y2={handleY} 
          stroke="#0066ff" 
          strokeWidth="0.5" 
          strokeDasharray="2,2"
        />
        {/* Rotate handle circle */}
        <circle 
          cx={x} 
          cy={handleY} 
          r={handleSize/2} 
          fill="#0066ff" 
          stroke="white" 
          strokeWidth="1.5" 
          style={{cursor: 'grab'}} 
          onMouseDown={(e) => handleStart(e, 'rotate')}
        />
      </g>
    );
  };

  // Render snap guides
  const snapGuideElements: JSX.Element[] = snapGuides.map((guide, idx) => {
    // Green for margins and centers, pink for other bounds
    // Explicitly check for true values to handle undefined cases
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
        />
      );
    }
  });

  return (
    <g>
       <rect x={b.x} y={b.y} width={b.width} height={b.height} fill="none" stroke="#0066ff" strokeWidth="0.5" strokeDasharray="4,2" onMouseDown={(e) => handleStart(e, 'move')} style={{cursor: 'move'}} />
       
       {/* Snap guides */}
       {snapGuideElements}
       
       <Handle x={b.x} y={b.y} cur="nw-resize" name="nw" />
       <Handle x={b.x+b.width} y={b.y} cur="ne-resize" name="ne" />
       <Handle x={b.x+b.width} y={b.y+b.height} cur="se-resize" name="se" />
       <Handle x={b.x} y={b.y+b.height} cur="sw-resize" name="sw" />
       
       <Handle x={b.x+b.width/2} y={b.y} cur="n-resize" name="n" />
       <Handle x={b.x+b.width/2} y={b.y+b.height} cur="s-resize" name="s" />
       <Handle x={b.x} y={b.y+b.height/2} cur="w-resize" name="w" />
       <Handle x={b.x+b.width} y={b.y+b.height/2} cur="e-resize" name="e" />
       
       {/* Rotate handle - sticking out from top center */}
       <RotateHandle x={b.x + b.width/2} y={b.y} />
    </g>
  );
}
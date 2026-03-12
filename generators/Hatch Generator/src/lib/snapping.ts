import type { ProjectState, Shape, GroupShape, PolylineShape } from '../types';
import { getShapeBounds, getShapeVertices } from './geometry';

export interface SnapGuide { type: 'vertical' | 'horizontal'; offset: number; isMargin?: boolean; isCenter?: boolean; }
export interface SnapResult { x: number; y: number; deltaX: number; deltaY: number; guides: SnapGuide[]; }

export interface ActiveEdges {
  left?: boolean;
  right?: boolean;
  top?: boolean;
  bottom?: boolean;
  corners?: string[]; // e.g., ['nw', 'ne', 'sw', 'se']
}

/**
 * Recursively collects all vertices from a shape, including children of groups and holes in polylines
 */
function getAllVertices(shape: Shape, allShapes: Shape[]): { x: number; y: number }[] {
  if (shape.type === 'group') {
    const group = shape as GroupShape;
    const vertices: { x: number; y: number }[] = [];
    group.childrenIds.forEach((childId: string) => {
      const child = allShapes.find(s => s.id === childId);
      if (child) {
        vertices.push(...getAllVertices(child, allShapes));
      }
    });
    return vertices;
  }
  
  const vertices = getShapeVertices(shape);
  
  // Also include hole vertices for polylines
  if (shape.type === 'polyline') {
    const polyline = shape as PolylineShape;
    if (polyline.holes && polyline.holes.length > 0) {
      // Holes are stored relative to the shape center (unrotated)
      const rad = (polyline.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      polyline.holes.forEach(hole => {
        hole.forEach(point => {
          // Convert to world coordinates (rotated)
          const worldPoint = {
            x: polyline.x + point.x * cos - point.y * sin,
            y: polyline.y + point.y * cos + point.x * sin
          };
          vertices.push(worldPoint);
        });
      });
    }
  }
  
  return vertices;
}

export function getNearestSnap(
  currentBounds: { x: number; y: number; width: number; height: number },
  state: ProjectState,
  excludeShapeIds: string[] = [],
  activeEdges?: ActiveEdges,
  threshold: number = 5,
  additionalPoints?: Array<{ x: number; y: number }>
): SnapResult {
  const { snapping, shapes, paper } = state;
  let deltaX = 0, deltaY = 0;
  let minDiffX = threshold, minDiffY = threshold;
  let snappedTargetX: number | null = null; // Track which target value we snapped to for X
  let snappedTargetY: number | null = null; // Track which target value we snapped to for Y
  const guides: SnapGuide[] = [];

  // Collect all snap targets, tracking which are margins and which are centers
  const targetsX: Array<{ value: number; isMargin: boolean; isCenter: boolean }> = [];
  const targetsY: Array<{ value: number; isMargin: boolean; isCenter: boolean }> = [];

  // Paper margins are ALWAYS available as snap targets (important reference lines)
  // They should always be checked regardless of snapping settings
  targetsX.push(
    { value: paper.margin, isMargin: true, isCenter: false },
    { value: paper.width - paper.margin, isMargin: true, isCenter: false }
  );
  targetsY.push(
    { value: paper.margin, isMargin: true, isCenter: false },
    { value: paper.height - paper.margin, isMargin: true, isCenter: false }
  );
  
  // Add paper center lines (always available when centers snapping is enabled)
  if (snapping.centers) {
    targetsX.push({ value: paper.width / 2, isMargin: false, isCenter: true });
    targetsY.push({ value: paper.height / 2, isMargin: false, isCenter: true });
  }

  // Add other shapes' actual vertices and edges
  shapes.forEach(shape => {
    if (excludeShapeIds.includes(shape.id)) return;
    
    // Get all actual vertices from the shape (including children for groups)
    const vertices = getAllVertices(shape, shapes);
    
    // Add all vertex coordinates as snap targets
    vertices.forEach(vertex => {
      targetsX.push({ value: vertex.x, isMargin: false, isCenter: false });
      targetsY.push({ value: vertex.y, isMargin: false, isCenter: false });
    });
    
    // Also add bounding box edges for additional snapping options
    const bounds = getShapeBounds(shape, shapes);
    if (snapping.bounds) {
      targetsX.push(
        { value: bounds.x, isMargin: false, isCenter: false },
        { value: bounds.x + bounds.width, isMargin: false, isCenter: false }
      );
      targetsY.push(
        { value: bounds.y, isMargin: false, isCenter: false },
        { value: bounds.y + bounds.height, isMargin: false, isCenter: false }
      );
    }
    
    // Add centers
    if (snapping.centers) {
      targetsX.push({ value: bounds.x + bounds.width / 2, isMargin: false, isCenter: true });
      targetsY.push({ value: bounds.y + bounds.height / 2, isMargin: false, isCenter: true });
    }
  });

  // Check current bounds against all targets
  // Simple functions: find closest target within threshold
  const checkX = (val: number) => {
    targetsX.forEach(t => {
      const diff = t.value - val;
      if (Math.abs(diff) < minDiffX) {
        minDiffX = Math.abs(diff);
        deltaX = diff;
        snappedTargetX = t.value; // Track which target we're snapping to
        
        // Find existing guide or add new one
        const existingGuide = guides.find(g => g.type === 'vertical' && Math.abs(g.offset - t.value) < 0.01);
        if (existingGuide) {
          // Update existing guide to mark as margin or center if this target is margin/center
          if (t.isMargin) {
            existingGuide.isMargin = true;
          }
          if (t.isCenter) {
            existingGuide.isCenter = true;
          }
        } else {
          guides.push({ type: 'vertical', offset: t.value, isMargin: t.isMargin, isCenter: t.isCenter });
        }
      }
    });
  };

  const checkY = (val: number) => {
    targetsY.forEach(t => {
      const diff = t.value - val;
      if (Math.abs(diff) < minDiffY) {
        minDiffY = Math.abs(diff);
        deltaY = diff;
        snappedTargetY = t.value; // Track which target we're snapping to
        
        // Find existing guide or add new one
        const existingGuide = guides.find(g => g.type === 'horizontal' && Math.abs(g.offset - t.value) < 0.01);
        if (existingGuide) {
          // Update existing guide to mark as margin or center if this target is margin/center
          if (t.isMargin) {
            existingGuide.isMargin = true;
          }
          if (t.isCenter) {
            existingGuide.isCenter = true;
          }
        } else {
          guides.push({ type: 'horizontal', offset: t.value, isMargin: t.isMargin, isCenter: t.isCenter });
        }
      }
    });
  };

  // Check relevant points based on operation type
  // Priority: active edges first (if provided), then additional points
  const { x, y, width, height } = currentBounds;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  
  if (activeEdges) {
    // Resize operation: check active edge/corner coordinates from bounds first
    const { left, right, top, bottom, corners } = activeEdges;
    
    // Check corners if specified
    if (corners) {
      if (corners.includes('nw')) {
        checkX(x); // Top-left X
        checkY(y); // Top-left Y
      }
      if (corners.includes('ne')) {
        checkX(x + width); // Top-right X
        checkY(y); // Top-right Y
      }
      if (corners.includes('sw')) {
        checkX(x); // Bottom-left X
        checkY(y + height); // Bottom-left Y
      }
      if (corners.includes('se')) {
        checkX(x + width); // Bottom-right X
        checkY(y + height); // Bottom-right Y
      }
    }
    
    // Check active edges
    if (left) {
      checkX(x); // Left edge
    }
    if (right) {
      checkX(x + width); // Right edge
    }
    if (top) {
      checkY(y); // Top edge
    }
    if (bottom) {
      checkY(y + height); // Bottom edge
    }
  } else {
    // Move operation: check all corners, midpoints, and center
    // Top-left corner
    checkX(x);
    checkY(y);
    // Top-right corner
    checkX(x + width);
    checkY(y);
    // Bottom-left corner
    checkX(x);
    checkY(y + height);
    // Bottom-right corner
    checkX(x + width);
    checkY(y + height);
    
    // Check all edge midpoints
    checkX(centerX);
    checkY(y); // Top edge midpoint
    checkX(centerX);
    checkY(y + height); // Bottom edge midpoint
    checkX(x + width);
    checkY(centerY); // Right edge midpoint
    checkX(x);
    checkY(centerY); // Left edge midpoint
    
    // Check center point
    checkX(centerX);
    checkY(centerY);
  }
  
  // Check additional points (like mouse position during resize/creation) as fallback
  // These are checked after active edges/bounds points, so they only apply if no better snap was found
  if (additionalPoints && additionalPoints.length > 0) {
    additionalPoints.forEach(point => {
      checkX(point.x);
      checkY(point.y);
    });
  }

  // After all checks, ensure guides are properly marked as margin or center if any target with that offset matches
  // This handles cases where multiple targets share the same offset value or where the guide was created
  // from a non-margin/center target but a margin/center target exists at the same offset
  // Also directly check against paper center and margin values for reliability
  const paperCenterX = paper.width / 2;
  const paperCenterY = paper.height / 2;
  const marginLeft = paper.margin;
  const marginRight = paper.width - paper.margin;
  const marginTop = paper.margin;
  const marginBottom = paper.height - paper.margin;
  
  guides.forEach(guide => {
    if (guide.type === 'vertical') {
      // Direct check against paper center
      if (snapping.centers && Math.abs(guide.offset - paperCenterX) < 0.1) {
        guide.isCenter = true;
      }
      // Direct check against paper margins
      if (Math.abs(guide.offset - marginLeft) < 0.1 || Math.abs(guide.offset - marginRight) < 0.1) {
        guide.isMargin = true;
      }
      // Check all center targets to see if any match this guide's offset
      const centerTargets = targetsX.filter(t => t.isCenter);
      const matchingCenter = centerTargets.find(t => {
        const diff = Math.abs(t.value - guide.offset);
        return diff < 0.1; // More lenient tolerance
      });
      if (matchingCenter) {
        guide.isCenter = true;
      }
      // Check all margin targets to see if any match this guide's offset
      const marginTargets = targetsX.filter(t => t.isMargin);
      const matchingMargin = marginTargets.find(t => {
        const diff = Math.abs(t.value - guide.offset);
        return diff < 0.1; // More lenient tolerance
      });
      if (matchingMargin) {
        guide.isMargin = true;
      }
    } else {
      // Direct check against paper center
      if (snapping.centers && Math.abs(guide.offset - paperCenterY) < 0.1) {
        guide.isCenter = true;
      }
      // Direct check against paper margins
      if (Math.abs(guide.offset - marginTop) < 0.1 || Math.abs(guide.offset - marginBottom) < 0.1) {
        guide.isMargin = true;
      }
      // Check all center targets to see if any match this guide's offset
      const centerTargets = targetsY.filter(t => t.isCenter);
      const matchingCenter = centerTargets.find(t => {
        const diff = Math.abs(t.value - guide.offset);
        return diff < 0.1; // More lenient tolerance
      });
      if (matchingCenter) {
        guide.isCenter = true;
      }
      // Check all margin targets to see if any match this guide's offset
      const marginTargets = targetsY.filter(t => t.isMargin);
      const matchingMargin = marginTargets.find(t => {
        const diff = Math.abs(t.value - guide.offset);
        return diff < 0.1; // More lenient tolerance
      });
      if (matchingMargin) {
        guide.isMargin = true;
      }
    }
  });

  // Return the most relevant guides: one vertical and one horizontal (if snaps were found)
  // Use the tracked target values to find the exact guides that correspond to our snaps
  const finalGuides: SnapGuide[] = [];
  
  // Include a vertical guide if we have a deltaX snap
  if (Math.abs(deltaX) < threshold && deltaX !== 0 && snappedTargetX !== null) {
    // Find the guide that matches the exact target we snapped to
    const matchingGuide = guides.find(g => 
      g.type === 'vertical' && Math.abs(g.offset - snappedTargetX!) < 0.01
    );
    if (matchingGuide) {
      finalGuides.push(matchingGuide);
    }
  }
  
  // Include a horizontal guide if we have a deltaY snap
  if (Math.abs(deltaY) < threshold && deltaY !== 0 && snappedTargetY !== null) {
    // Find the guide that matches the exact target we snapped to
    const matchingGuide = guides.find(g => 
      g.type === 'horizontal' && Math.abs(g.offset - snappedTargetY!) < 0.01
    );
    if (matchingGuide) {
      finalGuides.push(matchingGuide);
    }
  }

  // Return the relevant guides (up to 2: one per axis) - these exactly match the snaps we're applying
  return { x: 0, y: 0, deltaX, deltaY, guides: finalGuides };
}
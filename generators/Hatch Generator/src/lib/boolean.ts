import type { Shape } from '../types';
import { getShapeVertices } from './geometry';
import paper from 'paper';

let isPaperInitialized = false;

function initPaper() {
  if (isPaperInitialized) return true;
  try {
    if (!paper.project) {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1000;
      paper.setup(canvas);
    } else {
      paper.project.clear();
    }
    isPaperInitialized = true;
    return true;
  } catch (e) {
    console.error("Paper.js failed to initialize:", e);
    return false;
  }
}

// RULE 4: Use Type Guards instead of assertions
function isPathItem(item: paper.Item | null): item is paper.PathItem {
  return item !== null && (item instanceof paper.Path || item instanceof paper.CompoundPath);
}

function isPath(item: paper.Item): item is paper.Path {
  return item instanceof paper.Path;
}

function isCompoundPath(item: paper.Item): item is paper.CompoundPath {
  return item instanceof paper.CompoundPath;
}

function isGroup(item: paper.Item): item is paper.Group {
  return item instanceof paper.Group;
}

export function computeBooleanOperation(
  shapes: Shape[], 
  op: 'union' | 'subtract' | 'intersect' | 'exclude'
): { points: {x:number, y:number}[], holes: {x:number, y:number}[][] }[] {
  
  if (shapes.length < 2 || !initPaper()) return [];

  // 1. Clear Context
  paper.project.activeLayer.removeChildren();

  try {
    // 2. Convert Shapes to Paper Paths
    const items = shapes.map(s => {
       const v = getShapeVertices(s);
       const p = new paper.Path();
       v.forEach((pt) => p.add(new paper.Point(pt.x, pt.y)));
       p.closed = true;
       return p;
    });

    // 3. Perform Operation
    let result: paper.Item | null = items[0];
    
    for (let i = 1; i < items.length; i++) {
       const next = items[i];
       const prev: paper.Item | null = result;
       
       // RULE 5 & 6: Always handle null returns
       if (!prev) {
          if (op === 'union') {
             result = next;
             continue;
          } else {
             next.remove(); 
             continue;
          }
       }

       if (isPathItem(prev) && isPathItem(next)) {
          let newResult: paper.Item | null = null;
          
          if (op === 'union') newResult = prev.unite(next);
          else if (op === 'subtract') newResult = prev.subtract(next);
          else if (op === 'intersect') newResult = prev.intersect(next);
          else if (op === 'exclude') newResult = prev.exclude(next);
          
          if (prev !== newResult && prev !== items[0]) prev.remove();
          next.remove(); 
          
          result = newResult;
       } else {
          next.remove();
       }
    }
    
    if (items[0] !== result && items[0].parent) items[0].remove();

    if (!result) return [];

    // 4. Extract Geometry (Strictly Typed)
    const output: { points: {x:number, y:number}[], holes: {x:number, y:number}[][] }[] = [];

    const processItem = (item: paper.Item) => {
       // RULE 7: Handle all return types
       if (isCompoundPath(item)) {
          // RULE 8: Safe Child Filtering (no casting)
          const children = item.children.filter(isPath).sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
          
          if (children.length > 0) {
             const body = children[0];
             body.flatten(0.5); 
             
             const points = body.segments.map(s => ({ x: s.point.x, y: s.point.y }));
             const holes = children.slice(1).map(h => {
                h.flatten(0.5);
                return h.segments.map(s => ({ x: s.point.x, y: s.point.y }));
             });
             
             output.push({ points, holes });
          }
       } 
       else if (isPath(item)) {
          item.flatten(0.5);
          output.push({
             points: item.segments.map(s => ({ x: s.point.x, y: s.point.y })),
             holes: []
          });
       } 
       else if (isGroup(item)) {
          item.children.forEach(child => processItem(child));
       }
    };

    processItem(result);
    result.remove();

    return output;

  } catch (e) {
    console.error("Boolean Operation Error:", e);
    return [];
  }
}
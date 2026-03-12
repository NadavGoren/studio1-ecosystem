import { create } from 'zustand';
import { PAPER_PRESETS, type ProjectState, type StateSnapshot, type Shape, type PaperSettings, type HatchParams, type PaperPreset, type PaperOrientation, type GroupShape, type SavedProject, type EyedropperMode, type ViewTransform, type PolylineShape } from '../types';
import { getShapeBounds } from '../lib/geometry';
import { computeBooleanOperation } from '../lib/boolean';
import { generateThumbnail } from '../lib/thumbnail';

const STORAGE_KEY = 'hatchstudio-saved-projects';

// --- INTERNAL CLIPBOARD (In-memory) ---
let internalClipboard: Shape[] = [];

// --- HELPER: Clone Shapes ---
// Returns [duplicatedShapes, idMap, topLevelDuplicateIds]
const cloneShapes = (shapes: Shape[], allShapes: Shape[], offsetX: number = 10, offsetY: number = 10): [Shape[], Map<string, string>, string[]] => {
  const idMap = new Map<string, string>();
  const shapeMap = new Map(allShapes.map(s => [s.id, s]));
  
  // First pass: Create ID mappings for all selected shapes and their children (recursively)
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
  
  shapes.forEach(collectChildren);
  
  // Second pass: Actually duplicate all shapes (children first, then top-level)
  const duplicatedShapes: Shape[] = [];
  const processed = new Set<string>();
  const topLevelDuplicateIds: string[] = [];
  
  // Function to duplicate a single shape
  const duplicateShape = (original: Shape): void => {
    if (processed.has(original.id)) {
      return; // Already processed
    }
    
    const newId = idMap.get(original.id);
    if (!newId) {
      return; // This shape is not part of the duplication set
    }
    
    processed.add(original.id);
    const newShape = JSON.parse(JSON.stringify(original)); // Deep clone
    newShape.id = newId;
    newShape.x = original.x + offsetX;
    newShape.y = original.y + offsetY;
    
    // Handle groupId references
    if (newShape.groupId && idMap.has(newShape.groupId)) {
      newShape.groupId = idMap.get(newShape.groupId);
    } else if (newShape.groupId) {
      // If groupId is not in the selection, detach from group
      delete newShape.groupId;
    }
    
    // Handle groups: remap childrenIds and ensure children are duplicated first
    if (newShape.type === 'group') {
      const g = newShape as GroupShape;
      const newChildrenIds: string[] = [];
      
      // Duplicate all children first (recursively)
      g.childrenIds.forEach((childId: string) => {
        const child = shapeMap.get(childId);
        if (child && idMap.has(childId)) {
          duplicateShape(child); // Recursively duplicate child
          newChildrenIds.push(idMap.get(childId)!);
        }
      });
      
      g.childrenIds = newChildrenIds;
    }
    
    duplicatedShapes.push(newShape);
  };
  
  // Duplicate all shapes (children will be duplicated recursively when processing groups)
  shapes.forEach(shape => {
    duplicateShape(shape);
    const newId = idMap.get(shape.id);
    if (newId) {
      topLevelDuplicateIds.push(newId);
    }
  });
  
  return [duplicatedShapes, idMap, topLevelDuplicateIds];
};

const initialSnapshot: StateSnapshot = {
    paper: { preset: 'A3', orientation: 'portrait', width: 297, height: 420, margin: 20, globalStrokeWidth: 0.4, globalColorOverride: false, globalColor: '#000000', canvasColor: '#ffffff' },
    shapes: [], 
    selectedShapeIds: [],
    viewTransform: { centerX: 148.5, centerY: 210, scale: 1 },
    hatchParams: {}, 
    tool: 'select', 
    snapping: { grid: false, centers: true, bounds: true, gridSize: 10 }
};

interface AppState extends ProjectState {
  setPaper: (paper: Partial<PaperSettings>) => void;
  setPaperPreset: (preset: PaperPreset) => void;
  setPaperOrientation: (orientation: PaperOrientation) => void;
  setPaperMargin: (margin: number) => void;
  setPaperSize: (width: number, height: number) => void;
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  deleteShapes: (ids: string[]) => void;
  selectShape: (id: string) => void;
  selectShapes: (ids: string[]) => void;
  deselectAll: () => void;
  toggleSelection: (id: string) => void;
  setViewTransform: (transform: Partial<ViewTransform>) => void;
  resetView: () => void;
  zoomToFit: () => void;
  setZoom: (scale: number) => void;
  setHatchParams: (shapeId: string, params: Partial<HatchParams>) => void;
  setHatchParamsSilent: (shapeId: string, params: Partial<HatchParams>) => void;
  setTool: (tool: ProjectState['tool']) => void;
  pushState: () => void;
  undo: () => void;
  redo: () => void;
  commitState: () => void;
  duplicateSelection: (offset?: { x: number; y: number }) => void;
  alignSelection: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  distributeSelection: (type: 'horizontal' | 'vertical') => void;
  nudgeSelection: (dx: number, dy: number) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  reorderShape: (draggedId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  performBooleanOperation: (op: 'union' | 'subtract' | 'intersect' | 'exclude') => void;
  
  // RULE 1: Async functions = Promise<void>
  copyShapes: () => Promise<void>;
  pasteShapes: () => Promise<void>;
  saveProject: (name: string, id?: string) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  currentProjectId: string | null;
  
  eyedropperMode: EyedropperMode;
  setEyedropperMode: (mode: Partial<EyedropperMode>) => void;
  swatches: string[];
  addSwatch: (color: string) => void;
  removeSwatch: (color: string) => void;
  savedProjects: SavedProject[];
  showMargins: boolean;
  setShowMargins: (show: boolean) => void;
}

const createStateSnapshot = (s: ProjectState): StateSnapshot => ({
    paper: s.paper, shapes: s.shapes, selectedShapeIds: s.selectedShapeIds,
    viewTransform: s.viewTransform, hatchParams: s.hatchParams, tool: s.tool, snapping: s.snapping
});

// Create a snapshot without selectedShapeIds for comparison (selection changes don't create history)
const createStateSnapshotForComparison = (s: ProjectState): Omit<StateSnapshot, 'selectedShapeIds'> => ({
    paper: s.paper, shapes: s.shapes,
    viewTransform: s.viewTransform, hatchParams: s.hatchParams, tool: s.tool, snapping: s.snapping
});

// Load saved projects from localStorage
const loadSavedProjects = (): SavedProject[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load saved projects:', e);
  }
  return [];
};

// Save projects to localStorage
const saveSavedProjects = (projects: SavedProject[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save projects:', e);
  }
};

export const useAppStore = create<AppState>((set, get) => ({
    ...initialSnapshot,
    history: { past: [], present: initialSnapshot, future: [] },
    savedProjects: loadSavedProjects(),
    currentProjectId: null,
    eyedropperMode: { copyColor: true, copyStroke: true, copyHatch: true },
    swatches: ['#000000', '#FF0000', '#0000FF', '#a333ff'],
    showMargins: true,

    setPaper: (u) => {
        const s = get();
        s.pushState();
        set(state => {
            const newState = { ...state, paper: { ...state.paper, ...u } };
            return { 
                paper: newState.paper,
                history: { ...state.history, present: createStateSnapshot(newState) }
            };
        });
    },
    setPaperPreset: (preset) => {
        const s = get();
        s.pushState();
        const dims = PAPER_PRESETS[preset];
        set(state => {
            const newState = { 
                ...state, 
                paper: { ...state.paper, preset, width: dims.width, height: dims.height }, 
                viewTransform: { centerX: dims.width/2, centerY: dims.height/2, scale: 0.9 } 
            };
            return {
                paper: newState.paper,
                viewTransform: newState.viewTransform,
                history: { ...state.history, present: createStateSnapshot(newState) }
            };
        });
    },
    setPaperOrientation: (o) => {
        const s = get();
        s.pushState();
        set(state => {
            const { width, height } = state.paper;
            const newW = o === 'portrait' ? Math.min(width, height) : Math.max(width, height);
            const newH = o === 'portrait' ? Math.max(width, height) : Math.min(width, height);
            const newState = { ...state, paper: { ...state.paper, orientation: o, width: newW, height: newH } };
            return {
                paper: newState.paper,
                history: { ...state.history, present: createStateSnapshot(newState) }
            };
        });
    },
    setPaperSize: (w, h) => {
        const s = get();
        s.pushState();
        set(state => {
            const newState = { ...state, paper: { ...state.paper, preset: 'Custom', width: w, height: h } };
            return {
                paper: newState.paper,
                history: { ...state.history, present: createStateSnapshot(newState) }
            };
        });
    },
    setPaperMargin: (m) => {
        const s = get();
        s.pushState();
        set(state => {
            const newState = { ...state, paper: { ...state.paper, margin: m } };
            return {
                paper: newState.paper,
                history: { ...state.history, present: createStateSnapshot(newState) }
            };
        });
    },

    addShape: (shape) => {
        const s = get();
        s.pushState(); // Push state before adding shape
        const newHatch = { ...s.hatchParams, [shape.id]: { enabled: true, density: 2, angle: 45, offset: 0, originX: shape.x, originY: shape.y, gradientEnabled: false, gradientStart: 2, gradientEnd: 5, gradientAngle: 90, crossHatchEnabled: false, crossHatchAngle: 135, crossHatchPerpendicular: true, zigZagEnabled: false, spaceMode: 'local' as const, renderOutline: false, fillRule: 'nonzero' as const } };
        const newState = { ...s, shapes: [...s.shapes, shape], hatchParams: newHatch };
        set({ 
            shapes: [...s.shapes, shape], 
            hatchParams: newHatch,
            history: { ...s.history, present: createStateSnapshot(newState) }
        });
    },
    
    updateShape: (id, updates) => set(state => {
        const index = state.shapes.findIndex(s => s.id === id);
        if (index === -1) return {};
        const shape = state.shapes[index];
        const newShapes = [...state.shapes];
        
        // Special handling for groups: when updating color, apply to all children
        if (shape.type === 'group' && 'color' in updates) {
            const group = shape as GroupShape;
            // Update the group itself (for consistency, though it won't be rendered)
            newShapes[index] = { ...newShapes[index], ...updates } as Shape;
            // Update all children's colors
            group.childrenIds.forEach(childId => {
                const childIndex = newShapes.findIndex(s => s.id === childId);
                if (childIndex !== -1) {
                    newShapes[childIndex] = { ...newShapes[childIndex], color: updates.color as string } as Shape;
                }
            });
        } else {
            // Normal update for non-groups, or non-color updates for groups
            newShapes[index] = { ...newShapes[index], ...updates } as Shape;
        }
        return { shapes: newShapes };
    }),

    deleteShape: (id) => {
        const s = get();
        s.pushState();
        set(state => {
            const newState = { 
                ...state, 
                shapes: state.shapes.filter(sh => sh.id !== id), 
                selectedShapeIds: state.selectedShapeIds.filter(sid => sid !== id) 
            };
            return {
                ...newState,
                history: { ...state.history, present: createStateSnapshot(newState) }
            };
        });
    },
    deleteShapes: (ids) => {
        const s = get();
        s.pushState();
        set(state => {
            const newState = { 
                ...state, 
                shapes: state.shapes.filter(sh => !ids.includes(sh.id)), 
                selectedShapeIds: state.selectedShapeIds.filter(sid => !ids.includes(sid)) 
            };
            return {
                ...newState,
                history: { ...state.history, present: createStateSnapshot(newState) }
            };
        });
    },

    selectShape: (id) => set({ selectedShapeIds: [id] }),
    selectShapes: (ids) => set({ selectedShapeIds: ids }),
    deselectAll: () => set({ selectedShapeIds: [] }),
    toggleSelection: (id) => set(s => ({ selectedShapeIds: s.selectedShapeIds.includes(id) ? s.selectedShapeIds.filter(i => i !== id) : [...s.selectedShapeIds, id] })),

    setViewTransform: (t) => set(s => {
        let newScale = t.scale !== undefined ? t.scale : s.viewTransform.scale;
        newScale = Math.max(0.1, Math.min(20.0, newScale)); 
        return { viewTransform: { ...s.viewTransform, ...t, scale: newScale } };
    }),
    resetView: () => { const s = get(); set({ viewTransform: { centerX: s.paper.width/2, centerY: s.paper.height/2, scale: 1 } }); },
    zoomToFit: () => { const s = get(); set({ viewTransform: { centerX: s.paper.width/2, centerY: s.paper.height/2, scale: 0.9 } }); },
    setZoom: (scale) => set(s => ({ viewTransform: { ...s.viewTransform, scale: Math.max(0.1, Math.min(20.0, scale)) } })),

    setHatchParams: (id, p) => {
        const s = get();
        s.pushState();
        set(state => {
            const shape = state.shapes.find(sh => sh.id === id);
            const existing = state.hatchParams[id];
            const defaults = existing || {
                enabled: true,
                density: 2,
                angle: 45,
                offset: 0,
                originX: shape?.x || 0,
                originY: shape?.y || 0,
                gradientEnabled: false,
                gradientStart: 2,
                gradientEnd: 5,
                crossHatchEnabled: false,
                crossHatchAngle: 135,
                crossHatchPerpendicular: true,
                zigZagEnabled: false,
                spaceMode: 'local' as const,
                renderOutline: false,
                fillRule: 'nonzero' as const
            };
            const newState = { ...state, hatchParams: { ...state.hatchParams, [id]: { ...defaults, ...p } } };
            return { 
                hatchParams: newState.hatchParams,
                history: { ...state.history, present: createStateSnapshot(newState) }
            };
        });
    },
    setHatchParamsSilent: (id, p) => {
        set(state => {
            const shape = state.shapes.find(sh => sh.id === id);
            const existing = state.hatchParams[id];
            const defaults = existing || {
                enabled: true,
                density: 2,
                angle: 45,
                offset: 0,
                originX: shape?.x || 0,
                originY: shape?.y || 0,
                gradientEnabled: false,
                gradientStart: 2,
                gradientEnd: 5,
                crossHatchEnabled: false,
                crossHatchAngle: 135,
                crossHatchPerpendicular: true,
                zigZagEnabled: false,
                spaceMode: 'local' as const,
                renderOutline: false,
                fillRule: 'nonzero' as const
            };
            const newState = { ...state, hatchParams: { ...state.hatchParams, [id]: { ...defaults, ...p } } };
            return { 
                hatchParams: newState.hatchParams,
                history: { ...state.history, present: createStateSnapshot(newState) }
            };
        });
    },
    setTool: (t) => set({ tool: t }),

    pushState: () => { 
        const s = get(); 
        const currentSnapshot = createStateSnapshot(s);
        
        // Compare WITHOUT selectedShapeIds (selection changes don't create history entries)
        const currentForComparison = createStateSnapshotForComparison(s);
        const presentForComparison = createStateSnapshotForComparison({ ...s, ...s.history.present });
        const hasChangedFromPresent = JSON.stringify(currentForComparison) !== JSON.stringify(presentForComparison);
        
        if (hasChangedFromPresent) {
            // Current state is different from present, so save present to past and update present
            set({ history: { past: [...s.history.past, s.history.present], present: currentSnapshot, future: [] } }); 
        } else {
            // Current state is same as present (pushState called before changes)
            // Always save current state to past as a checkpoint before changes
            // But only if it's different from the last past entry to avoid duplicates
            const lastPastEntry = s.history.past.length > 0 ? s.history.past[s.history.past.length - 1] : null;
            if (lastPastEntry) {
                const lastPastForComparison = createStateSnapshotForComparison({ ...s, ...lastPastEntry });
                const isDifferentFromLastPast = JSON.stringify(currentForComparison) !== JSON.stringify(lastPastForComparison);
                if (isDifferentFromLastPast) {
                    // Save current state to past as checkpoint before changes
                    set({ history: { past: [...s.history.past, currentSnapshot], present: currentSnapshot, future: [] } });
                }
                // If same as last past, we're already at that checkpoint, so no need to add duplicate
            } else {
                // No past entries yet, save current state
                set({ history: { past: [currentSnapshot], present: currentSnapshot, future: [] } });
            }
        }
    },
    undo: () => {
        const s = get(); 
        if (!s.history.past.length) return;
        const prev = s.history.past[s.history.past.length - 1];
        const currentSelection = s.selectedShapeIds; // Preserve current selection
        
        set({ 
            ...prev, 
            selectedShapeIds: currentSelection, // Preserve selection (don't restore from snapshot)
            history: { 
                past: s.history.past.slice(0, -1), 
                present: prev, 
                future: [createStateSnapshot(s), ...s.history.future] 
            },
            // Preserve fields that are not part of StateSnapshot
            savedProjects: s.savedProjects,
            eyedropperMode: s.eyedropperMode,
            swatches: s.swatches
        });
    },
    redo: () => {
        const s = get(); 
        if (!s.history.future.length) return;
        const next = s.history.future[0];
        const currentSelection = s.selectedShapeIds; // Preserve current selection
        
        set({ 
            ...next, 
            selectedShapeIds: currentSelection, // Preserve selection (don't restore from snapshot)
            history: { 
                past: [...s.history.past, createStateSnapshot(s)], 
                present: next, 
                future: s.history.future.slice(1) 
            },
            // Preserve fields that are not part of StateSnapshot
            savedProjects: s.savedProjects,
            eyedropperMode: s.eyedropperMode,
            swatches: s.swatches
        });
    },
    commitState: () => { 
        const s = get(); 
        const currentSnapshot = createStateSnapshot(s);
        // Compare to see if present needs updating
        const currentForComparison = createStateSnapshotForComparison(s);
        const presentForComparison = createStateSnapshotForComparison({ ...s, ...s.history.present });
        const hasChanged = JSON.stringify(currentForComparison) !== JSON.stringify(presentForComparison);
        
        if (hasChanged) {
            // State has changed, update present
            // If we don't have the previous state in past (pushState didn't create entry),
            // save current present to past first
            const lastPastEntry = s.history.past.length > 0 ? s.history.past[s.history.past.length - 1] : null;
            const presentSnapshot = s.history.present;
            
            if (lastPastEntry && JSON.stringify(lastPastEntry) === JSON.stringify(presentSnapshot)) {
                // Last past entry is same as present, so pushState already saved it
                // Just update present
                set({ history: { ...s.history, present: currentSnapshot } });
            } else {
                // Present is different from last past entry, save it to past first
                set({ history: { past: [...s.history.past, presentSnapshot], present: currentSnapshot, future: [] } });
            }
        }
    },

    duplicateSelection: (offset = { x: 10, y: 10 }) => {
      const s = get();
      s.pushState();
      set((state) => {
        const selectedShapes = state.shapes.filter(s => state.selectedShapeIds.includes(s.id));
        if (selectedShapes.length === 0) return {};
        
        // Clone shapes including all children
        const [allDuplicates, idMap, topLevelDuplicateIds] = cloneShapes(selectedShapes, state.shapes, offset.x, offset.y);
        
        // Copy hatch params for all duplicated shapes (including children)
        const newHatch = { ...state.hatchParams };
        allDuplicates.forEach((dup) => {
          // Find the original shape ID using the reverse mapping
          const originalId = Array.from(idMap.entries()).find(([_, newId]) => newId === dup.id)?.[0];
          if (originalId && state.hatchParams[originalId]) {
            newHatch[dup.id] = JSON.parse(JSON.stringify(state.hatchParams[originalId]));
          }
        });
        
        const newState = { 
          ...state, 
          shapes: [...state.shapes, ...allDuplicates], 
          selectedShapeIds: topLevelDuplicateIds, 
          hatchParams: newHatch 
        };
        return { 
          shapes: newState.shapes, 
          selectedShapeIds: newState.selectedShapeIds, 
          hatchParams: newState.hatchParams,
          history: { ...state.history, present: createStateSnapshot(newState) }
        };
      });
    },

    alignSelection: (type) => {
      const s = get();
      s.pushState();
      set((state) => {
        // Get shapes in selection order - first shape is the reference
        const selectedShapes = state.selectedShapeIds
          .map(id => state.shapes.find(s => s.id === id))
          .filter((s): s is Shape => s !== undefined);
        
        if (selectedShapes.length === 0) return {};
        
        // If only one shape is selected, align to paper margins
        if (selectedShapes.length === 1) {
          const shape = selectedShapes[0];
          const b = getShapeBounds(shape, state.shapes);
          const margin = state.paper.margin;
          const paperWidth = state.paper.width;
          const paperHeight = state.paper.height;
          
          // Calculate paper alignment positions
          const paperLeft = margin;
          const paperRight = paperWidth - margin;
          const paperTop = margin;
          const paperBottom = paperHeight - margin;
          const paperCenterX = paperWidth / 2;
          const paperCenterY = paperHeight / 2;
          
          let dx = 0, dy = 0;
          
          switch (type) {
            case 'left': 
              dx = paperLeft - b.x; 
              break;
            case 'right': 
              dx = paperRight - (b.x + b.width); 
              break;
            case 'center': 
              dx = paperCenterX - (b.x + b.width / 2); 
              break;
            case 'top': 
              dy = paperTop - b.y; 
              break;
            case 'bottom': 
              dy = paperBottom - (b.y + b.height); 
              break;
            case 'middle': 
              dy = paperCenterY - (b.y + b.height / 2); 
              break;
          }
          
          // If this is a group, move all children by the same offset
          const offsets = new Map<string, { dx: number; dy: number }>();
          offsets.set(shape.id, { dx, dy });
          
          if (shape.type === 'group') {
            const group = shape as GroupShape;
            group.childrenIds.forEach(childId => {
              offsets.set(childId, { dx, dy });
            });
          }
          
          // Apply offsets to all shapes
          const newShapes = state.shapes.map(s => {
            const offset = offsets.get(s.id);
            if (offset) {
              return { ...s, x: s.x + offset.dx, y: s.y + offset.dy };
            }
            return s;
          });
          
          const newState = { ...state, shapes: newShapes };
          return { 
            shapes: newShapes,
            history: { ...state.history, present: createStateSnapshot(newState) }
          };
        }
        
        // Multiple shapes: first shape is the reference (frozen)
        const referenceShape = selectedShapes[0];
        const referenceBounds = getShapeBounds(referenceShape, state.shapes);
        const referenceLeft = referenceBounds.x;
        const referenceRight = referenceBounds.x + referenceBounds.width;
        const referenceTop = referenceBounds.y;
        const referenceBottom = referenceBounds.y + referenceBounds.height;
        const referenceCenterX = referenceBounds.x + referenceBounds.width / 2;
        const referenceCenterY = referenceBounds.y + referenceBounds.height / 2;
        
        // Calculate offsets for all shapes that need to be aligned
        const offsets = new Map<string, { dx: number; dy: number }>();
        
        selectedShapes.forEach(shape => {
          // Skip the reference shape (first selected) - it stays frozen
          if (shape.id === referenceShape.id) return;
          
          const b = getShapeBounds(shape, state.shapes);
          let dx = 0, dy = 0;
          
          switch (type) {
            case 'left': 
              dx = referenceLeft - b.x; 
              break;
            case 'right': 
              dx = referenceRight - (b.x + b.width); 
              break;
            case 'center': 
              dx = referenceCenterX - (b.x + b.width / 2); 
              break;
            case 'top': 
              dy = referenceTop - b.y; 
              break;
            case 'bottom': 
              dy = referenceBottom - (b.y + b.height); 
              break;
            case 'middle': 
              dy = referenceCenterY - (b.y + b.height / 2); 
              break;
          }
          
          offsets.set(shape.id, { dx, dy });
          
          // If this is a group, also calculate offsets for all children
          if (shape.type === 'group') {
            const group = shape as GroupShape;
            group.childrenIds.forEach(childId => {
              offsets.set(childId, { dx, dy });
            });
          }
        });
        
        // Apply offsets to all shapes
        const newShapes = state.shapes.map(s => {
          const offset = offsets.get(s.id);
          if (offset) {
            return { ...s, x: s.x + offset.dx, y: s.y + offset.dy };
          }
          return s;
        });
        
        const newState = { ...state, shapes: newShapes };
        return { 
          shapes: newShapes,
          history: { ...state.history, present: createStateSnapshot(newState) }
        };
      });
    },
    
    // RULE 3: Parameters must match exactly
    distributeSelection: (type: 'horizontal' | 'vertical') => {
      const s = get();
      s.pushState();
      set((state) => {
        const selected = state.shapes.filter(s => state.selectedShapeIds.includes(s.id));
        if (selected.length < 3) return {};

        const sorted = [...selected].sort((a, b) => {
           const bA = getShapeBounds(a);
           const bB = getShapeBounds(b);
           if (type === 'horizontal') return (bA.x + bA.width/2) - (bB.x + bB.width/2);
           return (bA.y + bA.height/2) - (bB.y + bB.height/2);
        });

        const firstBounds = getShapeBounds(sorted[0]);
        const lastBounds = getShapeBounds(sorted[sorted.length-1]);
        
        let start, end;
        if (type === 'horizontal') {
           start = firstBounds.x + firstBounds.width/2;
           end = lastBounds.x + lastBounds.width/2;
        } else {
           start = firstBounds.y + firstBounds.height/2;
           end = lastBounds.y + lastBounds.height/2;
        }

        const totalDist = end - start;
        const step = totalDist / (sorted.length - 1);
        
        const updates = new Map<string, Partial<Shape>>();
        
        sorted.forEach((s, i) => {
           if (i === 0 || i === sorted.length - 1) return;
           const b = getShapeBounds(s);
           const targetCenter = start + i * step;
           if (type === 'horizontal') {
              const currentCenter = b.x + b.width/2;
              updates.set(s.id, { x: s.x + (targetCenter - currentCenter) });
           } else {
              const currentCenter = b.y + b.height/2;
              updates.set(s.id, { y: s.y + (targetCenter - currentCenter) });
           }
        });
        
        const newShapes = state.shapes.map(s => updates.has(s.id) ? { ...s, ...updates.get(s.id) } as Shape : s);
        const newState = { ...state, shapes: newShapes };
        return { 
          shapes: newShapes,
          history: { ...state.history, present: createStateSnapshot(newState) }
        };
      });
    },

    nudgeSelection: (dx, dy) => {
      const s = get();
      s.pushState();
      set(state => {
        const newShapes = state.shapes.map(sh => state.selectedShapeIds.includes(sh.id) ? { ...sh, x: sh.x + dx, y: sh.y + dy } : sh);
        const newState = { ...state, shapes: newShapes };
        return { 
          shapes: newShapes,
          history: { ...state.history, present: createStateSnapshot(newState) }
        };
      });
    },

    groupSelection: () => {
      const s = get();
      s.pushState();
      set(state => {
        const ids = state.selectedShapeIds.filter(id => {
          const shape = state.shapes.find(s => s.id === id);
          return shape && shape.type !== 'group'; // Don't group groups themselves
        });
        if (ids.length < 2) return {};
        
        // Calculate bounds of all shapes to be grouped
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        ids.forEach(id => {
          const shape = state.shapes.find(s => s.id === id);
          if (shape) {
            const bounds = getShapeBounds(shape, state.shapes);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
          }
        });
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const width = maxX - minX;
        const height = maxY - minY;
        
        const group: GroupShape = { 
          id: crypto.randomUUID(), 
          type: 'group', 
          x: centerX, 
          y: centerY, 
          width: width, 
          height: height, 
          rotation: 0, 
          visible: true, 
          locked: false, 
          strokeWidth: 0, 
          color: '#000000', 
          childrenIds: ids 
        };
        const newShapes = state.shapes.map(s => ids.includes(s.id) ? { ...s, groupId: group.id } : s);
        // Initialize hatch params for the group (so it can be controlled in the UI)
        const newHatchParams = {
          ...state.hatchParams,
          [group.id]: {
            enabled: true,
            density: 2,
            angle: 45,
            offset: 0,
            originX: group.x,
            originY: group.y,
            gradientEnabled: false,
            gradientStart: 2,
            gradientEnd: 5,
            crossHatchEnabled: false,
            crossHatchAngle: 135,
            crossHatchPerpendicular: true,
            zigZagEnabled: false,
            spaceMode: 'local' as const,
            renderOutline: false,
            fillRule: 'nonzero' as const
          }
        };
        const newState = { ...state, shapes: [...newShapes, group], selectedShapeIds: [group.id], hatchParams: newHatchParams };
        return { 
          shapes: newState.shapes, 
          selectedShapeIds: newState.selectedShapeIds, 
          hatchParams: newState.hatchParams,
          history: { ...state.history, present: createStateSnapshot(newState) }
        };
      });
    },

    ungroupSelection: () => {
      const s = get();
      s.pushState();
      set(state => {
        const groupIds = state.selectedShapeIds.filter(id => state.shapes.find(s => s.id === id)?.type === 'group');
        if (groupIds.length === 0) return {};

        // Collect all children IDs that will be ungrouped
        const ungroupedChildIds: string[] = [];
        groupIds.forEach(groupId => {
          const group = state.shapes.find(s => s.id === groupId);
          if (group && group.type === 'group') {
            ungroupedChildIds.push(...(group as GroupShape).childrenIds);
          }
        });

        const newShapes = state.shapes
          .filter(s => !groupIds.includes(s.id))
          .map(s => {
              if (s.groupId && groupIds.includes(s.groupId)) {
                  return { ...s, groupId: undefined };
              }
              return s;
          });
        
        const newState = { ...state, shapes: newShapes, selectedShapeIds: ungroupedChildIds };
        return { 
          shapes: newShapes, 
          selectedShapeIds: ungroupedChildIds,
          history: { ...state.history, present: createStateSnapshot(newState) }
        };
      });
    },

    reorderShape: (draggedId, targetId, position) => {
      const s = get();
      s.pushState();
      set(state => {
        const shapes = [...state.shapes];
        const fromIdx = shapes.findIndex(s => s.id === draggedId);
        const toIdx = shapes.findIndex(s => s.id === targetId);
        
        if (fromIdx === -1 || toIdx === -1) return {};
        
        const [item] = shapes.splice(fromIdx, 1);
        let newToIdx = shapes.findIndex(s => s.id === targetId); 
        if (position === 'after') newToIdx += 1;
        shapes.splice(newToIdx, 0, item);
        
        const newState = { ...state, shapes };
        return { 
          shapes,
          history: { ...state.history, present: createStateSnapshot(newState) }
        };
      });
    },

    performBooleanOperation: (op) => {
      const s = get();
      // Push state before performing operation - use the pushState method
      if (typeof (s as any).pushState === 'function') {
        (s as any).pushState();
      } else {
        // Fallback: inline pushState logic if method not available
        const currentForComparison = createStateSnapshotForComparison(s);
        const presentForComparison = createStateSnapshotForComparison({ ...s, ...s.history.present });
        const hasChanged = JSON.stringify(currentForComparison) !== JSON.stringify(presentForComparison);
        if (hasChanged) {
          const currentSnapshot = createStateSnapshot(s);
          set({ history: { past: [...s.history.past, s.history.present], present: currentSnapshot, future: [] } });
        }
      }
      set((state) => {
        // Preserve selection order: first shape is main, rest are cutting tools
        const selectedShapes = state.selectedShapeIds
          .map(id => state.shapes.find(s => s.id === id))
          .filter((s): s is Shape => s !== undefined);
        if (selectedShapes.length < 2) return {};

        const resultData = computeBooleanOperation(selectedShapes, op);
        if (!resultData || resultData.length === 0) return {};

        const parentColor = selectedShapes[0].color || '#000000';
        const parentHatch = state.hatchParams[selectedShapes[0].id];
        // Don't preserve cornerRadius for boolean results because:
        // 1. Input shapes with rounded corners already have geometry sampled (baked in)
        // 2. The result polyline points already represent rounded geometry
        // 3. Applying cornerRadius again would cause double-rounding
        // If user wants rounded corners on the result, they can add them manually
        const parentCornerRadius = undefined; // Always clear for boolean results

        const newShapes: PolylineShape[] = resultData.map(data => ({
          id: crypto.randomUUID(),
          type: 'polyline',
          x: 0, y: 0,
          rotation: 0,
          visible: true,
          locked: false,
          strokeWidth: 0.2,
          color: parentColor,
          points: data.points,
          holes: data.holes,
          cornerRadius: parentCornerRadius
        }));

        const remainingShapes = state.shapes.filter(s => !state.selectedShapeIds.includes(s.id));
        const newHatch = { ...state.hatchParams };
        
        state.selectedShapeIds.forEach(id => delete newHatch[id]);
        
        newShapes.forEach(s => {
           if (parentHatch) {
             // Copy parent hatch params but explicitly disable outline rendering
             newHatch[s.id] = { ...parentHatch, renderOutline: false };
           } else {
             // Use defaults if parent doesn't have hatch params
             newHatch[s.id] = {
               enabled: true,
               density: 2,
               angle: 45,
               offset: 0,
               originX: s.x || 0,
               originY: s.y || 0,
               gradientEnabled: false,
               gradientStart: 2,
               gradientEnd: 5,
               crossHatchEnabled: false,
               crossHatchAngle: 135,
               crossHatchPerpendicular: true,
               zigZagEnabled: false,
               spaceMode: 'local' as const,
               renderOutline: false,
               fillRule: 'nonzero' as const
             };
           }
        });

        const newState = {
          ...state,
          shapes: [...remainingShapes, ...newShapes],
          selectedShapeIds: newShapes.map(s => s.id),
          hatchParams: newHatch
        };
        return {
          shapes: newState.shapes,
          selectedShapeIds: newState.selectedShapeIds,
          hatchParams: newState.hatchParams,
          history: { ...state.history, present: createStateSnapshot(newState) }
        };
      });
    },

    // RULE 1: Implementations using async must match Promise<void>
    copyShapes: async () => {
      const state = get();
      const selected = state.shapes.filter(s => state.selectedShapeIds.includes(s.id));
      if (selected.length > 0) {
        internalClipboard = JSON.parse(JSON.stringify(selected));
      }
    },

    pasteShapes: async () => {
      if (internalClipboard.length === 0) return;
      const s = get();
      // Push state before pasting - use the pushState method
      if (typeof (s as any).pushState === 'function') {
        (s as any).pushState();
      } else {
        // Fallback: inline pushState logic if method not available
        const currentForComparison = createStateSnapshotForComparison(s);
        const presentForComparison = createStateSnapshotForComparison({ ...s, ...s.history.present });
        const hasChanged = JSON.stringify(currentForComparison) !== JSON.stringify(presentForComparison);
        if (hasChanged) {
          const currentSnapshot = createStateSnapshot(s);
          set({ history: { past: [...s.history.past, s.history.present], present: currentSnapshot, future: [] } });
        }
      }
      const duplicates = cloneShapes(internalClipboard, 15);
      const newHatch = { ...s.hatchParams };
      
      duplicates.forEach((dup, i) => {
         const originalId = internalClipboard[i].id;
         if (s.hatchParams[originalId]) {
            newHatch[dup.id] = { ...s.hatchParams[originalId] };
         }
      });

      set(state => {
        const newState = {
          ...state,
          shapes: [...state.shapes, ...duplicates],
          selectedShapeIds: duplicates.map(d => d.id),
          hatchParams: newHatch
        };
        return {
          ...newState,
          history: { ...state.history, present: createStateSnapshot(newState) }
        };
      });
    },

    setEyedropperMode: (mode) => set(s => ({ eyedropperMode: { ...s.eyedropperMode, ...mode } })),
    addSwatch: (c) => set(s => ({ swatches: [...s.swatches, c] })),
    removeSwatch: (c) => set(s => ({ swatches: s.swatches.filter(x => x !== c) })),
    setShowMargins: (show) => set({ showMargins: show }),
    
    // RULE 1: Async functions matching interface signature
    saveProject: async (name, id) => {
      const state = get();
      const snapshot = createStateSnapshot(state);
      
      // Generate thumbnail
      let thumbnail: string | undefined;
      try {
        thumbnail = await generateThumbnail(state);
      } catch (e) {
        console.error('Failed to generate thumbnail:', e);
      }
      
      let updatedProjects: SavedProject[];
      let projectId: string;
      
      // If id is provided and exists, update the existing project
      if (id) {
        const existingIndex = state.savedProjects.findIndex(p => p.id === id);
        if (existingIndex !== -1) {
          updatedProjects = [...state.savedProjects];
          updatedProjects[existingIndex] = {
            ...updatedProjects[existingIndex],
            name: name.trim(),
            date: Date.now(),
            data: snapshot,
            thumbnail: thumbnail || updatedProjects[existingIndex].thumbnail
          };
          projectId = id;
        } else {
          // ID provided but doesn't exist, create new project
          projectId = crypto.randomUUID();
          const savedProject: SavedProject = {
            id: projectId,
            name: name.trim(),
            date: Date.now(),
            data: snapshot,
            thumbnail
          };
          updatedProjects = [...state.savedProjects, savedProject];
        }
      } else {
        // No ID provided, create new project
        projectId = crypto.randomUUID();
        const savedProject: SavedProject = {
          id: projectId,
          name: name.trim(),
          date: Date.now(),
          data: snapshot,
          thumbnail
        };
        updatedProjects = [...state.savedProjects, savedProject];
      }
      
      set({ savedProjects: updatedProjects, currentProjectId: projectId });
      saveSavedProjects(updatedProjects);
    },
    
    loadProject: async (id) => {
      const state = get();
      const project = state.savedProjects.find(p => p.id === id);
      
      if (!project) {
        console.error('Project not found:', id);
        return;
      }
      
      // Restore the project state
      const { data } = project;
      // Ensure canvasColor exists for older projects (migration)
      const paperWithDefaults = {
        ...data.paper,
        canvasColor: data.paper.canvasColor || '#ffffff'
      };
      set({
        paper: paperWithDefaults,
        shapes: data.shapes,
        selectedShapeIds: data.selectedShapeIds,
        viewTransform: data.viewTransform,
        hatchParams: data.hatchParams,
        tool: data.tool,
        snapping: data.snapping,
        history: { past: [], present: data, future: [] },
        currentProjectId: id
      });
    },
    
    deleteProject: async (id) => {
      const state = get();
      const updatedProjects = state.savedProjects.filter(p => p.id !== id);
      set({ savedProjects: updatedProjects });
      saveSavedProjects(updatedProjects);
    }
}));
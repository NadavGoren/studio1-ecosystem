import { create } from 'zustand';
import { UIState, Vector3, Vector2 } from '../../core/types';

interface UISlice {
  ui: UIState;
  setActiveTool: (tool: 'rotate' | 'move') => void;
  setIsDragging: (isDragging: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setViewportRotation: (rotation: Vector3) => void;
  setPositionOffset: (offset: Vector2) => void;
}

const defaultUI: UIState = {
  activeTool: 'rotate',
  isDragging: false,
  isLoading: false,
  error: null,
  viewportRotation: { x: 0, y: 0, z: 0 },
  positionOffset: { x: 0, y: 0 },
  theme: 'light', // Always light mode
};

export const useUISlice = create<UISlice>((set) => ({
  ui: defaultUI,
  setActiveTool: (activeTool) => 
    set((state) => ({ ui: { ...state.ui, activeTool } })),
  setIsDragging: (isDragging) => 
    set((state) => ({ ui: { ...state.ui, isDragging } })),
  setIsLoading: (isLoading) => 
    set((state) => ({ ui: { ...state.ui, isLoading } })),
  setError: (error) => 
    set((state) => ({ ui: { ...state.ui, error } })),
  setViewportRotation: (viewportRotation) => 
    set((state) => ({ ui: { ...state.ui, viewportRotation } })),
  setPositionOffset: (positionOffset) => 
    set((state) => ({ ui: { ...state.ui, positionOffset } })),
}));



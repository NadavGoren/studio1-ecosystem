import { create } from 'zustand';
import { RenderingState, RenderingMode, ViewMode } from '../../core/types';

interface RenderingSlice {
  rendering: RenderingState;
  setMode: (mode: RenderingMode) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setPerspectiveStrength: (strength: number) => void;
  setHatchSpacing: (spacing: number) => void;
  setMinSpacing: (spacing: number) => void;
  setHatchAngle: (angle: number) => void;
  setAdvancedShading: (enabled: boolean) => void;
  setCrossHatch: (enabled: boolean) => void;
  setCrossHatchDensity: (density: number) => void;
  setShadow: (enabled: boolean) => void;
  setLineJitter: (enabled: boolean) => void;
  setJitterIntensity: (intensity: number) => void;
  setJitterFrequency: (frequency: number) => void;
  setJitterRandomness: (randomness: number) => void;
}

const defaultRendering: RenderingState = {
  mode: 'contour-sharp',
  viewMode: 'isometric',
  perspectiveStrength: 1.0,
  hatchSpacing: 2.0,
  minSpacing: 0.5,
  hatchAngle: 45,
  advancedShading: false,
  crossHatch: false,
  crossHatchDensity: 0.5,
  shadow: false,
  lineJitter: false,
  jitterIntensity: 50,
  jitterFrequency: 50,
  jitterRandomness: 50,
};

export const useRenderingSlice = create<RenderingSlice>((set) => ({
  rendering: defaultRendering,
  setMode: (mode) => 
    set((state) => ({ rendering: { ...state.rendering, mode } })),
  setViewMode: (viewMode) => 
    set((state) => ({ rendering: { ...state.rendering, viewMode } })),
  setPerspectiveStrength: (perspectiveStrength) => 
    set((state) => ({ rendering: { ...state.rendering, perspectiveStrength } })),
  setHatchSpacing: (hatchSpacing) => 
    set((state) => ({ rendering: { ...state.rendering, hatchSpacing } })),
  setMinSpacing: (minSpacing) => 
    set((state) => ({ rendering: { ...state.rendering, minSpacing } })),
  setHatchAngle: (hatchAngle) => 
    set((state) => ({ rendering: { ...state.rendering, hatchAngle } })),
  setAdvancedShading: (advancedShading) => 
    set((state) => ({ rendering: { ...state.rendering, advancedShading } })),
  setCrossHatch: (crossHatch) => 
    set((state) => ({ rendering: { ...state.rendering, crossHatch } })),
  setCrossHatchDensity: (crossHatchDensity) => 
    set((state) => ({ rendering: { ...state.rendering, crossHatchDensity } })),
  setShadow: (shadow) => 
    set((state) => ({ rendering: { ...state.rendering, shadow } })),
  setLineJitter: (lineJitter) => 
    set((state) => ({ rendering: { ...state.rendering, lineJitter } })),
  setJitterIntensity: (jitterIntensity) => 
    set((state) => ({ rendering: { ...state.rendering, jitterIntensity } })),
  setJitterFrequency: (jitterFrequency) => 
    set((state) => ({ rendering: { ...state.rendering, jitterFrequency } })),
  setJitterRandomness: (jitterRandomness) => 
    set((state) => ({ rendering: { ...state.rendering, jitterRandomness } })),
}));



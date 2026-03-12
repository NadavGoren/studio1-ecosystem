import { create } from 'zustand';
import { LightingState } from '../../core/types';

interface LightingSlice {
  lighting: LightingState;
  setAzimuth: (azimuth: number) => void;
  setElevation: (elevation: number) => void;
  setIntensity: (intensity: number) => void;
  setContrast: (contrast: number) => void;
  setBacklight: (backlight: boolean) => void;
}

const defaultLighting: LightingState = {
  azimuth: 45,
  elevation: 45,
  intensity: 1.0,
  contrast: 0.5,
  backlight: false,
};

export const useLightingSlice = create<LightingSlice>((set) => ({
  lighting: defaultLighting,
  setAzimuth: (azimuth) => 
    set((state) => ({ lighting: { ...state.lighting, azimuth } })),
  setElevation: (elevation) => 
    set((state) => ({ lighting: { ...state.lighting, elevation } })),
  setIntensity: (intensity) => 
    set((state) => ({ lighting: { ...state.lighting, intensity } })),
  setContrast: (contrast) => 
    set((state) => ({ lighting: { ...state.lighting, contrast } })),
  setBacklight: (backlight) => 
    set((state) => ({ lighting: { ...state.lighting, backlight } })),
}));













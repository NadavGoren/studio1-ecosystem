import { create } from 'zustand';
import { CanvasConfig, CanvasPreset } from '../../core/types';

interface CanvasSlice {
  canvas: CanvasConfig;
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  setPreset: (preset: CanvasPreset) => void;
  setOrientation: (orientation: 'portrait' | 'landscape') => void;
  setMargins: (margins: number) => void;
  setStrokeWidth: (strokeWidth: number) => void;
  toggleOrientation: () => void;
}

const CANVAS_PRESETS: Record<CanvasPreset, { width: number; height: number }> = {
  A6: { width: 148, height: 105 },
  A5: { width: 210, height: 148 },
  A4: { width: 297, height: 210 },
  A3: { width: 420, height: 297 },
  Custom: { width: 297, height: 210 },
};

const defaultCanvas: CanvasConfig = {
  width: 297,
  height: 210,
  preset: 'A4',
  orientation: 'landscape',
  margins: 10,
  strokeWidth: 0.4,
};

export const useCanvasSlice = create<CanvasSlice>((set) => ({
  canvas: defaultCanvas,
  setWidth: (width) => 
    set((state) => ({ canvas: { ...state.canvas, width } })),
  setHeight: (height) => 
    set((state) => ({ canvas: { ...state.canvas, height } })),
  setPreset: (preset) => {
    const presetDims = CANVAS_PRESETS[preset];
    set((state) => ({
      canvas: {
        ...state.canvas,
        preset,
        width: presetDims.width,
        height: presetDims.height,
      },
    }));
  },
  setOrientation: (orientation) => 
    set((state) => ({ canvas: { ...state.canvas, orientation } })),
  setMargins: (margins) => 
    set((state) => ({ canvas: { ...state.canvas, margins } })),
  setStrokeWidth: (strokeWidth) => 
    set((state) => ({ canvas: { ...state.canvas, strokeWidth } })),
  toggleOrientation: () => 
    set((state) => ({
      canvas: {
        ...state.canvas,
        orientation: state.canvas.orientation === 'portrait' ? 'landscape' : 'portrait',
        width: state.canvas.height,
        height: state.canvas.width,
      },
    })),
}));













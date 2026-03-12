import { create } from 'zustand';

export interface ViewRotation {
  azimuth: number; // Horizontal rotation in degrees (0-360)
  elevation: number; // Vertical rotation in degrees (0-180)
}

export interface ViewPan {
  x: number; // Horizontal pan offset
  y: number; // Vertical pan offset
}

interface SVGViewportSlice {
  viewRotation: ViewRotation;
  viewPan: ViewPan;
  viewZoom: number;
  baseScale: number; // Base scale calculated on initial fit
  showGrid: boolean;
  setViewRotation: (rotation: ViewRotation) => void;
  setViewPan: (pan: ViewPan) => void;
  setViewZoom: (zoom: number) => void;
  setBaseScale: (scale: number) => void;
  setShowGrid: (show: boolean) => void;
  resetView: () => void;
}

const defaultViewRotation: ViewRotation = {
  azimuth: 45, // Default isometric view (standard CAD isometric)
  elevation: 35.264, // 35.264° is the standard isometric elevation angle (arctan(1/√2))
};

const defaultViewPan: ViewPan = {
  x: 0,
  y: 0,
};

const defaultViewZoom = 1.0;
const defaultBaseScale = 1.0;

export const useSVGViewportSlice = create<SVGViewportSlice>((set) => ({
  viewRotation: defaultViewRotation,
  viewPan: defaultViewPan,
  viewZoom: defaultViewZoom,
  baseScale: defaultBaseScale,
  showGrid: true,
  setViewRotation: (rotation) =>
    set({ viewRotation: rotation }),
  setViewPan: (pan) =>
    set({ viewPan: pan }),
  setViewZoom: (zoom) =>
    set({ viewZoom: Math.max(0.1, Math.min(10, zoom)) }), // Clamp zoom between 0.1 and 10
  setBaseScale: (scale) =>
    set({ baseScale: scale }),
  setShowGrid: (show) =>
    set({ showGrid: show }),
  resetView: () => set({
    viewRotation: defaultViewRotation,
    viewPan: defaultViewPan,
    viewZoom: defaultViewZoom,
    showGrid: true,
  }),
}));




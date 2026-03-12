import { create } from 'zustand';
import type { ProjectedEdge, HatchLine, Metrics } from '../../core/types';
import type { SVGLine } from '../../export/svgGenerator';

interface RenderedDataSlice {
  edges: ProjectedEdge[];
  lines: HatchLine[];
  svgLines: SVGLine[];
  svgContent: string;
  metrics: Metrics;
  scale: number;
  offset: { x: number; y: number };
  setRenderedData: (edges: ProjectedEdge[], lines: HatchLine[]) => void;
  setSVGData: (
    svgLines: SVGLine[],
    svgContent: string,
    metrics: Metrics,
    scale: number,
    offset: { x: number; y: number }
  ) => void;
  clearRenderedData: () => void;
}

export const useRenderedDataSlice = create<RenderedDataSlice>((set) => ({
  edges: [],
  lines: [],
  svgLines: [],
  svgContent: '',
  metrics: { lineCount: 0, pathLength: 0, estimatedPlotTime: 0 },
  scale: 1,
  offset: { x: 0, y: 0 },
  setRenderedData: (edges, lines) => set({ edges, lines }),
  setSVGData: (svgLines, svgContent, metrics, scale, offset) =>
    set({ svgLines, svgContent, metrics, scale, offset }),
  clearRenderedData: () =>
    set({
      edges: [],
      lines: [],
      svgLines: [],
      svgContent: '',
      metrics: { lineCount: 0, pathLength: 0, estimatedPlotTime: 0 },
      scale: 1,
      offset: { x: 0, y: 0 },
    }),
}));


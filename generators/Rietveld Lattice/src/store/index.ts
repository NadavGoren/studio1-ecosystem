import { create } from 'zustand'
import type { Params } from '../types'

export const DEFAULT_PARAMS: Params = {
  seed: 4821,

  // model / lattice
  gridX: 8,
  gridY: 11,
  gridZ: 6,
  beamCount: 70,
  beamLenMin: 3,
  beamLenMax: 8,
  overrun: 1.2,
  crossSection: 0.16,
  boardThickness: 0.2,
  extraBoards: 3,
  dominance: 0.5,

  // joinery (woven cage)
  gridLinesX: 3,
  gridLinesY: 3,
  gridLinesZ: 3,
  gridPlates: 3,
  jointOverhang: 1,

  // composition
  structure: 'lattice',
  boardTilt: 0.2,
  verticality: 0.5,
  asymmetry: 0.15,

  // colour
  colourStrategy: 'alternating',
  redShare: 0.5,
  yellowCaps: true,
  hatchBeams: true,

  // projection
  azimuth: 35,
  elevation: 28,

  // shading (world light)
  lightAzimuth: 15,
  lightElevation: 66,
  shadeContrast: 0.7,
  shadeLevels: 5,
  litWhite: true,

  // hatch
  hatchSpacing: 0.3,
  angleX: 20,
  angleY: 80,
  angleZ: 140,
  crossHatch: true,
  depthFalloff: 0.2,

  // depth / occlusion
  hiddenLine: 100,
  occlusion: 100,

  // page
  paperSize: 'A3',
  orientation: 'portrait',
  margin: 18,
  strokeWidth: 0.35,
}

interface State {
  params: Params
  set: <K extends keyof Params>(key: K, value: Params[K]) => void
  patch: (partial: Partial<Params>) => void
  randomizeSeed: () => void
  setSeed: (seed: number) => void
  loadParams: (params: Params) => void
  reset: () => void
}

export const useStore = create<State>((set) => ({
  params: { ...DEFAULT_PARAMS },
  set: (key, value) => set((s) => ({ params: { ...s.params, [key]: value } })),
  patch: (partial) => set((s) => ({ params: { ...s.params, ...partial } })),
  randomizeSeed: () => set((s) => ({ params: { ...s.params, seed: Math.floor(Math.random() * 1_000_000) } })),
  setSeed: (seed) => set((s) => ({ params: { ...s.params, seed: seed | 0 } })),
  loadParams: (params) => set({ params: { ...DEFAULT_PARAMS, ...params } }),
  reset: () => set({ params: { ...DEFAULT_PARAMS } }),
}))

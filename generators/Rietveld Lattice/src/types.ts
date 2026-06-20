// ── Core data types for the shared 3D beam-model ────────────────────────────
// One model, plain data, feeds BOTH the Three.js viewport and the SVG exporter.

export type Axis = 'x' | 'y' | 'z'
export type ElementKind = 'beam' | 'board'
export type PenColor = 'black' | 'red' | 'blue' | 'yellow'

export type Vec3 = [number, number, number]
export type Vec2 = [number, number]
export type Segment = [Vec2, Vec2]
/** row-major 3x3 rotation matrix */
export type Mat3 = [number, number, number, number, number, number, number, number, number]

/**
 * An axis-aligned rectangular prism. A `beam` is long on its `runAxis`; a
 * `board` is thin on its `thinAxis`. Defined by centre + half-extents so face
 * geometry is trivial.
 */
export interface Box {
  id: number
  kind: ElementKind
  /** for a beam: the axis it runs along; the two faces normal to it are caps */
  runAxis: Axis
  /** for a board: the thin axis; its two large faces carry the colour field */
  thinAxis: Axis
  center: Vec3
  half: Vec3
  /** base ink for the element (beams = black structure, boards = red/blue) */
  color: PenColor
  /** optional orientation about the centre (tilted boards); absent = axis-aligned */
  rot?: Mat3
}

export interface BeamModel {
  boxes: Box[]
  bounds: { min: Vec3; max: Vec3 }
}

// ── Parameters ──────────────────────────────────────────────────────────────

export type ColourStrategy = 'alternating' | 'weighted' | 'positional'
export type PaperSize = 'A2' | 'A3' | 'A4' | 'A5'
export type Orientation = 'portrait' | 'landscape'
/** composition archetype, each derived from a Rietveld work */
export type StructureMode = 'lattice' | 'chair' | 'architecture'

export interface Params {
  seed: number

  // model / lattice
  gridX: number
  gridY: number
  gridZ: number
  beamCount: number
  beamLenMin: number
  beamLenMax: number
  overrun: number
  crossSection: number
  boardThickness: number
  extraBoards: number
  dominance: number // 0 = free lattice rules, 1 = signature boards rule

  // composition
  structure: StructureMode
  boardTilt: number // 0 = flat/upright boards, 1 = strongly reclined (Red-Blue chair)
  verticality: number // 0 = mostly horizontal beams, 1 = mostly vertical uprights
  asymmetry: number // 0 = centred, 1 = strongly off-balance (De Stijl asymmetry)

  // colour
  colourStrategy: ColourStrategy
  redShare: number // 0..1 for the weighted strategy
  yellowCaps: boolean
  hatchBeams: boolean // also hatch beam long-faces (black) — off keeps density in edges

  // projection (axonometric)
  azimuth: number
  elevation: number

  // hatch
  hatchSpacing: number // mm
  angleX: number // hatch angle for faces whose normal is the x axis (deg)
  angleY: number
  angleZ: number
  crossHatch: boolean
  depthFalloff: number // 0..1, widens far-face hatch spacing

  // depth / occlusion
  hiddenLine: number // edges: 0 = x-ray wireframe, 100 = solid (front hides back)
  occlusion: number // fills: 0 = x-ray, 100 = solid

  // page
  paperSize: PaperSize
  orientation: Orientation
  margin: number
  strokeWidth: number
}

// ── Render output ───────────────────────────────────────────────────────────

export interface LineLayer {
  color: PenColor
  hex: string
  /** plotter line segments in page millimetres */
  segments: Segment[]
}

export interface RenderResult {
  layers: LineLayer[]
  page: { w: number; h: number }
  seed: number
  stats: {
    boxes: number
    edgeSegments: number
    fillSegments: number
    totalLines: number
  }
}

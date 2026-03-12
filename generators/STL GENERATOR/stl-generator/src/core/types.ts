// Core type definitions for STL to SVG generator

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Face {
  indices: number[]; // Vertex indices (typically 3 for triangles)
  normal: Vector3;
  id?: number; // Optional face identifier
}

export interface Edge {
  v1: number; // Vertex index 1
  v2: number; // Vertex index 2
  face1?: number; // Adjacent face index 1
  face2?: number; // Adjacent face index 2
}

export interface AdjacencyGraph {
  edges: Edge[];
  edgeToFaces: Map<string, number[]>; // Edge key -> face indices
  faceToEdges: Map<number, Edge[]>; // Face index -> edges
}

export interface BoundingBox {
  min: Vector3;
  max: Vector3;
  size: Vector3;
  center: Vector3;
}

export interface Mesh {
  vertices: Vector3[];
  faces: Face[];
  normals: Vector3[]; // Per-vertex normals (optional, computed if not provided)
  adjacency?: AdjacencyGraph;
  boundingBox?: BoundingBox;
  centerOfMass?: Vector3;
  originalVertices?: Vector3[]; // Store original for reset
}

export type CoordinateSystem = 'Z-up' | 'Y-up' | 'X-up';

export interface TransformState {
  translation: Vector3;
  rotation: Vector3; // Euler angles in degrees (X, Y, Z)
  flipX: boolean;
  flipY: boolean;
  flipZ: boolean;
  coordinateSystem?: CoordinateSystem; // Default coordinate system orientation
}

export interface LightingState {
  azimuth: number; // 0-360 degrees
  elevation: number; // 0-90 degrees
  intensity: number; // 0-2.0
  contrast: number; // 0-1.0
  backlight: boolean;
}

export type CanvasPreset = 'A6' | 'A5' | 'A4' | 'A3' | 'Custom';

export interface CanvasConfig {
  width: number; // mm
  height: number; // mm
  preset: CanvasPreset;
  orientation: 'portrait' | 'landscape';
  margins: number; // mm
  strokeWidth: number; // mm
}

export type RenderingMode = 'contour-only' | 'contour-sharp' | 'wireframe';
export type ViewMode = 'isometric' | 'perspective';

export interface RenderingState {
  mode: RenderingMode;
  viewMode: ViewMode;
  perspectiveStrength: number; // 0-4 for perspective blending
  hatchSpacing: number; // mm
  minSpacing: number; // mm
  hatchAngle: number; // degrees (0-180)
  advancedShading: boolean;
  crossHatch: boolean;
  crossHatchDensity: number; // 0-1
  shadow: boolean;
  lineJitter: boolean;
  jitterIntensity?: number; // 0-100
  jitterFrequency?: number; // 0-100
  jitterRandomness?: number; // 0-100
}

export interface UIState {
  activeTool: 'rotate' | 'move';
  isDragging: boolean;
  isLoading: boolean;
  error: string | null;
  viewportRotation: Vector3; // For Three.js viewport
  positionOffset: Vector2; // mm offset for move tool
  theme: 'light' | 'dark'; // Theme preference
}

// Worker message types
export type WorkerMessageType = 
  | 'parse-stl'
  | 'stl-parsed'
  | 'process-geometry'
  | 'geometry-processed'
  | 'extract-edges'
  | 'edges-extracted'
  | 'error'
  | 'progress';

export interface WorkerMessage {
  type: WorkerMessageType;
  payload?: any;
  error?: string;
  progress?: number;
}

export interface STLParseResult {
  mesh: Mesh;
  triangleCount: number;
}

export interface GeometryProcessResult {
  mesh: Mesh;
  normalized: boolean;
}

export interface EdgeExtractionResult {
  silhouetteEdges: Edge[];
  sharpEdges: Edge[];
  allEdges: Edge[];
  visibleFaces: number[];
}

// Projected geometry types
export interface ProjectedFace {
  vertices2D: Vector2[];
  vertices3D: Vector3[];
  faceIndex: number;
  normal: Vector3;
  shading: number;
  depth: number; // For depth sorting
}

export interface ProjectedEdge {
  v1: Vector2;
  v2: Vector2;
  v1_3D: Vector3;
  v2_3D: Vector3;
  type: 'silhouette' | 'sharp' | 'internal';
}

export interface HatchLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  faceIndex?: number;
  shading?: number;
}

export interface Metrics {
  lineCount: number;
  pathLength: number; // mm
  estimatedPlotTime: number; // seconds
}


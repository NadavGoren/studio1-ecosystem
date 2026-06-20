export const PAPER_PRESETS = {
  A5: { width: 148, height: 210 },
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  Custom: { width: 210, height: 297 },
} as const;

export type PaperPreset = keyof typeof PAPER_PRESETS;
export type PaperOrientation = 'portrait' | 'landscape';

export interface PaperSettings {
  preset: PaperPreset;
  orientation: PaperOrientation;
  margin: number;
  width: number;
  height: number;
  globalStrokeWidth: number;
  globalColorOverride: boolean;
  globalColor: string;
  canvasColor: string;
}

export type ShapeType = 'rectangle' | 'ellipse' | 'polygon' | 'line' | 'polyline' | 'group';

export interface BaseShape {
  id: string;
  name?: string;
  type: ShapeType;
  x: number;
  y: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
  strokeWidth: number;
  color: string;
  groupId?: string;
  isHole?: boolean;
}

export interface RectangleShape extends BaseShape {
  type: 'rectangle';
  width: number;
  height: number;
  cornerRadius?: number;
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse';
  radiusX: number;
  radiusY: number;
}

export interface PolygonShape extends BaseShape {
  type: 'polygon';
  radius: number;
  sides: number;
  cornerRadius?: number;
}

export interface LineShape extends BaseShape {
  type: 'line';
  width: number;
  height: 0;
}

export interface PolylineShape extends BaseShape {
  type: 'polyline';
  points: { x: number; y: number }[];
  // NEW: Support for holes (arrays of point arrays)
  holes?: { x: number; y: number }[][];
  cornerRadius?: number;
}

export interface GroupShape extends BaseShape {
  type: 'group';
  childrenIds: string[];
  width: number;
  height: number;
}

export type Shape = RectangleShape | EllipseShape | PolygonShape | LineShape | PolylineShape | GroupShape;

export interface HatchParams {
  enabled: boolean;
  density: number;
  angle: number;
  offset: number;
  originX: number;
  originY: number;
  gradientEnabled: boolean;
  gradientStart: number;
  gradientEnd: number;
  gradientAngle: number;
  crossHatchEnabled: boolean;
  crossHatchAngle: number;
  crossHatchPerpendicular: boolean;
  zigZagEnabled: boolean;
  spaceMode: 'local' | 'world';
  renderOutline: boolean;
  fillRule: 'nonzero' | 'evenodd';
}

export interface ViewTransform {
  centerX: number;
  centerY: number;
  scale: number;
}

export type ToolType = 'select' | 'direct_select' | 'rectangle' | 'ellipse' | 'polygon' | 'line' | 'eyedropper';

export interface EyedropperMode {
  copyColor: boolean;
  copyStroke: boolean;
  copyHatch: boolean;
}

export interface StateSnapshot {
  paper: PaperSettings;
  shapes: Shape[];
  selectedShapeIds: string[];
  viewTransform: ViewTransform;
  hatchParams: Record<string, HatchParams>;
  tool: ToolType;
  snapping: {
    grid: boolean;
    centers: boolean;
    bounds: boolean;
    gridSize: number;
  };
}

export interface SavedProject {
  id: string;
  name: string;
  date: number; 
  data: StateSnapshot;
  thumbnail?: string;
}

export interface ProjectState extends StateSnapshot {
  history: {
    past: StateSnapshot[];
    present: StateSnapshot;
    future: StateSnapshot[];
  };
}
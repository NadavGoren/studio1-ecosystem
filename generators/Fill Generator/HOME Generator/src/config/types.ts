/**
 * Canvas size presets following ISO 216 standard
 */
export type CanvasSizePreset = "A2" | "A3" | "A4" | "A5" | "CUSTOM";

/**
 * Canvas orientation
 */
export type Orientation = "portrait" | "landscape";

/**
 * Canvas configuration in millimeters
 */
export interface CanvasConfig {
  preset: CanvasSizePreset;
  widthMm: number;   // used when preset === "CUSTOM"
  heightMm: number;  // used when preset === "CUSTOM"
  orientation: Orientation;
  marginMm: number;  // Drawing boundary margin
}

/**
 * Emotional/archetypal mood affecting house appearance
 */
export type HomeMood = "cozy" | "temporary" | "fortress" | "minimal" | "playful";

/**
 * Pen role for organizing drawing layers and element-specific colors
 */
export type PenRole = 
  // Base elements
  | "house_body"    // House walls
  | "roof"          // Roof
  | "door"          // Door
  | "window"        // Windows
  | "tree"          // Trees
  | "grass"         // Grass patches
  | "flower"        // Flowers
  | "sun"           // Sun/moon
  | "cloud"         // Clouds
  | "sky"           // Sky band
  | "ground"        // Ground line
  | "path"          // Path to door
  | "dog"           // Dog
  | "human"         // Human figure
  // Shading and accents for house body
  | "house_body_light"  // Light accent for house body
  | "house_body_shade"  // Dark shade for house body
  | "house_body_texture" // Siding texture
  // Shading and accents for roof
  | "roof_tile"     // Roof tiles/shingles
  | "roof_shade"    // Dark shade for roof
  | "roof_light"    // Light accent for roof
  | "chimney"       // Chimney
  // Window details
  | "window_frame"  // Window frame
  | "window_crossbar" // Window crossbars (brown)
  | "window_shutter" // Window shutters
  | "window_sill"   // Window sill
  | "window_curtain" // Window curtains
  // Door details
  | "door_panel"    // Door panels
  | "door_shade"    // Dark shade for door
  | "door_light"    // Light accent for door
  | "door_frame"    // Door frame
  // Tree details
  | "tree_trunk"    // Tree trunk (separate from foliage)
  | "tree_shade"    // Dark shade for tree
  | "tree_light"    // Light accent for tree
  // New secondary elements
  | "bird"          // Birds in sky
  | "butterfly"     // Butterflies
  | "bush"          // Bushes
  | "fence"         // Fence
  | "mailbox"       // Mailbox
  | "rock"          // Rocks
  | "sunflower"     // Sunflowers (yellow flower)
  | "sunflower_stem" // Sunflower stems (green)
  | "sunflower_center" // Sunflower center (black)
  // Generic fallbacks (backward compatibility)
  | "outline"       // Generic outline
  | "detail"        // Generic detail
  | "background";   // Generic background

/**
 * Pen configuration for plotter output
 */
export interface PenConfig {
  name: string;
  strokeWidthMm: number;
  colorHex: string;        // for preview only
  role: PenRole;
}

/**
 * Home style configuration
 */
export interface HomeStyleConfig {
  mood: HomeMood;
  
  // Structural proportions (relative to canvas)
  houseWidthRatio: number;   // 0-1 of canvas width
  houseHeightRatio: number;  // 0-1 of canvas height
  roofHeightRatio: number;   // portion of house height
  cornerRadiusMm: number;    // for "softer" houses
  
  // Window / door layout
  windowCount: number;       // 0-4
  windowWidthRatio: number;
  windowHeightRatio: number;
  doorWidthRatio: number;
  doorHeightRatio: number;
  asymmetryFactor: number;   // how off-center windows/door can be
  
  // Line "character"
  jitterMm: number;          // 0 = perfect straight, >0 = hand-drawn feel
  lineBreakProbability: number; // small chance to break strokes for "fragility"
}

/**
 * Sky category configuration
 */
export interface SkyElementConfig {
  density: number;           // 0-1: affects cloud count, bird count
  sizeMultiplier: number;    // 0.5-2.0: scales all sky elements uniformly
  spreadHorizontal: number;  // 0-1: horizontal distribution randomness
  spreadVertical: number;    // 0-1: vertical distribution randomness
  jitterIntensity: number;   // 0-3: category-specific jitter (supplements global)
}

/**
 * Ground category configuration
 */
export interface GroundElementConfig {
  density: number;           // 0-1: affects tree count, bush count, flower count
  sizeMultiplier: number;    // 0.5-2.0: scales all ground elements uniformly
  scatterRadius: number;     // 0-50: how far from house elements can appear (mm)
  jitterIntensity: number;   // 0-3: category-specific jitter
}

/**
 * House category configuration
 */
export interface HouseElementConfig {
  brickDensity: number;      // 0-2: siding/brick line density
  tileDensity: number;       // 0-2: roof tile density
  detailLevel: number;       // 0-1: controls window frames, door panels, etc.
  jitterIntensity: number;   // 0-3: category-specific jitter for house edges
}

/**
 * Environment elements configuration
 */
export interface EnvironmentConfig {
  showGroundLine: boolean;
  showPath: boolean;
  showTree: boolean;
  showDog: boolean;
  showHuman: boolean;
  showSkyBand: boolean;
  showSunOrMoon: boolean;
  showClouds: boolean;
  showBirds: boolean;
  showFlowers: boolean;
  showRocks: boolean;
  showBushes: boolean;
  showFence: boolean;
  skyBandHeightRatio: number; // 0-1 of canvas height
  elementDensity: number;      // how many small details are allowed (0-1)
  skyFillDensity: number;      // density of infill lines in sky (0-2)
  groundFillDensity: number;   // density of infill lines in ground (0-2)
  fillPatternRandomness: number; // 0 = clean/patterned, 1 = messy/random (angle variation)
  
  // House element visibility
  showBricks: boolean;
  showTiles: boolean;
  showWindows: boolean;
  showDoorDetails: boolean;
  
  // Category configurations
  skyElements: SkyElementConfig;
  groundElements: GroundElementConfig;
  houseElements: HouseElementConfig;
}

/**
 * Master configuration for the HOME Generator
 */
export interface HomeGeneratorConfig {
  canvas: CanvasConfig;
  style: HomeStyleConfig;
  environment: EnvironmentConfig;
  pens: PenConfig[];
  randomSeed: number;
  globalStrokeWidthMm: number; // Overrides individual pen widths
}

/**
 * 2D Point in millimeters
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Rectangle bounds in millimeters
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Path data grouped by pen role
 */
export interface PathGroup {
  role: PenRole;
  paths: string[];
  pen: PenConfig;
}


import type { 
  CanvasConfig, 
  HomeStyleConfig, 
  EnvironmentConfig, 
  PenConfig,
  HomeGeneratorConfig,
  HomeMood,
  SkyElementConfig,
  GroundElementConfig,
  HouseElementConfig
} from './types';
import { generateColorPalette, lightenColor, darkenColor } from '../utils/colors';

/**
 * Standard ISO 216 paper dimensions in millimeters
 */
export const PAPER_SIZES = {
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 }
} as const;

/**
 * Default canvas configuration (A3 landscape)
 */
export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  preset: 'A3',
  widthMm: 297,
  heightMm: 420,
  orientation: 'landscape',
  marginMm: 15
};

/**
 * Default pen configurations with specific colors for each element
 * All use 0.4mm stroke width for single-pen plotting
 */
export const DEFAULT_PENS: PenConfig[] = [
  // Sky elements (order matters: sky lines render first/behind, then sun, then clouds)
  {
    name: 'Sky',
    strokeWidthMm: 0.4,
    colorHex: '#87CEEB',  // Sky blue
    role: 'sky'
  },
  {
    name: 'Sun',
    strokeWidthMm: 0.4,
    colorHex: '#FFD700',  // Gold/yellow
    role: 'sun'
  },
  {
    name: 'Cloud',
    strokeWidthMm: 0.4,
    colorHex: '#E0E0E0',  // Light gray
    role: 'cloud'
  },

  // Ground elements
  {
    name: 'Ground',
    strokeWidthMm: 0.4,
    colorHex: '#8B7355',  // Tan/earth
    role: 'ground'
  },
  {
    name: 'Path',
    strokeWidthMm: 0.4,
    colorHex: '#A9A9A9',  // Dark gray
    role: 'path'
  },

  // House elements - base colors
  {
    name: 'House Body',
    strokeWidthMm: 0.4,
    colorHex: '#8B4513',  // Brown
    role: 'house_body'
  },
  {
    name: 'House Body Light',
    strokeWidthMm: 0.4,
    colorHex: lightenColor('#8B4513', 0.25),  // Light brown
    role: 'house_body_light'
  },
  {
    name: 'House Body Shade',
    strokeWidthMm: 0.4,
    colorHex: darkenColor('#8B4513', 0.25),  // Dark brown
    role: 'house_body_shade'
  },
  {
    name: 'House Body Texture',
    strokeWidthMm: 0.3,
    colorHex: darkenColor('#8B4513', 0.15),  // Medium brown for siding
    role: 'house_body_texture'
  },
  {
    name: 'Roof',
    strokeWidthMm: 0.4,
    colorHex: '#DC143C',  // Red
    role: 'roof'
  },
  {
    name: 'Roof Tile',
    strokeWidthMm: 0.4,
    colorHex: '#DC143C',  // Same red as roof body for color consistency
    role: 'roof_tile'
  },
  {
    name: 'Roof Shade',
    strokeWidthMm: 0.4,
    colorHex: darkenColor('#DC143C', 0.3),  // Darker red for shadows
    role: 'roof_shade'
  },
  {
    name: 'Roof Light',
    strokeWidthMm: 0.4,
    colorHex: lightenColor('#DC143C', 0.2),  // Light red for highlights
    role: 'roof_light'
  },
  {
    name: 'Chimney',
    strokeWidthMm: 0.4,
    colorHex: '#654321',  // Dark brown
    role: 'chimney'
  },
  {
    name: 'Door',
    strokeWidthMm: 0.4,
    colorHex: '#654321',  // Dark brown
    role: 'door'
  },
  {
    name: 'Door Panel',
    strokeWidthMm: 0.4,
    colorHex: darkenColor('#654321', 0.2),  // Darker for panels
    role: 'door_panel'
  },
  {
    name: 'Door Shade',
    strokeWidthMm: 0.4,
    colorHex: darkenColor('#654321', 0.3),  // Darker for shadows
    role: 'door_shade'
  },
  {
    name: 'Door Light',
    strokeWidthMm: 0.4,
    colorHex: lightenColor('#654321', 0.2),  // Lighter for highlights
    role: 'door_light'
  },
  {
    name: 'Door Frame',
    strokeWidthMm: 0.4,
    colorHex: '#8B4513',  // Brown frame
    role: 'door_frame'
  },
  {
    name: 'Window',
    strokeWidthMm: 0.4,
    colorHex: '#1A1A1A',  // Very dark gray/near black for visibility
    role: 'window'
  },
  {
    name: 'Window Frame',
    strokeWidthMm: 0.4,
    colorHex: '#654321',  // Dark brown frame
    role: 'window_frame'
  },
  {
    name: 'Window Crossbar',
    strokeWidthMm: 0.4,
    colorHex: '#654321',  // Dark brown (same as door)
    role: 'window_crossbar'
  },
  {
    name: 'Window Shutter',
    strokeWidthMm: 0.4,
    colorHex: '#8B4513',  // Brown shutters
    role: 'window_shutter'
  },
  {
    name: 'Window Sill',
    strokeWidthMm: 0.4,
    colorHex: '#8B7355',  // Tan sill
    role: 'window_sill'
  },
  {
    name: 'Window Curtain',
    strokeWidthMm: 0.3,
    colorHex: '#F5F5DC',  // Beige/cream curtains (more neutral)
    role: 'window_curtain'
  },
  
  // Nature elements
  {
    name: 'Tree',
    strokeWidthMm: 0.4,
    colorHex: '#228B22',  // Forest green
    role: 'tree'
  },
  {
    name: 'Tree Trunk',
    strokeWidthMm: 0.4,
    colorHex: '#8B4513',  // Brown trunk
    role: 'tree_trunk'
  },
  {
    name: 'Tree Shade',
    strokeWidthMm: 0.4,
    colorHex: darkenColor('#228B22', 0.25),  // Dark green
    role: 'tree_shade'
  },
  {
    name: 'Tree Light',
    strokeWidthMm: 0.4,
    colorHex: lightenColor('#228B22', 0.2),  // Light green
    role: 'tree_light'
  },
  {
    name: 'Grass',
    strokeWidthMm: 0.4,
    colorHex: '#7CFC00',  // Lawn green
    role: 'grass'
  },
  {
    name: 'Flower',
    strokeWidthMm: 0.4,
    colorHex: '#FF69B4',  // Hot pink
    role: 'flower'
  },
  {
    name: 'Dog',
    strokeWidthMm: 0.4,
    colorHex: '#8B4513',  // Brown
    role: 'dog'
  },
  {
    name: 'Human',
    strokeWidthMm: 0.4,
    colorHex: '#000000',  // Black
    role: 'human'
  },
  // New secondary elements
  {
    name: 'Bird',
    strokeWidthMm: 0.4,
    colorHex: '#000000',  // Black birds
    role: 'bird'
  },
  {
    name: 'Butterfly',
    strokeWidthMm: 0.4,
    colorHex: '#FF1493',  // Deep pink
    role: 'butterfly'
  },
  {
    name: 'Bush',
    strokeWidthMm: 0.4,
    colorHex: '#228B22',  // Forest green
    role: 'bush'
  },
  {
    name: 'Fence',
    strokeWidthMm: 0.4,
    colorHex: '#8B7355',  // Tan
    role: 'fence'
  },
  {
    name: 'Mailbox',
    strokeWidthMm: 0.4,
    colorHex: '#DC143C',  // Red
    role: 'mailbox'
  },
  {
    name: 'Rock',
    strokeWidthMm: 0.4,
    colorHex: '#696969',  // Dim gray
    role: 'rock'
  },
  {
    name: 'Sunflower',
    strokeWidthMm: 0.4,
    colorHex: '#FFD700',  // Yellow for flower
    role: 'sunflower'
  },
  {
    name: 'Sunflower Stem',
    strokeWidthMm: 0.4,
    colorHex: '#228B22',  // Forest green for stem
    role: 'sunflower_stem'
  },
  {
    name: 'Sunflower Center',
    strokeWidthMm: 0.4,
    colorHex: '#000000',  // Black for center
    role: 'sunflower_center'
  },
  
  // Generic fallbacks
  {
    name: 'Outline',
    strokeWidthMm: 0.4,
    colorHex: '#000000',
    role: 'outline'
  },
  {
    name: 'Detail',
    strokeWidthMm: 0.4,
    colorHex: '#333333',
    role: 'detail'
  },
  {
    name: 'Background',
    strokeWidthMm: 0.4,
    colorHex: '#666666',
    role: 'background'
  }
];

/**
 * Maps mood to default style parameters
 */
export function getMoodDefaults(mood: HomeMood): Partial<HomeStyleConfig> {
  switch (mood) {
    case 'cozy':
      return {
        mood,
        houseWidthRatio: 0.45,
        houseHeightRatio: 0.35,
        roofHeightRatio: 0.4,
        cornerRadiusMm: 3,
        windowCount: 3,
        windowWidthRatio: 0.15,
        windowHeightRatio: 0.18,
        doorWidthRatio: 0.18,
        doorHeightRatio: 0.35,
        asymmetryFactor: 0.05,
        jitterMm: 2.5,  // Increased for more sketchy kid-drawing look
        lineBreakProbability: 0.01
      };
    
    case 'temporary':
      return {
        mood,
        houseWidthRatio: 0.35,
        houseHeightRatio: 0.3,
        roofHeightRatio: 0.3,
        cornerRadiusMm: 0,
        windowCount: 1,
        windowWidthRatio: 0.2,
        windowHeightRatio: 0.2,
        doorWidthRatio: 0.2,
        doorHeightRatio: 0.4,
        asymmetryFactor: 0.15,
        jitterMm: 2.5,
        lineBreakProbability: 0.08
      };
    
    case 'fortress':
      return {
        mood,
        houseWidthRatio: 0.55,
        houseHeightRatio: 0.4,
        roofHeightRatio: 0.25,
        cornerRadiusMm: 0,
        windowCount: 2,
        windowWidthRatio: 0.08,
        windowHeightRatio: 0.12,
        doorWidthRatio: 0.15,
        doorHeightRatio: 0.3,
        asymmetryFactor: 0.02,
        jitterMm: 2.5,  // Increased for kid-drawing style while maintaining structure
        lineBreakProbability: 0
      };
    
    case 'minimal':
      return {
        mood,
        houseWidthRatio: 0.4,
        houseHeightRatio: 0.35,
        roofHeightRatio: 0.35,
        cornerRadiusMm: 0,
        windowCount: 2,
        windowWidthRatio: 0.12,
        windowHeightRatio: 0.15,
        doorWidthRatio: 0.16,
        doorHeightRatio: 0.32,
        asymmetryFactor: 0,
        jitterMm: 0,
        lineBreakProbability: 0
      };
    
    case 'playful':
      return {
        mood,
        houseWidthRatio: 0.5,
        houseHeightRatio: 0.38,
        roofHeightRatio: 0.5,
        cornerRadiusMm: 5,
        windowCount: 4,
        windowWidthRatio: 0.13,
        windowHeightRatio: 0.16,
        doorWidthRatio: 0.2,
        doorHeightRatio: 0.38,
        asymmetryFactor: 0.12,
        jitterMm: 2.5,  // Increased for playful, more wobbly kid-drawing style
        lineBreakProbability: 0.02
      };
  }
}

/**
 * Default home style configuration
 */
export const DEFAULT_STYLE_CONFIG: HomeStyleConfig = {
  ...getMoodDefaults('cozy')
} as HomeStyleConfig;

/**
 * Default sky category configuration
 */
export const DEFAULT_SKY_CONFIG: SkyElementConfig = {
  density: 0.85,
  sizeMultiplier: 1.0,
  spreadHorizontal: 0.8,
  spreadVertical: 0.6,
  jitterIntensity: 2.5
};

/**
 * Default ground category configuration
 */
export const DEFAULT_GROUND_CONFIG: GroundElementConfig = {
  density: 0.85,
  sizeMultiplier: 1.0,
  scatterRadius: 30,
  jitterIntensity: 2.5
};

/**
 * Default house category configuration
 */
export const DEFAULT_HOUSE_CONFIG: HouseElementConfig = {
  brickDensity: 1.0,
  tileDensity: 1.0,
  detailLevel: 1.0,
  jitterIntensity: 2.5
};

/**
 * Default environment configuration
 */
export const DEFAULT_ENVIRONMENT_CONFIG: EnvironmentConfig = {
  showGroundLine: true,
  showPath: true,
  showTree: true,
  showDog: true,
  showHuman: true,
  showSkyBand: true,
  showSunOrMoon: true,
  showClouds: true,
  showBirds: true,
  showFlowers: true,
  showRocks: true,
  showBushes: true,
  showFence: true,
  skyBandHeightRatio: 0.35,
  elementDensity: 0.85,  // Increased baseline density for fuller scenes
  skyFillDensity: 1.2,   // Default sky infill density
  groundFillDensity: 1.4, // Default ground infill density
  fillPatternRandomness: 0.05, // Default to clean pattern (0=clean, 1=messy)
  
  // House element visibility
  showBricks: true,
  showTiles: true,
  showWindows: true,
  showDoorDetails: true,
  
  // Category configurations
  skyElements: DEFAULT_SKY_CONFIG,
  groundElements: DEFAULT_GROUND_CONFIG,
  houseElements: DEFAULT_HOUSE_CONFIG
};

/**
 * Default complete generator configuration
 */
export const DEFAULT_CONFIG: HomeGeneratorConfig = {
  canvas: DEFAULT_CANVAS_CONFIG,
  style: DEFAULT_STYLE_CONFIG,
  environment: DEFAULT_ENVIRONMENT_CONFIG,
  pens: DEFAULT_PENS,
  randomSeed: 12345,
  globalStrokeWidthMm: 0.4
};


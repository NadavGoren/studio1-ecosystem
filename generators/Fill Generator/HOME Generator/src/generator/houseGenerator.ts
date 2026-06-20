import type { HomeGeneratorConfig, PathGroup, Point, PenRole } from '../config/types';
import { SeededRNG } from '../utils/rng';
import { resolveCanvasDimensions } from '../utils/canvas';
import { clipPathAgainstTriangle, clipPathInsideTriangle, clipPathAgainstPolygon, clipPathInsideRect, addRandomSlope, pointsToPath, makeIrregularPolygon, applyLineJitter, subdivideLine } from '../utils/math';
import { 
  drawRect, 
  drawTriangleRoof, 
  drawWindow, 
  drawDoor,
  drawWindowFrame,
  drawWindowCrossbars,
  drawWindowSill,
  drawWindowCurtains,
  drawDoorPanels,
  drawDoorFrame,
  drawDoorThreshold,
  drawRoofTiles,
  drawRoofOverhang,
  drawRoofRidge,
  drawHouseSiding,
  drawCornerDetails,
  drawFoundation
} from '../geometry/primitives';
import { 
  drawDogIcon, 
  drawTreeIcon, 
  drawSunOrMoon, 
  drawPathToDoor, 
  drawGroundLine,
  drawGroundFill,
  drawSkyBand,
  drawGrassPatch,
  drawFlower,
  drawCloud,
  drawBird,
  drawButterfly,
  drawBush,
  drawFence,
  drawRock,
  drawSunflower,
  drawHumanIcon
} from '../geometry/environment';
import { drawHatching } from '../utils/math';

/**
 * Simple circle for collision detection
 */
interface CollisionCircle {
  x: number;
  y: number;
  radius: number;
}

/**
 * Main generator class for creating house compositions
 */
export class HouseGenerator {
  private config: HomeGeneratorConfig;
  private rng: SeededRNG;
  private canvasWidth: number;
  private canvasHeight: number;
  private pathGroups: Map<PenRole, string[]>;
  
  // Collision detection
  private obstacles: CollisionCircle[] = [];
  
  // Roof triangle for sky clipping
  private roofTriangle: [Point, Point, Point] | null = null;
  
  // Sun bounds for cloud collision detection
  private sunBounds: { x: number; y: number; radius: number } | null = null;
  
  // Window and door rectangles for clipping house bricks
  private windowRectangles: Array<{ x: number; y: number; width: number; height: number }> = [];
  private doorRectangle: { x: number; y: number; width: number; height: number } | null = null;
  
  // House bounds for sky clipping
  private houseBounds: { x: number; y: number; width: number; height: number } | null = null;

  constructor(config: HomeGeneratorConfig) {
    // Ensure safe defaults for missing parameters
    this.config = {
      ...config,
      canvas: {
        ...config.canvas,
        marginMm: config.canvas?.marginMm ?? 15,
        widthMm: config.canvas?.widthMm ?? 210,
        heightMm: config.canvas?.heightMm ?? 297,
      },
      style: {
        ...config.style,
        jitterMm: config.style?.jitterMm ?? 0.3,
      },
      environment: {
        ...config.environment,
        elementDensity: config.environment?.elementDensity ?? 0.85,
        skyBandHeightRatio: config.environment?.skyBandHeightRatio ?? 0.3,
      },
      globalStrokeWidthMm: config.globalStrokeWidthMm ?? 0.5,
      randomSeed: config.randomSeed ?? 12345,
    };
    this.rng = new SeededRNG(this.config.randomSeed);
    
    const dimensions = resolveCanvasDimensions(this.config.canvas);
    this.canvasWidth = dimensions.widthMm;
    this.canvasHeight = dimensions.heightMm;
    
    // Validate canvas setup for debugging
    const margin = this.config.canvas.marginMm || 0;
    console.log(`Canvas Setup:
      Canvas: ${this.canvasWidth}mm × ${this.canvasHeight}mm
      Margin: ${margin}mm
      Drawable Area: ${this.canvasWidth - 2 * margin}mm × ${this.canvasHeight - 2 * margin}mm
      Left Margin: ${margin}mm, Right Boundary: ${this.canvasWidth - margin}mm
      Center X: ${this.canvasWidth / 2}mm`);
    
    this.pathGroups = new Map();
    for (const pen of this.config.pens) {
      this.pathGroups.set(pen.role, []);
    }
  }

  /**
   * Generates the complete house composition
   */
  generate(): PathGroup[] {
    // Clear previous paths and obstacles
    for (const role of this.pathGroups.keys()) {
      this.pathGroups.set(role, []);
    }
    this.obstacles = [];
    this.roofTriangle = null;
    this.sunBounds = null;
    this.windowRectangles = [];
    this.doorRectangle = null;
    this.houseBounds = null;

    // Generate in order: background → house → details → environment
    // Generate sky first (will be clipped later)
    this.generateBackground();
    const houseBounds = this.generateHouse();
    this.houseBounds = houseBounds; // Store for sky clipping
    this.generateEnvironment(houseBounds);
    
    // Apply roof clipping to all upper-canvas elements if roof exists
    if (this.roofTriangle) {
      // Clip sky paths against roof triangle (sky behind roof)
      this.clipSkyAgainstRoof();
      
      // Clip clouds against roof (clouds must not appear behind roof)
      this.clipElementAgainstRoof('cloud');
      
      // Clip birds against roof (birds must not appear behind roof)
      this.clipElementAgainstRoof('bird');
    }
    
    // Clip sky against house so sky doesn't appear behind house
    if (this.houseBounds) {
      this.clipSkyAgainstHouse();
    }
    
    // Ensure sun renders in front of sky by clipping sky around sun
    // Then re-render sun to ensure it appears on top
    this.ensureSunInFront();
    this.ensureSunOnTop();

    // CRITICAL: Clip ALL paths to margin boundaries to prevent bleeding
    this.clipAllPathsToMargins();

    // Convert to PathGroup array
    return this.getPathGroups();
  }

  /**
   * Generates background elements (sky band)
   */
  private generateBackground(): void {
    const { environment, style, canvas } = this.config;
    const margin = canvas.marginMm || 0;
    const drawWidth = this.canvasWidth - 2 * margin;
    
    // Use scale based on min dimension to maintain proportions
    const scale = Math.min(drawWidth, this.canvasHeight - 2 * margin);

    if (environment.showSkyBand) {
      const skyHeight = (this.canvasHeight - 2 * margin) * environment.skyBandHeightRatio;
      const paths = drawSkyBand(
        margin, 
        margin, 
        drawWidth, 
        skyHeight,
        style.jitterMm * 0.5,
        environment.skyFillDensity,
        environment.fillPatternRandomness,
        this.rng
      );
      this.addPaths('sky', paths);
    }

    // Sun or moon (bigger for childish look)
    // Note: Sun will be re-rendered after sky clipping to ensure it's on top
    // This initial render is stored and will be replaced in ensureSunOnTop()
    if (environment.showSunOrMoon) {
      // Get sky height for sun placement constraints
      const skyHeight = (this.canvasHeight - 2 * margin) * environment.skyBandHeightRatio;
      const skyTopY = margin;
      const skyBottomY = margin + skyHeight;
      
      const sunRadius = scale * 0.08 * environment.skyElements.sizeMultiplier;
      // Calculate sun ray length (0.7 * radius) and ensure sun stays within margins
      const rayLength = sunRadius * 0.7;
      const sunEffectiveRadius = sunRadius + rayLength; // Total space needed
      const sunX = Math.max(
        margin + sunEffectiveRadius + 0.5,
        Math.min(
          this.canvasWidth - margin - sunEffectiveRadius - 0.5,
          margin + drawWidth * 0.85
        )
      );
      // Constrain sun Y to be within sky band
      const preferredSunY = margin + (this.canvasHeight - 2 * margin) * 0.12;
      const sunY = Math.max(
        skyTopY + sunEffectiveRadius + 0.5,
        Math.min(
          skyBottomY - sunEffectiveRadius - 0.5,
          preferredSunY
        )
      );
      const effectiveSkyJitter = style.jitterMm * 0.3 + environment.skyElements.jitterIntensity * 0.3;
      
      // Store sun bounds for cloud collision detection
      // Ray length is sunRadius * 0.7, so effective radius includes rays
      this.sunBounds = {
        x: sunX,
        y: sunY,
        radius: sunEffectiveRadius
      };
      
      // Always show rays (always pass true for addRays)
      const paths = drawSunOrMoon(
        sunX,
        sunY,
        sunRadius,
        true, // Always show rays
        effectiveSkyJitter,
        this.rng
      );
      this.addPaths('sun', paths);
    }

    // Store cloud positions for sky clipping and collision detection
    const cloudPositions: Array<{ x: number; y: number; width: number; height: number; radius: number; outlinePoints: Point[] }> = [];
    const minCloudGap = 4; // Minimum gap between clouds (3-5mm)
    const roofBufferZone = 10; // Buffer zone between clouds and roof (5-10mm)

    // Add clouds with collision detection
    if (environment.showClouds && environment.skyElements.density > 0.2) {
      // Get sky height for cloud placement constraints
      const skyHeight = (this.canvasHeight - 2 * margin) * environment.skyBandHeightRatio;
      const skyTopY = margin;
      const skyBottomY = margin + skyHeight;
      
      const baseCloudCount = this.rng.randomInt(3, 6); // Increased count
      const cloudCount = Math.round(baseCloudCount * environment.skyElements.density);
      const maxAttempts = cloudCount * 10; // Try many times to place clouds
      let cloudsPlaced = 0;
      
      // Get roof base Y if roof exists (for collision avoidance)
      const roofBaseY = this.roofTriangle ? 
        Math.max(this.roofTriangle[0].y, this.roofTriangle[2].y) : 
        this.canvasHeight;
      
      for (let attempt = 0; attempt < maxAttempts && cloudsPlaced < cloudCount; attempt++) {
        const cloudWidth = scale * this.rng.randomRange(0.12, 0.20) * environment.skyElements.sizeMultiplier;
        const cloudHeight = cloudWidth * this.rng.randomRange(0.5, 0.7);
        const cloudRadius = Math.max(cloudWidth, cloudHeight) / 2 + minCloudGap;
        // Ensure cloud stays within margins
        const cloudX = Math.max(
          margin + cloudRadius + 0.5,
          Math.min(
            this.canvasWidth - margin - cloudRadius - 0.5,
            margin + drawWidth * this.rng.randomRange(0.1, 0.9)
          )
        );
        // Constrain cloud Y to be within sky band
        const preferredCloudY = margin + (this.canvasHeight - 2 * margin) * this.rng.randomRange(0.1, 0.25);
        const cloudY = Math.max(
          skyTopY + cloudHeight / 2 + 0.5,
          Math.min(
            skyBottomY - cloudHeight / 2 - 0.5,
            preferredCloudY
          )
        );
        
        // Check if cloud would overlap roof (with buffer zone)
        if (cloudY + cloudHeight > roofBaseY - roofBufferZone) {
          continue; // Skip this cloud, too close to roof
        }
        
        // Check collision with sun (including rays and margin)
        if (this.sunBounds) {
          const sunMargin = 5; // Minimum gap between cloud and sun
          const cloudCenterX = cloudX;
          const cloudCenterY = cloudY + cloudHeight / 2;
          const distToSun = Math.sqrt(
            Math.pow(cloudCenterX - this.sunBounds.x, 2) + 
            Math.pow(cloudCenterY - this.sunBounds.y, 2)
          );
          if (distToSun < this.sunBounds.radius + cloudRadius + sunMargin) {
            continue; // Skip this cloud, too close to sun
          }
        }
        
        // Check collision with existing clouds
        let hasCollision = false;
        for (const existingCloud of cloudPositions) {
          const dist = Math.sqrt(
            Math.pow(cloudX - existingCloud.x, 2) + 
            Math.pow(cloudY - existingCloud.y, 2)
          );
          if (dist < cloudRadius + existingCloud.radius) {
            hasCollision = true;
            break;
          }
        }
        
        if (!hasCollision) {
          const effectiveSkyJitter = style.jitterMm * 0.5 + environment.skyElements.jitterIntensity * 0.5;
          const cloudResult = drawCloud(
            cloudX,
            cloudY,
            cloudWidth,
            effectiveSkyJitter,
            this.rng
          );
          this.addPaths('cloud', cloudResult.paths);
          
          // Store cloud position with outline points for sky clipping
          cloudPositions.push({ 
            x: cloudX, 
            y: cloudY, 
            width: cloudWidth, 
            height: cloudHeight,
            radius: cloudRadius,
            outlinePoints: cloudResult.outlinePoints
          });
          cloudsPlaced++;
        }
      }
    }

    // Clip sky around clouds with margin
    if (environment.showSkyBand && cloudPositions.length > 0) {
      this.clipSkyAroundClouds(cloudPositions);
    }
    
    // Clip clouds against sun to ensure no intersection
    if (this.sunBounds && cloudPositions.length > 0) {
      this.clipCloudsAgainstSun();
    }

    // Add birds in sky
    if (environment.showBirds && environment.skyElements.density > 0.3) {
      const baseBirdCount = this.rng.randomInt(3, 7); // Increased count
      const birdCount = Math.round(baseBirdCount * environment.skyElements.density);
      const effectiveSkyJitter = style.jitterMm * 0.5 + environment.skyElements.jitterIntensity * 0.5;
      
      // Get sky height for bird placement constraints
      const skyHeight = (this.canvasHeight - 2 * margin) * environment.skyBandHeightRatio;
      const skyTopY = margin;
      const skyBottomY = margin + skyHeight;
      
      for (let i = 0; i < birdCount; i++) {
        const birdSize = scale * this.rng.randomRange(0.06, 0.12) * environment.skyElements.sizeMultiplier * 0.85; // 15% smaller
        // Ensure bird stays within margins (birds have wings that extend)
        const birdWingSpan = birdSize * 1.5; // Approximate wing span
        const birdX = Math.max(
          margin + birdWingSpan / 2 + 0.5,
          Math.min(
            this.canvasWidth - margin - birdWingSpan / 2 - 0.5,
            margin + drawWidth * this.rng.randomRange(0.1, 0.9)
          )
        );
        // Place birds within sky band: 20% to 80% of sky height
        const birdYInSky = skyHeight * this.rng.randomRange(0.2, 0.8);
        const birdY = Math.max(
          skyTopY + birdSize + 0.5,
          Math.min(
            skyBottomY - birdSize - 0.5,
            margin + birdYInSky
          )
        );
        
        const paths = drawBird(
          birdX,
          birdY,
          birdSize,
          effectiveSkyJitter,
          this.rng
        );
        this.addPaths('bird', paths);
      }
    }
  }

  /**
   * Generates the main house structure
   * Returns the house bounding box for environment placement
   */
  private generateHouse(): { 
    x: number; 
    y: number; 
    width: number; 
    height: number;
    doorCenterX: number;
    doorBottomY: number;
  } {
    const { style, canvas } = this.config;
    const margin = canvas.marginMm || 0;
    
    const drawWidth = this.canvasWidth - 2 * margin;
    const drawHeight = this.canvasHeight - 2 * margin;
    const scale = Math.min(drawWidth, drawHeight);

    // Calculate house dimensions based on scale to prevent stretching
    // Using the ratios against the unified scale
    const houseWidth = scale * style.houseWidthRatio; 
    const houseHeight = scale * style.houseHeightRatio;
    
    // Position house centered in draw area
    const houseX = margin + (drawWidth - houseWidth) / 2;
    const houseY = margin + drawHeight * 0.45;

    // Add house to obstacles
    this.obstacles.push({
      x: houseX + houseWidth / 2,
      y: houseY + houseHeight / 2,
      radius: Math.max(houseWidth, houseHeight) / 2 + 5 // Add buffer
    });

    // Generate house body
    const { environment } = this.config;
    const effectiveHouseJitter = style.jitterMm + environment.houseElements.jitterIntensity;
    const bodyPaths = drawRect(
      houseX,
      houseY,
      houseWidth,
      houseHeight,
      style.cornerRadiusMm,
      effectiveHouseJitter,
      this.rng
    );
    this.addPaths('house_body', bodyPaths);

    // Calculate door and window positions FIRST (before drawing bricks)
    // so we can clip bricks to avoid them
    const doorWidth = houseWidth * style.doorWidthRatio;
    const doorHeight = houseHeight * style.doorHeightRatio;
    const doorOffsetX = (this.rng.random() - 0.5) * style.asymmetryFactor * houseWidth;
    const doorX = houseX + (houseWidth - doorWidth) / 2 + doorOffsetX;
    const doorY = houseY + houseHeight - doorHeight;
    
    // Store door rectangle for later clipping
    this.doorRectangle = { x: doorX, y: doorY, width: doorWidth, height: doorHeight };
    
    // Calculate window positions (but don't draw them yet)
    const windowCount = style.windowCount;
    const windowWidth = houseWidth * style.windowWidthRatio;
    const windowHeight = houseHeight * style.windowHeightRatio;
    const windowY = houseY + houseHeight * 0.25;
    
    if (environment.showWindows && windowCount > 0) {
      if (windowCount === 1) {
        const windowX = houseX + (houseWidth - windowWidth) / 2;
        this.windowRectangles.push({ x: windowX, y: windowY, width: windowWidth, height: windowHeight });
      } else if (windowCount === 2) {
        const spacing = houseWidth * 0.15;
        this.windowRectangles.push({ x: houseX + spacing, y: windowY, width: windowWidth, height: windowHeight });
        this.windowRectangles.push({ x: houseX + houseWidth - spacing - windowWidth, y: windowY, width: windowWidth, height: windowHeight });
      } else if (windowCount === 3) {
        const spacing = (houseWidth - 3 * windowWidth) / 4;
        for (let i = 0; i < 3; i++) {
          this.windowRectangles.push({ x: houseX + spacing + i * (windowWidth + spacing), y: windowY, width: windowWidth, height: windowHeight });
        }
      } else if (windowCount === 4) {
        const spacingX = (houseWidth - 2 * windowWidth) / 3;
        const spacingY = houseHeight * 0.15;
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 2; col++) {
            const winY = houseY + spacingY + row * (windowHeight + spacingY);
            this.windowRectangles.push({ x: houseX + spacingX + col * (windowWidth + spacingX), y: winY, width: windowWidth, height: windowHeight });
          }
        }
      }
    }

    // Add house body texture (siding) - only if showBricks is true
    if (environment.showBricks) {
      const sidingSpacing = houseHeight * 0.08 / environment.houseElements.brickDensity;
      let sidingPaths = drawHouseSiding(
        houseX,
        houseY,
        houseWidth,
        houseHeight,
        sidingSpacing,
        effectiveHouseJitter,
        this.rng
      );
    
    // Clip brick paths to house rectangle AND exclude windows/doors
    const houseRect = { x: houseX, y: houseY, width: houseWidth, height: houseHeight };
    let clippedSidingPaths: string[] = [];
    
    for (const path of sidingPaths) {
      const clipped = clipPathInsideRect(path, houseRect);
      clippedSidingPaths.push(...clipped);
    }
    
    // Now clip AGAINST windows (exclude window areas)
    for (const window of this.windowRectangles) {
      const windowPolygon: Point[] = [
        { x: window.x, y: window.y },
        { x: window.x + window.width, y: window.y },
        { x: window.x + window.width, y: window.y + window.height },
        { x: window.x, y: window.y + window.height },
        { x: window.x, y: window.y }
      ];
      
      const tempPaths: string[] = [];
      for (const path of clippedSidingPaths) {
        const excluded = clipPathAgainstPolygon(path, windowPolygon);
        tempPaths.push(...excluded);
      }
      clippedSidingPaths = tempPaths;
    }
    
    // Clip AGAINST door (exclude door area)
    if (this.doorRectangle) {
      const doorPolygon: Point[] = [
        { x: this.doorRectangle.x, y: this.doorRectangle.y },
        { x: this.doorRectangle.x + this.doorRectangle.width, y: this.doorRectangle.y },
        { x: this.doorRectangle.x + this.doorRectangle.width, y: this.doorRectangle.y + this.doorRectangle.height },
        { x: this.doorRectangle.x, y: this.doorRectangle.y + this.doorRectangle.height },
        { x: this.doorRectangle.x, y: this.doorRectangle.y }
      ];
      
      const tempPaths: string[] = [];
      for (const path of clippedSidingPaths) {
        const excluded = clipPathAgainstPolygon(path, doorPolygon);
        tempPaths.push(...excluded);
      }
      clippedSidingPaths = tempPaths;
    }
    
    this.addPaths('house_body_texture', clippedSidingPaths);
    }

    // Add corner details
    const cornerPaths = drawCornerDetails(
      houseX,
      houseY,
      houseWidth,
      houseHeight,
      houseWidth * 0.02,
      effectiveHouseJitter,
      this.rng
    );
    this.addPaths('house_body', cornerPaths);

    // Add foundation
    const foundationHeight = houseHeight * 0.05;
    const foundationPaths = drawFoundation(
      houseX,
      houseY + houseHeight,
      houseWidth,
      foundationHeight,
      effectiveHouseJitter,
      this.rng
    );
    this.addPaths('house_body_shade', foundationPaths);

    // Generate roof
    const roofHeight = scale * style.roofHeightRatio; // Scale relative to unit size
    const roofCenterX = houseX + houseWidth / 2;
    // Calculate roof width but ensure it doesn't extend beyond margins
    const maxRoofWidth = Math.min(
      houseWidth * 1.1, // 10% extension beyond house
      drawWidth - 1 // Leave at least 1mm margin buffer
    );
    const roofWidth = Math.min(houseWidth * 1.1, maxRoofWidth);
    
    // Clamp roof position to ensure it stays within margins
    const roofLeftEdge = Math.max(margin + 0.5, roofCenterX - roofWidth / 2);
    const roofRightEdge = Math.min(this.canvasWidth - margin - 0.5, roofCenterX + roofWidth / 2);
    const actualRoofWidth = roofRightEdge - roofLeftEdge;
    const actualRoofCenterX = (roofLeftEdge + roofRightEdge) / 2;
    
    // Store roof triangle coordinates for sky clipping
    // Triangle vertices: bottom-left, top-center, bottom-right
    this.roofTriangle = [
      { x: roofLeftEdge, y: houseY },
      { x: actualRoofCenterX, y: houseY - roofHeight },
      { x: roofRightEdge, y: houseY }
    ];
    
    const roofPaths = drawTriangleRoof(
      actualRoofCenterX,
      houseY,
      actualRoofWidth,
      roofHeight,
      effectiveHouseJitter,
      style.lineBreakProbability,
      this.rng
    );
    this.addPaths('roof', roofPaths);

    // Add roof tiles (will be clipped to triangle) - only if showTiles is true
    if (environment.showTiles) {
      const tileRowSpacing = roofHeight * 0.12 / environment.houseElements.tileDensity;
      const tilePaths = drawRoofTiles(
        actualRoofCenterX,
        houseY,
        actualRoofWidth,
        roofHeight,
        tileRowSpacing,
        effectiveHouseJitter,
        this.rng
      );
    
    // Strictly clip tiles to stay within roof triangle - clip every segment
    if (this.roofTriangle) {
      const clippedTilePaths: string[] = [];
      const [v1, v2, v3] = this.roofTriangle;
      
      for (const tilePath of tilePaths) {
        // Parse path into segments and clip each individually
        const pathMatch = tilePath.match(/M\s+([\d.]+)\s+([\d.]+)((?:\s+L\s+[\d.]+\s+[\d.]+)*)/);
        if (pathMatch && pathMatch[3]) {
          const points: Point[] = [];
          points.push({ x: parseFloat(pathMatch[1]), y: parseFloat(pathMatch[2]) });
          const lineMatches = pathMatch[3].matchAll(/L\s+([\d.]+)\s+([\d.]+)/g);
          for (const match of lineMatches) {
            points.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
          }
          
          // Clip each segment of the tile path and validate
          for (let i = 0; i < points.length - 1; i++) {
            const segPath = pointsToPath([points[i], points[i + 1]], false);
            const clipped = clipPathInsideTriangle(segPath, this.roofTriangle);
            
            // Validate clipped segments - ensure all points are inside triangle
            for (const clippedPath of clipped) {
              const clippedMatch = clippedPath.match(/M\s+([\d.]+)\s+([\d.]+)((?:\s+L\s+[\d.]+\s+[\d.]+)*)/);
              if (clippedMatch) {
                const clippedPoints: Point[] = [];
                clippedPoints.push({ x: parseFloat(clippedMatch[1]), y: parseFloat(clippedMatch[2]) });
                if (clippedMatch[3]) {
                  const clippedLineMatches = clippedMatch[3].matchAll(/L\s+([\d.]+)\s+([\d.]+)/g);
                  for (const match of clippedLineMatches) {
                    clippedPoints.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
                  }
                }
                
                // Validate all points are inside triangle
                let allPointsInside = true;
                for (const pt of clippedPoints) {
                  // Use pointInTriangle check (need to import or use inline)
                  const d1 = (pt.x - v3.x) * (v2.y - v3.y) - (v2.x - v3.x) * (pt.y - v3.y);
                  const d2 = (pt.x - v1.x) * (v3.y - v1.y) - (v3.x - v1.x) * (pt.y - v1.y);
                  const d3 = (pt.x - v2.x) * (v1.y - v2.y) - (v1.x - v2.x) * (pt.y - v2.y);
                  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
                  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
                  if (hasNeg && hasPos) {
                    allPointsInside = false;
                    break;
                  }
                }
                
                if (allPointsInside && clippedPoints.length > 1) {
                  clippedTilePaths.push(clippedPath);
                }
              }
            }
          }
        } else {
          // Fallback: clip entire path and validate
          const clipped = clipPathInsideTriangle(tilePath, this.roofTriangle);
          for (const clippedPath of clipped) {
            const clippedMatch = clippedPath.match(/M\s+([\d.]+)\s+([\d.]+)((?:\s+L\s+[\d.]+\s+[\d.]+)*)/);
            if (clippedMatch) {
              const clippedPoints: Point[] = [];
              clippedPoints.push({ x: parseFloat(clippedMatch[1]), y: parseFloat(clippedMatch[2]) });
              if (clippedMatch[3]) {
                const clippedLineMatches = clippedMatch[3].matchAll(/L\s+([\d.]+)\s+([\d.]+)/g);
                for (const match of clippedLineMatches) {
                  clippedPoints.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
                }
              }
              
              // Validate all points are inside triangle
              let allPointsInside = true;
              for (const pt of clippedPoints) {
                const d1 = (pt.x - v3.x) * (v2.y - v3.y) - (v2.x - v3.x) * (pt.y - v3.y);
                const d2 = (pt.x - v1.x) * (v3.y - v1.y) - (v3.x - v1.x) * (pt.y - v1.y);
                const d3 = (pt.x - v2.x) * (v1.y - v2.y) - (v1.x - v2.x) * (pt.y - v2.y);
                const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
                const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
                if (hasNeg && hasPos) {
                  allPointsInside = false;
                  break;
                }
              }
              
              if (allPointsInside && clippedPoints.length > 1) {
                clippedTilePaths.push(clippedPath);
              }
            }
          }
        }
      }
      this.addPaths('roof_tile', clippedTilePaths);
    } else {
      this.addPaths('roof_tile', tilePaths);
    }
    }

    // Add roof overhang
    const overhangPaths = drawRoofOverhang(
      actualRoofCenterX,
      houseY,
      actualRoofWidth,
      actualRoofWidth * 0.05,
      effectiveHouseJitter,
      this.rng
    );
    this.addPaths('roof', overhangPaths);

    // Add roof ridge
    const ridgePaths = drawRoofRidge(
      actualRoofCenterX,
      houseY,
      roofHeight,
      effectiveHouseJitter,
      this.rng
    );
    this.addPaths('roof_light', ridgePaths);


    // Draw door (position already calculated)
    if (this.doorRectangle) {
      const doorPaths = drawDoor(
        this.doorRectangle.x,
        this.doorRectangle.y,
        this.doorRectangle.width,
        this.doorRectangle.height,
        style.cornerRadiusMm * 0.5,
        effectiveHouseJitter,
        this.rng
      );
      this.addPaths('door', doorPaths);

      // Add door path area to obstacles (approximate)
      this.obstacles.push({
        x: this.doorRectangle.x + this.doorRectangle.width / 2,
        y: this.doorRectangle.y + this.doorRectangle.height + 20,
        radius: 15
      });
    }

    // Draw windows (positions already calculated)
    if (environment.showWindows && this.windowRectangles.length > 0) {
      for (const window of this.windowRectangles) {
        const windowPaths = drawWindow(window.x, window.y, window.width, window.height, true, effectiveHouseJitter, this.rng);
        this.addPaths('window', windowPaths);
      }
    }

    return {
      x: houseX,
      y: houseY,
      width: houseWidth,
      height: houseHeight,
      doorCenterX: this.doorRectangle ? this.doorRectangle.x + this.doorRectangle.width / 2 : houseX + houseWidth / 2,
      doorBottomY: this.doorRectangle ? this.doorRectangle.y + this.doorRectangle.height : houseY + houseHeight
    };
  }

  /**
   * Check for collision with existing obstacles
   */
  private checkCollision(x: number, y: number, radius: number): boolean {
    for (const obs of this.obstacles) {
      const dist = Math.sqrt(Math.pow(x - obs.x, 2) + Math.pow(y - obs.y, 2));
      if (dist < radius + obs.radius) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generates environment elements around the house
   */
  private generateEnvironment(houseBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
    doorCenterX: number;
    doorBottomY: number;
  }): void {
    const { environment, style, canvas } = this.config;
    const margin = canvas.marginMm || 0;
    const drawWidth = this.canvasWidth - 2 * margin;
    const drawHeight = this.canvasHeight - 2 * margin;
    const scale = Math.min(drawWidth, drawHeight);

    // Ground line
    let pathPolygon: Point[] | null = null;
    if (environment.showGroundLine) {
      const groundY = houseBounds.y + houseBounds.height;
      const paths = drawGroundLine(
        margin,
        this.canvasWidth - margin,
        groundY,
        style.jitterMm,
        this.rng
      );
      this.addPaths('ground', paths);
      
      // Path to door (generate before ground fill to create clipping polygon)
      if (environment.showPath) {
        const pathWidth = scale * 0.08;
        const pathPaths = drawPathToDoor(
          this.canvasHeight - margin,
          houseBounds.doorCenterX,
          houseBounds.doorBottomY,
          pathWidth,
          style.jitterMm,
          this.rng
        );
        this.addPaths('path', pathPaths);
        
        // Create path polygon for clipping ground fill
        // Parse path strings to extract points
        const leftEdgeMatch = pathPaths[0].match(/M\s+([\d.]+)\s+([\d.]+)((?:\s+L\s+[\d.]+\s+[\d.]+)*)/);
        const rightEdgeMatch = pathPaths[1].match(/M\s+([\d.]+)\s+([\d.]+)((?:\s+L\s+[\d.]+\s+[\d.]+)*)/);
        
        if (leftEdgeMatch && rightEdgeMatch) {
          const leftPoints: Point[] = [];
          leftPoints.push({ x: parseFloat(leftEdgeMatch[1]), y: parseFloat(leftEdgeMatch[2]) });
          const leftLineMatches = leftEdgeMatch[3].matchAll(/L\s+([\d.]+)\s+([\d.]+)/g);
          for (const match of leftLineMatches) {
            leftPoints.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
          }
          
          const rightPoints: Point[] = [];
          rightPoints.push({ x: parseFloat(rightEdgeMatch[1]), y: parseFloat(rightEdgeMatch[2]) });
          const rightLineMatches = rightEdgeMatch[3].matchAll(/L\s+([\d.]+)\s+([\d.]+)/g);
          for (const match of rightLineMatches) {
            rightPoints.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
          }
          
          // Create polygon: left edge (top to bottom) + bottom line + right edge (bottom to top) + top line
          pathPolygon = [
            ...leftPoints,
            ...rightPoints.reverse(), // Reverse right edge to go bottom to top
            leftPoints[0] // Close polygon
          ];
        }
      }
      
      // Add ground area infill/sketch like sky fill
      const groundFillHeight = (this.canvasHeight - groundY) * 0.8; // Fill 80% of remaining space
      if (groundFillHeight > 5) { // Only if there's enough space
        let groundFillPaths = drawGroundFill(
          margin,
          groundY,
          drawWidth,
          groundFillHeight,
          style.jitterMm * 0.5,
          environment.groundFillDensity,
          environment.fillPatternRandomness,
          this.rng
        );
        
        // Clip ground fill against path polygon if path exists
        if (pathPolygon && pathPolygon.length >= 3) {
          const clippedPaths: string[] = [];
          for (const path of groundFillPaths) {
            const clipped = clipPathAgainstPolygon(path, pathPolygon);
            clippedPaths.push(...clipped);
          }
          groundFillPaths = clippedPaths;
        }
        
        this.addPaths('ground', groundFillPaths);
      }
    } else if (environment.showPath) {
      // Path without ground line
      const pathWidth = scale * 0.08;
      const paths = drawPathToDoor(
        this.canvasHeight - margin,
        houseBounds.doorCenterX,
        houseBounds.doorBottomY,
        pathWidth,
        style.jitterMm,
        this.rng
      );
      this.addPaths('path', paths);
    }

    // Dog (single dog only)
    if (environment.showDog) {
      const dogScale = scale * 0.04 * environment.groundElements.sizeMultiplier;
      const groundY = houseBounds.y + houseBounds.height;
      const maxGroundY = groundY + 30;
      const effectiveGroundJitter = style.jitterMm + environment.groundElements.jitterIntensity;
      
      const dogRadius = dogScale * 1.5; // Approximate radius of dog
      // Position dog in ground area, avoiding door path
      const dogX = margin + drawWidth * this.rng.randomRange(0.1, 0.9);
      const dogY = Math.max(groundY, Math.min(maxGroundY, groundY + this.rng.randomRange(0, 15)));
      
      // Ensure dog doesn't spawn above roof
      if (!this.roofTriangle || dogY >= Math.min(this.roofTriangle[0].y, this.roofTriangle[1].y, this.roofTriangle[2].y)) {
        if (!this.checkCollision(dogX, dogY, dogRadius)) {
          this.obstacles.push({ x: dogX, y: dogY, radius: dogRadius });
          
          const paths = drawDogIcon(
            dogX,
            dogY,
            dogScale,
            effectiveGroundJitter,
            this.rng
          );
          this.addPaths('dog', paths);
        }
      }
    }

    // Human figure (on left or right side of house, not in front)
    if (environment.showHuman) {
      const humanScale = scale * 0.15 * environment.groundElements.sizeMultiplier; // 150% bigger (3x original)
      const groundY = houseBounds.y + houseBounds.height;
      const effectiveGroundJitter = style.jitterMm + environment.groundElements.jitterIntensity;
      
      // Determine which side (left or right) - 50/50 chance
      const isLeftSide = this.rng.chance(0.5);
      const houseLeftEdge = houseBounds.x;
      const houseRightEdge = houseBounds.x + houseBounds.width;
      
      let humanX: number;
      if (isLeftSide) {
        // Left side: between margin and left edge of house
        // Position clearly on the left side, not in front
        const leftAreaStart = margin + 15;
        const leftAreaEnd = houseLeftEdge - 10; // Keep some distance from house
        humanX = this.rng.randomRange(leftAreaStart, leftAreaEnd);
      } else {
        // Right side: between right edge of house and right margin
        // Position clearly on the right side, not in front
        const rightAreaStart = houseRightEdge + 10; // Keep some distance from house
        const rightAreaEnd = this.canvasWidth - margin - 15;
        humanX = this.rng.randomRange(rightAreaStart, rightAreaEnd);
      }
      
      // Human is positioned on the ground
      const humanY = groundY;
      const humanRadius = humanScale * 1.2; // Approximate radius of human
      
      // Ensure human doesn't spawn above roof
      if (!this.roofTriangle || humanY >= Math.min(this.roofTriangle[0].y, this.roofTriangle[1].y, this.roofTriangle[2].y)) {
        // Try multiple times to ensure placement, with progressively looser constraints
        let humanPlaced = false;
        const maxAttempts = 20;
        
        for (let attempt = 0; attempt < maxAttempts && !humanPlaced; attempt++) {
          // On later attempts, try different positions or reduce collision radius
          let tryX = humanX;
          let tryY = humanY;
          let tryRadius = humanRadius;
          
          if (attempt > 0) {
            // Try slightly different X position
            if (isLeftSide) {
              tryX = margin + 15 + this.rng.randomRange(0, houseLeftEdge - margin - 25);
            } else {
              tryX = houseRightEdge + 10 + this.rng.randomRange(0, this.canvasWidth - margin - houseRightEdge - 25);
            }
            // Reduce collision radius on later attempts to ensure placement
            if (attempt > 5) {
              tryRadius = humanRadius * 0.7;
            }
          }
          
          if (!this.checkCollision(tryX, tryY, tryRadius)) {
            this.obstacles.push({ x: tryX, y: tryY, radius: tryRadius });
            
            const paths = drawHumanIcon(
              tryX,
              tryY,
              humanScale,
              effectiveGroundJitter,
              this.rng
            );
            this.addPaths('human', paths);
            humanPlaced = true;
          }
        }
        
        // If still not placed after all attempts, force placement with minimal collision check
        if (!humanPlaced) {
          // Force placement with very loose collision check
          const forceX = isLeftSide ? 
            margin + 20 : 
            this.canvasWidth - margin - 20;
          this.obstacles.push({ x: forceX, y: humanY, radius: humanRadius * 0.5 });
          
          const paths = drawHumanIcon(
            forceX,
            humanY,
            humanScale,
            effectiveGroundJitter,
            this.rng
          );
          this.addPaths('human', paths);
        }
      }
    }

    // Multiple Trees with collision avoidance and proper ground placement
    if (environment.showTree) {
      // Much more trees: minimum 25, up to 35 trees for fuller scene
      const baseTreeCount = Math.max(25, this.rng.randomInt(25, 35));
      const treeCount = Math.max(4, Math.round(baseTreeCount * environment.groundElements.density)); // Mandatory minimum 4 trees
      const treeScale = scale * 0.08 * environment.groundElements.sizeMultiplier;
      const groundY = houseBounds.y + houseBounds.height;
      const maxGroundY = groundY + 30; // Maximum Y limit for ground elements
      
      // Calculate ground band height for Y position bias
      const groundBandHeight = this.canvasHeight - groundY - margin;
      
      let treesPlaced = 0;
      for (let i = 0; i < treeCount * 4; i++) { // Try more times to ensure placement
        if (treesPlaced >= treeCount) break;

        const radius = treeScale * 1.5; // Approximate radius of tree
        // Ensure tree stays within margins
        const treeX = Math.max(
          margin + radius + 0.5,
          Math.min(
            this.canvasWidth - margin - radius - 0.5,
            margin + this.rng.randomRange(0, drawWidth)
          )
        );

        // Y position bias: 70% probability in lower half, 30% in upper half
        // Scale to 60% of ground band to keep trees in foreground
        const bias = this.rng.chance(0.7) ? this.rng.randomRange(0, 0.5) : this.rng.randomRange(0.5, 1.0);
        const treeYOffset = groundBandHeight * bias * 0.6;
        const treeY = Math.max(groundY, Math.min(maxGroundY, groundY + treeYOffset));

        // Ensure tree doesn't spawn above roof
        if (this.roofTriangle) {
          const roofMinY = Math.min(this.roofTriangle[0].y, this.roofTriangle[1].y, this.roofTriangle[2].y);
          if (treeY < roofMinY) continue; // Skip if tree would be above roof
        }

        if (!this.checkCollision(treeX, treeY, radius)) {
          // Add obstacle
          this.obstacles.push({ x: treeX, y: treeY, radius });
          
          const treeVariation = this.rng.randomRange(0.8, 1.2);
          const effectiveGroundJitter = style.jitterMm + environment.groundElements.jitterIntensity;
          const paths = drawTreeIcon(
            treeX,
            treeY,
            treeScale * treeVariation,
            effectiveGroundJitter,
            this.rng
          );
          this.addPaths('tree', paths);
          treesPlaced++;
        }
      }
    }

    // Grass patches (scattered around) - more for fuller ground
    const grassPatchCount = this.rng.randomInt(8, 15);
    const groundY = houseBounds.y + houseBounds.height;
    
    for (let i = 0; i < grassPatchCount; i++) {
      const grassX = margin + drawWidth * this.rng.randomRange(0.1, 0.9);
      const patchWidth = scale * this.rng.randomRange(0.08, 0.15);
      const bladeHeight = scale * this.rng.randomRange(0.02, 0.04);
      const bladeCount = this.rng.randomInt(4, 7);
      
      // Don't place grass too close to the door path
      if (!this.checkCollision(grassX, groundY, 10)) {
         // Grass is okay to overlap a bit, but keep away from main structures
         const paths = drawGrassPatch(
          grassX,
          groundY,
          patchWidth,
          bladeHeight,
          bladeCount,
          style.jitterMm,
          this.rng
        );
        this.addPaths('grass', paths);
      }
    }

    // Rocks for ground texture - more for fuller ground
    if (environment.showRocks) {
      const baseRockCount = Math.max(20, this.rng.randomInt(20, 35)); // More rocks for texture
      const rockCount = Math.max(10, Math.round(baseRockCount * environment.groundElements.density)); // Mandatory minimum 10 rocks
      const groundY = houseBounds.y + houseBounds.height;
      const maxGroundY = groundY + 30;
      
      for (let i = 0; i < rockCount * 3; i++) {
        const rockX = margin + drawWidth * this.rng.randomRange(0.05, 0.95);
        const rockSize = scale * this.rng.randomRange(0.02, 0.04) * environment.groundElements.sizeMultiplier;
        const rockY = Math.max(groundY, Math.min(maxGroundY, groundY + this.rng.randomRange(0, 8)));
        
        if (this.roofTriangle) {
          const roofMinY = Math.min(this.roofTriangle[0].y, this.roofTriangle[1].y, this.roofTriangle[2].y);
          if (rockY < roofMinY) continue;
        }
        
        if (!this.checkCollision(rockX, rockY, 6)) {
          this.obstacles.push({ x: rockX, y: rockY, radius: 4 });
          const effectiveGroundJitter = style.jitterMm + environment.groundElements.jitterIntensity;
          const paths = drawRock(
            rockX,
            rockY,
            rockSize,
            effectiveGroundJitter,
            this.rng
          );
          this.addPaths('rock', paths);
        }
      }
    }

    // Flowers with collision avoidance and proper ground placement
    if (environment.showFlowers) {
      // Much more flowers: minimum of 100 flowers, up to 150 for fuller scene
      const baseFlowerCount = Math.max(100, this.rng.randomInt(100, 150));
      const flowerCount = Math.max(8, Math.round(baseFlowerCount * environment.groundElements.density)); // Mandatory minimum 8 flowers
      const groundY = houseBounds.y + houseBounds.height;
      const maxGroundY = groundY + 40; // Increased range for more placement options
      
      let flowersPlaced = 0;
      // Try many more times to ensure we reach the mandatory minimum
      for (let i = 0; i < flowerCount * 10; i++) { // Increased attempts significantly
        if (flowersPlaced >= flowerCount) break;
        
        const flowerX = margin + drawWidth * this.rng.randomRange(0.05, 0.95);
        const flowerSize = scale * this.rng.randomRange(0.015, 0.03) * environment.groundElements.sizeMultiplier;
        // Restrict flowers to ground region only, with more range
        const flowerY = Math.max(groundY, Math.min(maxGroundY, groundY + this.rng.randomRange(0, 10))); // Increased range
        
        // Ensure flower doesn't spawn above roof
        if (this.roofTriangle) {
          const roofMinY = Math.min(this.roofTriangle[0].y, this.roofTriangle[1].y, this.roofTriangle[2].y);
          if (flowerY < roofMinY) continue; // Skip if flower would be above roof
        }
        
        // Use smaller collision radius to allow more placement
        if (!this.checkCollision(flowerX, flowerY, 6)) { // Reduced from 8 to 6
          this.obstacles.push({ x: flowerX, y: flowerY, radius: 4 }); // Smaller radius
          const effectiveGroundJitter = style.jitterMm + environment.groundElements.jitterIntensity;
          const paths = drawFlower(
            flowerX,
            flowerY,
            flowerSize,
            effectiveGroundJitter,
            this.rng
          );
          this.addPaths('flower', paths);
          flowersPlaced++;

          // Add butterflies near flowers (30% chance per flower)
          if (this.rng.chance(0.3)) {
            const butterflyX = flowerX + this.rng.randomRange(-10, 10);
            const butterflyY = flowerY - flowerSize * 2;
            const butterflySize = scale * this.rng.randomRange(0.02, 0.04) * environment.groundElements.sizeMultiplier;
            const effectiveGroundJitter = (style.jitterMm + environment.groundElements.jitterIntensity) * 0.5;
            
            const butterflyPaths = drawButterfly(
              butterflyX,
              butterflyY,
              butterflySize,
              effectiveGroundJitter,
              this.rng
            );
            this.addPaths('butterfly', butterflyPaths);
          }
        }
      }
      
      // If we still haven't placed the minimum, force placement with even looser constraints
      if (flowersPlaced < 8) {
        // Try many more times with very loose constraints to guarantee minimum
        for (let attempt = 0; attempt < 100 && flowersPlaced < 8; attempt++) {
          const flowerX = margin + drawWidth * this.rng.randomRange(0.1, 0.9);
          const flowerSize = scale * 0.02 * environment.groundElements.sizeMultiplier;
          const flowerY = groundY + this.rng.randomRange(5, 25);
          
          if (this.roofTriangle) {
            const roofMinY = Math.min(this.roofTriangle[0].y, this.roofTriangle[1].y, this.roofTriangle[2].y);
            if (flowerY >= roofMinY) {
              // Use very loose collision check for forced placement
              if (!this.checkCollision(flowerX, flowerY, 2)) {
                this.obstacles.push({ x: flowerX, y: flowerY, radius: 2 });
                const effectiveGroundJitter = style.jitterMm + environment.groundElements.jitterIntensity;
                const paths = drawFlower(flowerX, flowerY, flowerSize, effectiveGroundJitter, this.rng);
                this.addPaths('flower', paths);
                flowersPlaced++;
              }
            }
          } else {
            // No roof, safe to place
            if (!this.checkCollision(flowerX, flowerY, 2)) {
              this.obstacles.push({ x: flowerX, y: flowerY, radius: 2 });
              const effectiveGroundJitter = style.jitterMm + environment.groundElements.jitterIntensity;
              const paths = drawFlower(flowerX, flowerY, flowerSize, effectiveGroundJitter, this.rng);
              this.addPaths('flower', paths);
              flowersPlaced++;
            }
          }
        }
      }
    }

    // Sunflowers with green stems and yellow flowers - ensure they always appear
    if (environment.showFlowers) {
      // Much more sunflowers: minimum of 50, up to 80 for guaranteed visibility
      const baseSunflowerCount = Math.max(50, this.rng.randomInt(50, 80));
      const sunflowerCount = Math.max(5, Math.round(baseSunflowerCount * environment.groundElements.density)); // Mandatory minimum 5 sunflowers
      const groundY = houseBounds.y + houseBounds.height;
      const maxGroundY = groundY + 40; // Increased range
      
      let sunflowersPlaced = 0;
      // Try many more times to ensure placement
      for (let i = 0; i < sunflowerCount * 8; i++) {
        if (sunflowersPlaced >= sunflowerCount) break;
        
        const sunflowerX = margin + drawWidth * this.rng.randomRange(0.05, 0.95);
        const sunflowerSize = scale * this.rng.randomRange(0.025, 0.04) * environment.groundElements.sizeMultiplier;
        const sunflowerY = Math.max(groundY, Math.min(maxGroundY, groundY + this.rng.randomRange(0, 10))); // Increased range
        
        if (this.roofTriangle) {
          const roofMinY = Math.min(this.roofTriangle[0].y, this.roofTriangle[1].y, this.roofTriangle[2].y);
          if (sunflowerY < roofMinY) continue;
        }
        
        // Use smaller collision radius to allow more placement
        if (!this.checkCollision(sunflowerX, sunflowerY, 8)) {
          this.obstacles.push({ x: sunflowerX, y: sunflowerY, radius: 5 });
          const effectiveGroundJitter = style.jitterMm + environment.groundElements.jitterIntensity;
          const { stemPaths, flowerPaths, centerPaths } = drawSunflower(
            sunflowerX,
            sunflowerY,
            sunflowerSize,
            effectiveGroundJitter,
            this.rng
          );
          this.addPaths('sunflower_stem', stemPaths);
          this.addPaths('sunflower', flowerPaths);
          this.addPaths('sunflower_center', centerPaths);
          sunflowersPlaced++;
        }
      }
      
      // CRITICAL: If we still haven't placed at least 1 sunflower, force placement with very loose constraints
      if (sunflowersPlaced < 1) {
        for (let attempt = 0; attempt < 50 && sunflowersPlaced < 1; attempt++) {
          const sunflowerX = margin + drawWidth * this.rng.randomRange(0.1, 0.9);
          const sunflowerSize = scale * 0.03 * environment.groundElements.sizeMultiplier;
          const sunflowerY = groundY + this.rng.randomRange(5, 25);
          
          if (this.roofTriangle) {
            const roofMinY = Math.min(this.roofTriangle[0].y, this.roofTriangle[1].y, this.roofTriangle[2].y);
            if (sunflowerY >= roofMinY) {
              // Use very loose collision check for forced placement
              if (!this.checkCollision(sunflowerX, sunflowerY, 2)) {
                this.obstacles.push({ x: sunflowerX, y: sunflowerY, radius: 2 });
                const effectiveGroundJitter = style.jitterMm + environment.groundElements.jitterIntensity;
                const { stemPaths, flowerPaths, centerPaths } = drawSunflower(
                  sunflowerX,
                  sunflowerY,
                  sunflowerSize,
                  effectiveGroundJitter,
                  this.rng
                );
                this.addPaths('sunflower_stem', stemPaths);
                this.addPaths('sunflower', flowerPaths);
                this.addPaths('sunflower_center', centerPaths);
                sunflowersPlaced++;
              }
            }
          } else {
            // No roof, safe to place
            if (!this.checkCollision(sunflowerX, sunflowerY, 2)) {
              this.obstacles.push({ x: sunflowerX, y: sunflowerY, radius: 2 });
              const effectiveGroundJitter = style.jitterMm + environment.groundElements.jitterIntensity;
              const { stemPaths, flowerPaths, centerPaths } = drawSunflower(
                sunflowerX,
                sunflowerY,
                sunflowerSize,
                effectiveGroundJitter,
                this.rng
              );
              this.addPaths('sunflower_stem', stemPaths);
              this.addPaths('sunflower', flowerPaths);
              this.addPaths('sunflower_center', centerPaths);
              sunflowersPlaced++;
            }
          }
        }
      }
    }

    // Bushes with collision avoidance and proper ground placement - more for fuller ground
    if (environment.showBushes && environment.groundElements.density > 0.4) {
      // Much more bushes: minimum 15, up to 25 bushes for fuller scene
      const baseBushCount = Math.max(15, this.rng.randomInt(15, 25));
      const bushCount = Math.max(5, Math.round(baseBushCount * environment.groundElements.density)); // Mandatory minimum 5 bushes
      const groundY = houseBounds.y + houseBounds.height;
      const maxGroundY = groundY + 30; // Maximum Y limit for ground elements
      
      // Calculate ground band height for Y position bias
      const groundBandHeight = this.canvasHeight - groundY - margin;
      
      for (let i = 0; i < bushCount * 3; i++) { // Try more times to ensure placement
        const bushX = margin + drawWidth * this.rng.randomRange(0.1, 0.9);
        const bushWidth = scale * this.rng.randomRange(0.15, 0.25) * environment.groundElements.sizeMultiplier;
        const bushHeight = scale * this.rng.randomRange(0.08, 0.15) * environment.groundElements.sizeMultiplier;
        
        // Y position bias: 80% probability in lower 40%, 20% in upper 60%
        // Scale to 50% of ground band to keep bushes in foreground
        const bias = this.rng.chance(0.8) ? this.rng.randomRange(0, 0.4) : this.rng.randomRange(0.4, 0.8);
        const bushYOffset = groundBandHeight * bias * 0.5;
        const bushY = Math.max(groundY, Math.min(maxGroundY, groundY + bushYOffset));
        
        // Ensure bush doesn't spawn above roof
        if (this.roofTriangle) {
          const roofMinY = Math.min(this.roofTriangle[0].y, this.roofTriangle[1].y, this.roofTriangle[2].y);
          if (bushY < roofMinY) continue; // Skip if bush would be above roof
        }
        
        if (!this.checkCollision(bushX, bushY, bushWidth / 2)) {
          this.obstacles.push({ x: bushX, y: bushY, radius: bushWidth / 2 });
          const effectiveGroundJitter = style.jitterMm + environment.groundElements.jitterIntensity;
          const paths = drawBush(
            bushX,
            bushY,
            bushWidth,
            bushHeight,
            effectiveGroundJitter,
            this.rng
          );
          this.addPaths('bush', paths);
        }
      }
    }

    // Fence - always visible when enabled, place on both sides of house
    if (environment.showFence) {
      const fencePostHeight = scale * 0.12 * environment.groundElements.sizeMultiplier;
      const fencePostSpacing = scale * 0.08 * environment.groundElements.sizeMultiplier;
      const fenceLength = drawWidth * 0.25; // Slightly shorter for both sides
      
      const effectiveGroundJitter = style.jitterMm + environment.groundElements.jitterIntensity;
      
      // Left fence
      const leftFenceStartX = margin + drawWidth * 0.1 + this.rng.randomRange(-5, 5); // Jittered positioning
      const leftFencePaths = drawFence(
        leftFenceStartX,
        groundY,
        fenceLength,
        fencePostHeight,
        fencePostSpacing,
        effectiveGroundJitter,
        this.rng
      );
      this.addPaths('fence', leftFencePaths);
      
      // Right fence
      const rightFenceStartX = margin + drawWidth * 0.65 + this.rng.randomRange(-5, 5); // Jittered positioning
      const rightFencePaths = drawFence(
        rightFenceStartX,
        groundY,
        fenceLength,
        fencePostHeight,
        fencePostSpacing,
        effectiveGroundJitter,
        this.rng
      );
      this.addPaths('fence', rightFencePaths);
    }
  }

  /**
   * Adds paths to a specific pen role group
   */
  private addPaths(role: PenRole, paths: string[]): void {
    const existing = this.pathGroups.get(role) || [];
    this.pathGroups.set(role, [...existing, ...paths]);
  }

  /**
   * Clips sky paths against the roof triangle to hide sky behind roof
   */
  private clipSkyAgainstRoof(): void {
    if (!this.roofTriangle) return;
    
    const skyPaths = this.pathGroups.get('sky') || [];
    if (skyPaths.length === 0) return;
    
    const clippedPaths: string[] = [];
    
    for (const path of skyPaths) {
      const clipped = clipPathAgainstTriangle(path, this.roofTriangle);
      clippedPaths.push(...clipped);
    }
    
    this.pathGroups.set('sky', clippedPaths);
  }

  /**
   * Clips sky paths against the house rectangle to hide sky behind house
   */
  private clipSkyAgainstHouse(): void {
    if (!this.houseBounds) return;
    
    const skyPaths = this.pathGroups.get('sky') || [];
    if (skyPaths.length === 0) return;
    
    // Create house polygon from rectangle
    const housePolygon: Point[] = [
      { x: this.houseBounds.x, y: this.houseBounds.y },
      { x: this.houseBounds.x + this.houseBounds.width, y: this.houseBounds.y },
      { x: this.houseBounds.x + this.houseBounds.width, y: this.houseBounds.y + this.houseBounds.height },
      { x: this.houseBounds.x, y: this.houseBounds.y + this.houseBounds.height },
      { x: this.houseBounds.x, y: this.houseBounds.y }
    ];
    
    const clippedPaths: string[] = [];
    
    for (const path of skyPaths) {
      const clipped = clipPathAgainstPolygon(path, housePolygon);
      clippedPaths.push(...clipped);
    }
    
    this.pathGroups.set('sky', clippedPaths);
  }

  /**
   * Unified method to clip any element against the roof triangle
   * Removes all path segments that fall behind/inside the roof polygon
   */
  private clipElementAgainstRoof(role: PenRole): void {
    if (!this.roofTriangle) return;
    
    const elementPaths = this.pathGroups.get(role) || [];
    if (elementPaths.length === 0) return;
    
    const clippedPaths: string[] = [];
    
    for (const path of elementPaths) {
      const clipped = clipPathAgainstTriangle(path, this.roofTriangle);
      clippedPaths.push(...clipped);
    }
    
    this.pathGroups.set(role, clippedPaths);
  }

  /**
   * Generates an organic mask polygon from cloud outline points
   * Creates an offset polygon with jittered edges that follows the cloud shape
   * with irregular, hand-drawn appearance
   */
  private generateOrganicCloudMask(cloudPoints: Point[], margin: number): Point[] {
    if (cloudPoints.length < 3) return cloudPoints;
    
    const maskPoints: Point[] = [];
    
    // Calculate cloud center for reference
    let centerX = 0;
    let centerY = 0;
    for (const pt of cloudPoints) {
      centerX += pt.x;
      centerY += pt.y;
    }
    centerX /= cloudPoints.length;
    centerY /= cloudPoints.length;
    
    // For each point in cloud outline, offset outward by margin + jitter
    for (let i = 0; i < cloudPoints.length; i++) {
      const pt = cloudPoints[i];
      
      // Calculate direction from cloud center to this point (outward normal)
      const dx = pt.x - centerX;
      const dy = pt.y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 0.1) {
        // Point is very close to center, just add margin
        maskPoints.push({
          x: pt.x + this.rng.randomRange(-margin * 0.5, margin * 0.5),
          y: pt.y + margin + this.rng.randomRange(-margin * 0.3, margin * 0.3)
        });
        continue;
      }
      
      // Normalize direction vector
      const nx = dx / dist;
      const ny = dy / dist;
      
      // Calculate offset point (outward by margin)
      const offsetX = pt.x + nx * margin;
      const offsetY = pt.y + ny * margin;
      
      // Add perpendicular jitter for organic bumps
      const perpX = -ny; // Perpendicular to outward direction
      const perpY = nx;
      const jitterAmount = margin * this.rng.randomRange(0.3, 0.7);
      const jitterX = perpX * jitterAmount * this.rng.randomRange(-1, 1);
      const jitterY = perpY * jitterAmount * this.rng.randomRange(-1, 1);
      
      // Also add small radial variation
      const radialJitter = margin * this.rng.randomRange(-0.2, 0.2);
      
      maskPoints.push({
        x: offsetX + jitterX + nx * radialJitter,
        y: offsetY + jitterY + ny * radialJitter
      });
    }
    
    // Apply irregularity to the mask polygon itself for more organic feel
    const irregularMask = makeIrregularPolygon(maskPoints, this.rng, 2, margin * 0.3);
    
    // Ensure closed polygon
    if (irregularMask.length > 0 && irregularMask[0].x !== irregularMask[irregularMask.length - 1].x || 
        irregularMask[0].y !== irregularMask[irregularMask.length - 1].y) {
      irregularMask.push({ ...irregularMask[0] });
    }
    
    return irregularMask;
  }

  /**
   * Clips sky around clouds with organic polygon masks instead of circular clipping
   */
  private clipSkyAroundClouds(cloudPositions: Array<{ x: number; y: number; width: number; height: number; radius: number; outlinePoints: Point[] }>): void {
    const skyPaths = this.pathGroups.get('sky') || [];
    if (skyPaths.length === 0) return;
    
    const margin = 3; // Margin between cloud contours and sky fill
    
    // Generate organic mask polygons for each cloud
    const cloudMasks: Point[][] = [];
    for (const cloud of cloudPositions) {
      if (cloud.outlinePoints && cloud.outlinePoints.length >= 3) {
        const maskPolygon = this.generateOrganicCloudMask(cloud.outlinePoints, margin);
        if (maskPolygon.length >= 3) {
          cloudMasks.push(maskPolygon);
        }
      }
    }
    
    if (cloudMasks.length === 0) return; // No valid masks
    
    // Clip each sky path against all cloud masks using polygon-based clipping
    let clippedPaths: string[] = [...skyPaths];
    
    for (const maskPolygon of cloudMasks) {
      const tempPaths: string[] = [];
      for (const path of clippedPaths) {
        // Use polygon clipping to remove parts inside cloud mask
        const clipped = clipPathAgainstPolygon(path, maskPolygon);
        tempPaths.push(...clipped);
      }
      clippedPaths = tempPaths;
    }
    
    this.pathGroups.set('sky', clippedPaths);
  }

  /**
   * Clips clouds against sun to ensure no intersection and maintain visible gap
   */
  private clipCloudsAgainstSun(): void {
    if (!this.sunBounds) return;
    
    const cloudPaths = this.pathGroups.get('cloud') || [];
    if (cloudPaths.length === 0) return;
    
    const sunMargin = 5; // Minimum gap between cloud and sun
    const sunEffectiveRadius = this.sunBounds.radius + sunMargin;
    
    const clippedPaths: string[] = [];
    
    for (const path of cloudPaths) {
      // Parse path to points
      const pathMatch = path.match(/M\s+([\d.]+)\s+([\d.]+)((?:\s+L\s+[\d.]+\s+[\d.]+)*)/);
      if (!pathMatch || !pathMatch[3]) {
        clippedPaths.push(path);
        continue;
      }
      
      const points: Point[] = [];
      points.push({ x: parseFloat(pathMatch[1]), y: parseFloat(pathMatch[2]) });
      const lineMatches = pathMatch[3].matchAll(/L\s+([\d.]+)\s+([\d.]+)/g);
      for (const match of lineMatches) {
        points.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
      }
      
      // Clip path segments that are inside sun area
      const clippedSegments: Point[][] = [];
      let currentSegment: Point[] = [];
      
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        
        const dist1 = Math.sqrt((p1.x - this.sunBounds!.x) ** 2 + (p1.y - this.sunBounds!.y) ** 2);
        const dist2 = Math.sqrt((p2.x - this.sunBounds!.x) ** 2 + (p2.y - this.sunBounds!.y) ** 2);
        const p1Inside = dist1 < sunEffectiveRadius;
        const p2Inside = dist2 < sunEffectiveRadius;
        
        if (!p1Inside && !p2Inside) {
          // Both outside sun - keep segment
          if (currentSegment.length === 0) {
            currentSegment.push(p1);
          }
          currentSegment.push(p2);
        } else if (p1Inside && !p2Inside) {
          // p1 inside, p2 outside - start from edge
          if (currentSegment.length > 1) {
            clippedSegments.push([...currentSegment]);
          }
          // Find intersection with sun circle
          const angle = Math.atan2(p2.y - this.sunBounds!.y, p2.x - this.sunBounds!.x);
          const edgePoint = {
            x: this.sunBounds!.x + sunEffectiveRadius * Math.cos(angle),
            y: this.sunBounds!.y + sunEffectiveRadius * Math.sin(angle)
          };
          currentSegment = [edgePoint, p2];
        } else if (!p1Inside && p2Inside) {
          // p1 outside, p2 inside - end at edge
          if (currentSegment.length === 0) {
            currentSegment.push(p1);
          }
          const angle = Math.atan2(p1.y - this.sunBounds!.y, p1.x - this.sunBounds!.x);
          const edgePoint = {
            x: this.sunBounds!.x + sunEffectiveRadius * Math.cos(angle),
            y: this.sunBounds!.y + sunEffectiveRadius * Math.sin(angle)
          };
          currentSegment.push(edgePoint);
          if (currentSegment.length > 1) {
            clippedSegments.push([...currentSegment]);
          }
          currentSegment = [];
        }
        // If both inside, skip (fully occluded)
      }
      
      if (currentSegment.length > 1) {
        clippedSegments.push([...currentSegment]);
      }
      
      // Convert back to paths
      for (const seg of clippedSegments) {
        if (seg.length > 1) {
          clippedPaths.push(pointsToPath(seg, false));
        }
      }
    }
    
    this.pathGroups.set('cloud', clippedPaths);
  }

  /**
   * Generates an organic, jittery mask polygon for the sun (including rays)
   * Creates a feathered fall-off zone with irregular, hand-drawn appearance
   */
  private generateOrganicSunMask(
    sunX: number,
    sunY: number,
    sunRadius: number,
    rayLength: number,
    featherZone: number
  ): Point[] {
    // Create base polygon that represents sun + rays area
    const baseRadius = sunRadius;
    const maxRayExtent = baseRadius + rayLength;
    
    // Generate points around the sun shape with more variation
    // Use more segments for smoother but more varied organic shape
    const segments = 64; // More segments for detailed organic shape
    const maskPoints: Point[] = [];
    
    // Simulate ray positions (matching the sun's actual ray pattern)
    const rayCount = 12; // Approximate ray count
    const rayAngles: number[] = [];
    const rayLengths: number[] = [];
    for (let i = 0; i < rayCount; i++) {
      const baseAngle = (i / rayCount) * Math.PI * 2;
      const angleOffset = this.rng.randomRange(-0.12, 0.12); // Match sun ray variation
      rayAngles.push(baseAngle + angleOffset);
      // Vary ray lengths like the actual sun
      rayLengths.push(rayLength * this.rng.randomRange(0.6, 1.4));
    }
    
    // Create organic mask by sampling around the sun
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const angle = t * Math.PI * 2;
      
      // Find nearest ray to determine if we're in a ray direction
      let nearestRayDist = Infinity;
      let nearestRayIndex = 0;
      for (let j = 0; j < rayAngles.length; j++) {
        const rayAngle = rayAngles[j];
        const angleDiff = Math.abs(angle - rayAngle);
        const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
        if (normalizedDiff < nearestRayDist) {
          nearestRayDist = normalizedDiff;
          nearestRayIndex = j;
        }
      }
      
      // Calculate radius based on whether we're near a ray or in between
      // Rays extend further, creating a star-like organic shape
      const rayInfluence = Math.max(0, 1 - nearestRayDist / (Math.PI / rayCount * 1.5));
      const rayExtension = rayLengths[nearestRayIndex] * rayInfluence;
      const baseExtent = baseRadius + rayExtension;
      
      // Add feather zone with variable fall-off
      // Create organic variation in the feather zone
      const featherVariation = this.rng.randomRange(0.7, 1.3); // Variable feather depth
      const radius = baseExtent + featherZone * featherVariation;
      
      // Add strong organic jitter to the radius for irregular shape
      const radiusJitter = this.rng.randomRange(0.75, 1.25); // More variation
      const jitteredRadius = radius * radiusJitter;
      
      // Add angular jitter for more organic, wobbly shape
      const angleJitter = this.rng.randomRange(-0.15, 0.15); // More angular variation
      const jitteredAngle = angle + angleJitter;
      
      maskPoints.push({
        x: sunX + jitteredRadius * Math.cos(jitteredAngle),
        y: sunY + jitteredRadius * Math.sin(jitteredAngle)
      });
    }
    
    // Apply strong irregularity to make it very organic and jittery
    const irregularMask = makeIrregularPolygon(maskPoints, this.rng, 5, maxRayExtent * 0.15);
    
    // Apply additional jitter pass for more hand-drawn feel
    const jitteredMask = applyLineJitter(irregularMask, maxRayExtent * 0.08, this.rng, false);
    
    // Close the polygon
    if (jitteredMask.length > 0 && 
        (jitteredMask[0].x !== jitteredMask[jitteredMask.length - 1].x ||
         jitteredMask[0].y !== jitteredMask[jitteredMask.length - 1].y)) {
      jitteredMask.push({ ...jitteredMask[0] });
    }
    
    return jitteredMask;
  }

  /**
   * Calculates the minimum distance from a path to the sun edge (not center)
   * Returns distance from sun edge: negative = inside sun, 0 = at edge, positive = outside
   */
  private getDistanceFromSunEdge(
    pathPoints: Point[],
    sunX: number,
    sunY: number,
    sunRadius: number,
    rayLength: number
  ): number {
    let minDist = Infinity;
    
    // Calculate effective sun radius accounting for rays
    // Rays extend in specific directions, so we need to check each point
    for (const point of pathPoints) {
      const dx = point.x - sunX;
      const dy = point.y - sunY;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      // Check if point is in a ray direction
      const rayCount = 12;
      let effectiveSunRadius = sunRadius;
      
      for (let i = 0; i < rayCount; i++) {
        const rayAngle = (i / rayCount) * Math.PI * 2;
        const angleDiff = Math.abs(angle - rayAngle);
        const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
        
        // If within 20 degrees of a ray, extend the effective radius
        if (normalizedDiff < Math.PI / 9) {
          effectiveSunRadius = sunRadius + rayLength;
          break;
        }
      }
      
      // Distance from sun edge (negative = inside, positive = outside)
      const distFromEdge = distFromCenter - effectiveSunRadius;
      minDist = Math.min(minDist, distFromEdge);
    }
    
    return minDist;
  }

  /**
   * Calculates distance from a single point to the sun edge
   * Returns distance from sun edge: negative = inside sun, 0 = at edge, positive = outside
   */
  private getDistanceFromSunEdgePoint(
    point: Point,
    sunX: number,
    sunY: number,
    sunRadius: number,
    rayLength: number
  ): number {
    const dx = point.x - sunX;
    const dy = point.y - sunY;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    // Check if point is in a ray direction
    const rayCount = 12;
    let effectiveSunRadius = sunRadius;
    
    for (let i = 0; i < rayCount; i++) {
      const rayAngle = (i / rayCount) * Math.PI * 2;
      const angleDiff = Math.abs(angle - rayAngle);
      const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
      
      // If within 20 degrees of a ray, extend the effective radius
      if (normalizedDiff < Math.PI / 9) {
        effectiveSunRadius = sunRadius + rayLength;
        break;
      }
    }
    
    // Distance from sun edge (negative = inside, positive = outside)
    return distFromCenter - effectiveSunRadius;
  }

  /**
   * Ensures sun renders in front of sky by simple hard clipping
   * Just removes sky paths that enter the sun circle - simple and clean
   */
  private ensureSunInFront(): void {
    const { environment, canvas } = this.config;
    if (!environment.showSunOrMoon || !this.sunBounds) return;
    
    const margin = canvas.marginMm || 0;
    const drawWidth = this.canvasWidth - 2 * margin;
    const scale = Math.min(drawWidth, this.canvasHeight - 2 * margin);
    
    const sunRadius = scale * 0.08 * environment.skyElements.sizeMultiplier;
    const sunX = this.sunBounds.x;
    const sunY = this.sunBounds.y;
    
    // Create a simple circle polygon for the sun (inner circle only, no rays)
    const effectiveRadius = sunRadius;
    const circleSegments = 32;
    const sunCircle: Point[] = [];
    for (let i = 0; i <= circleSegments; i++) {
      const angle = (i / circleSegments) * Math.PI * 2;
      sunCircle.push({
        x: sunX + effectiveRadius * Math.cos(angle),
        y: sunY + effectiveRadius * Math.sin(angle)
      });
    }
    // Close the circle
    if (sunCircle.length > 0 && 
        (sunCircle[0].x !== sunCircle[sunCircle.length - 1].x ||
         sunCircle[0].y !== sunCircle[sunCircle.length - 1].y)) {
      sunCircle.push({ ...sunCircle[0] });
    }
    
    // Get sky paths
    const skyPaths = this.pathGroups.get('sky') || [];
    if (skyPaths.length === 0) return;
    
    // Simple clipping: remove parts of sky paths that are inside the sun circle
    const clippedPaths: string[] = [];
    
    for (const path of skyPaths) {
      // Clip path against sun circle - this removes parts inside the circle
      const clipped = clipPathAgainstPolygon(path, sunCircle);
      clippedPaths.push(...clipped);
    }
    
    this.pathGroups.set('sky', clippedPaths);
  }

  /**
   * Ensures sun is re-rendered after sky clipping to appear on top
   */
  private ensureSunOnTop(): void {
    const { environment, style, canvas } = this.config;
    if (!environment.showSunOrMoon) return;
    
    const margin = canvas.marginMm || 0;
    const drawWidth = this.canvasWidth - 2 * margin;
    const scale = Math.min(drawWidth, this.canvasHeight - 2 * margin);
    
    // Get sky height for sun placement constraints
    const skyHeight = (this.canvasHeight - 2 * margin) * environment.skyBandHeightRatio;
    const skyTopY = margin;
    const skyBottomY = margin + skyHeight;
    
    const sunRadius = scale * 0.08 * environment.skyElements.sizeMultiplier;
    // Use same constrained coordinates as initial sun render
    const rayLength = sunRadius * 0.7;
    const sunEffectiveRadius = sunRadius + rayLength;
    const sunX = Math.max(
      margin + sunEffectiveRadius + 0.5,
      Math.min(
        this.canvasWidth - margin - sunEffectiveRadius - 0.5,
        margin + drawWidth * 0.85
      )
    );
    // Constrain sun Y to be within sky band
    const preferredSunY = margin + (this.canvasHeight - 2 * margin) * 0.12;
    const sunY = Math.max(
      skyTopY + sunEffectiveRadius + 0.5,
      Math.min(
        skyBottomY - sunEffectiveRadius - 0.5,
        preferredSunY
      )
    );
    const isSun = this.rng.chance(0.9);
    const effectiveSkyJitter = style.jitterMm * 0.3 + environment.skyElements.jitterIntensity * 0.3;
    
    // Remove existing sun paths
    this.pathGroups.set('sun', []);
    
    // Re-render sun on top of sky (after clipping)
    const sunPaths = drawSunOrMoon(
      sunX,
      sunY,
      sunRadius,
      isSun,
      effectiveSkyJitter,
      this.rng
    );
    this.addPaths('sun', sunPaths);
  }

  /**
   * Clips ALL paths to margin boundaries to prevent bleeding
   * This is a final safety check to ensure nothing extends beyond margins
   */
  private clipAllPathsToMargins(): void {
    const { canvas } = this.config;
    const margin = canvas.marginMm || 0;
    
    if (margin <= 0) return; // No clipping needed if no margins
    
    // Define the drawable rectangle (inside margins)
    const drawableRect = {
      x: margin,
      y: margin,
      width: this.canvasWidth - 2 * margin,
      height: this.canvasHeight - 2 * margin
    };
    
    // Clip all path groups to the drawable area
    for (const role of this.pathGroups.keys()) {
      const paths = this.pathGroups.get(role) || [];
      if (paths.length === 0) continue;
      
      const clippedPaths: string[] = [];
      
      for (const path of paths) {
        // Clip each path to the drawable rectangle
        const clipped = clipPathInsideRect(path, drawableRect);
        clippedPaths.push(...clipped);
      }
      
      // Replace original paths with clipped paths
      this.pathGroups.set(role, clippedPaths);
    }
  }

  /**
   * Returns all path groups with their associated pen configurations
   */
  private getPathGroups(): PathGroup[] {
    const result: PathGroup[] = [];

    for (const pen of this.config.pens) {
      const paths = this.pathGroups.get(pen.role) || [];
      if (paths.length > 0) {
        // Create effective pen with overridden stroke width if applicable
        const effectivePen = { ...pen };
        if (this.config.globalStrokeWidthMm !== undefined) {
          effectivePen.strokeWidthMm = this.config.globalStrokeWidthMm;
        }

        result.push({
          role: pen.role,
          paths,
          pen: effectivePen
        });
      }
    }

    return result;
  }
}

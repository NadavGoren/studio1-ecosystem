# 3D Cube Generator - Rendering Method Reference

## Overview

This document describes the rendering methodology used in the 3D Cube Generator, which converts 3D geometry into plotter-ready line art. This approach can be adapted for STL file rendering.

## Core Rendering Pipeline

The rendering process follows this pipeline:

```
3D Geometry → Transformations → Projection (3D→2D) → Face Processing → Hatch Line Generation → Occlusion Clipping → SVG Output
```

## 1. 3D Geometry Representation

### Structure
- **Vertices**: Array of 3D points `{x, y, z}`
- **Faces**: Array of face definitions containing:
  - `indices`: Vertex indices forming the face
  - `normal`: Face normal vector `{x, y, z}` (for lighting)
  - `name`: Face identifier (for color/layer organization)

### Example (Cube)
```javascript
vertices = [
  { x: -s, y: -s, z: 0 },  // bottom-left-back
  { x:  s, y: -s, z: 0 },  // bottom-right-back
  // ... 8 vertices total
]

faces = [
  {
    indices: [0, 1, 2, 3],
    normal: { x: 0, y: -1, z: 0 },
    name: 'back'
  },
  // ... 6 faces total
]
```

## 2. 3D Transformations

### Rotation
- Apply rotation matrices to transform vertices
- Support rotation around X, Y, Z axes
- Rotate both vertices and face normals

```javascript
function rotatePoint(point, rotX, rotY, rotZ) {
  // Apply rotation matrices in sequence
  // Returns transformed {x, y, z}
}
```

### Positioning
- Center geometry on canvas
- Apply position offsets (for interactive movement)

## 3. 3D to 2D Projection

### Isometric Projection
Standard isometric projection formula:
```javascript
isoX = (x - y) * cos(30°)
isoY = -(z + (x + y) * sin(30°))
```

**Key Points:**
- Preserves parallel lines (no vanishing point)
- Consistent scale regardless of depth
- Y-axis is negated for SVG coordinate system (Y increases downward)

### Perspective Projection (Optional)
- Adds depth-based scaling for realistic perspective
- Maintains isometric viewing angle but scales by depth
- Formula: `scale = fov / (cameraDistance + depthOffset)`

### Projection Function
```javascript
function project3DTo2D(x, y, z, viewMode, perspectiveStrength) {
  if (viewMode === 'isometric') {
    return projectToIsometric(x, y, z);
  } else {
    return projectToPerspective(x, y, z, fov, cameraDistance);
  }
}
```

## 4. Face Processing

### Back-Face Culling
Determine which faces are visible:
1. Calculate dot product between face normal and view direction
2. Negative dot product = facing camera = VISIBLE
3. Positive dot product = facing away = HIDDEN

```javascript
const dotProduct = normalizedNormal.x * viewDir.x + 
                   normalizedNormal.y * viewDir.y + 
                   normalizedNormal.z * viewDir.z;

if (dotProduct > 0.01) {
  return null; // Back-facing, hidden
}
```

### Depth Sorting
Sort faces by depth (for proper occlusion):
- Calculate average screen-space Y coordinate for each face
- Sort ascending: back faces first, front faces last
- This ensures proper z-ordering when rendering

```javascript
const avgScreenY = projectedFace.reduce((sum, p) => sum + p.y, 0) / projectedFace.length;
const depth = -avgScreenY; // Negative so higher Y (lower on screen) = smaller depth
faceData.sort((a, b) => a.depth - b.depth);
```

### Lighting Calculation

#### Basic Lighting
Calculate shading for each face:
1. Normalize face normal vector
2. Calculate light direction from angle and elevation
3. Compute dot product: `shading = dot(faceNormal, lightDirection)`
4. Apply brightness and ambient light: `finalShading = ambient + (1-ambient) * shading * brightness`

```javascript
function calculateLightDirection(angle, elevation) {
  // angle = azimuth (rotation around Z-axis, 0-360°)
  // elevation = angle from horizontal (0 = horizontal, 90 = straight down)
  const angleRad = angle * Math.PI / 180;
  const elevRad = elevation * Math.PI / 180;
  
  return {
    x: Math.cos(elevRad) * Math.cos(angleRad),  // X component
    y: Math.cos(elevRad) * Math.sin(angleRad),  // Y component
    z: -Math.sin(elevRad)  // Z component (negative = downward)
  };
}

function calculateShading(normal, lightDir, brightness, ambient) {
  // Normalize vectors
  const normalizedNormal = normalize(normal);
  const normalizedLight = normalize({ x: -lightDir.x, y: -lightDir.y, z: -lightDir.z });
  
  // Dot product: cosine of angle between normal and light
  const dot = normalizedNormal.x * normalizedLight.x + 
              normalizedNormal.y * normalizedLight.y + 
              normalizedNormal.z * normalizedLight.z;
  
  const clampedDot = Math.max(0, dot); // Clamp to [0, 1]
  const diffuse = clampedDot * Math.max(0, brightness);
  
  // Combine ambient and diffuse
  return Math.min(1, Math.max(0, ambient + (1 - ambient) * diffuse));
}
```

#### Advanced Gradient Shading System

For smooth, realistic shading gradients across faces:

**Key Point Calculation:**
1. Identify key points: 4 corners + center of face
2. Calculate shading at each key point using 3D position and light direction
3. Add gradient adjustment based on distance from light source

```javascript
function calculateKeyPointShadings(vertices2D, vertices3D, faceNormal, lightDir, brightness, ambient) {
  const keyPoints = [];
  
  // Get corners and center
  const corners = vertices2D.length >= 4 
    ? [vertices2D[0], vertices2D[Math.floor(vertices2D.length * 0.25)], 
       vertices2D[Math.floor(vertices2D.length * 0.5)], vertices2D[Math.floor(vertices2D.length * 0.75)]]
    : vertices2D;
  
  const center2D = {
    x: vertices2D.reduce((sum, p) => sum + p.x, 0) / vertices2D.length,
    y: vertices2D.reduce((sum, p) => sum + p.y, 0) / vertices2D.length
  };
  
  // Calculate 3D center position
  const center3D = {
    x: vertices3D.reduce((sum, p) => sum + p.x, 0) / vertices3D.length,
    y: vertices3D.reduce((sum, p) => sum + p.y, 0) / vertices3D.length,
    z: vertices3D.reduce((sum, p) => sum + p.z, 0) / vertices3D.length
  };
  
  // Calculate shading for each key point
  for (const point2D of [...corners, center2D]) {
    let shading = calculateShading(faceNormal, lightDir, brightness, ambient);
    
    // Add gradient based on distance from light source
    // Points closer to light (in light direction) are brighter
    const pointIndex = corners.indexOf(point2D);
    const point3D = pointIndex >= 0 ? vertices3D[pointIndex] : center3D;
    
    // Vector from center to point
    const toPoint = {
      x: point3D.x - center3D.x,
      y: point3D.y - center3D.y,
      z: point3D.z - center3D.z
    };
    
    // Dot product with light direction
    const dot = toPoint.x * normalizedLight.x + 
                toPoint.y * normalizedLight.y + 
                toPoint.z * normalizedLight.z;
    
    // Points in light direction get brighter
    const gradientAdjustment = dot * 0.08; // Gentle gradient
    shading = Math.max(0, Math.min(1, shading + gradientAdjustment));
    
    keyPoints.push({ point: point2D, shading });
  }
  
  return keyPoints;
}
```

**Barycentric Interpolation:**
Interpolate shading at any point using weighted average of 3 closest key points:

```javascript
function interpolateShading(point, keyPoints) {
  // Find 3 closest key points
  const distances = keyPoints.map(kp => ({
    point: kp.point,
    shading: kp.shading,
    dist: Math.hypot(point.x - kp.point.x, point.y - kp.point.y)
  }));
  
  distances.sort((a, b) => a.dist - b.dist);
  const [p1, p2, p3] = distances.slice(0, 3);
  
  // Weighted average based on inverse distance
  const w1 = 1 / (p1.dist + 0.1);
  const w2 = 1 / (p2.dist + 0.1);
  const w3 = 1 / (p3.dist + 0.1);
  const totalWeight = w1 + w2 + w3;
  
  return (p1.shading * w1 + p2.shading * w2 + p3.shading * w3) / totalWeight;
}
```

**Falloff Control:**
Apply power function for smooth gradient transitions:
- Lower falloff (2.0) = moderate transition
- Higher falloff (10.0) = very soft, gradual transition
- Uses inverse relationship: `exponent = 1.0 / (falloff * 0.25)`

```javascript
function calculateUnifiedGradient(point2D, vertices2D, vertices3D, faceNormal, lightDir, brightness, ambient, falloff = 2.0) {
  // Calculate key point shadings
  const keyPoints = calculateKeyPointShadings(vertices2D, vertices3D, faceNormal, lightDir, brightness, ambient);
  
  // Interpolate base shading
  const baseShading = interpolateShading(point2D, keyPoints);
  
  // Apply falloff for smooth gradients
  if (faceNormal && vertices3D) {
    const shadingValues = keyPoints.map(kp => kp.shading);
    const shadingRange = Math.max(...shadingValues) - Math.min(...shadingValues);
    
    if (shadingRange > 0.1) {
      // Apply falloff using power function
      const faceExponent = 1.0 / (falloff * 0.35);
      const normalizedShading = (baseShading - minShading) / shadingRange;
      const falloffShading = Math.pow(normalizedShading, faceExponent);
      return minShading + (falloffShading * shadingRange);
    }
  }
  
  return baseShading;
}
```

## 5. Hatch Line Generation

### Purpose
Convert shaded polygons into parallel lines that create visual shading through density variation.

### Basic Hatch Lines
Generate parallel lines at specified angle and spacing:

1. **Calculate Density from Shading**
   ```javascript
   density = 1 - shading; // 0 = light (few lines), 1 = dark (many lines)
   localSpacing = minSpacing + (maxSpacing - minSpacing) * (1 - density);
   ```

2. **Project Polygon onto Perpendicular Direction**
   - Find min/max projection values
   - Generate lines at regular intervals

3. **Find Line-Polygon Intersections**
   - For each hatch line, find intersections with polygon edges
   - Use ray-casting algorithm
   - Sort intersections along line direction

4. **Create Line Segments**
   - Pair up intersections (every 2 intersections = 1 line segment)
   - Filter out segments shorter than minimum length

### Adaptive Hatch Lines (Gradient Shading)
For smooth gradient shading:

1. **Sample Shading at Multiple Points**
   - Generate candidate lines at fine resolution
   - For each candidate, sample shading at representative point
   - Calculate required spacing based on local shading

2. **Adaptive Spacing**
   ```javascript
   requiredSpacing = minSpacing + (baseSpacing - minSpacing) * shading;
   // Only generate line if moved far enough from last line
   if (currentOffset - lastLineOffset >= requiredSpacing * 0.85) {
     // Generate line at this position
   }
   ```

3. **Gradient Calculation**
   - For each point, calculate shading based on:
     - 3D position (interpolated from face vertices)
     - Face normal
     - Light direction
     - Distance from light source

### Cross-Hatch
Generate perpendicular hatch lines (90° offset) for enhanced shading:

1. **Primary Hatch Lines**: Generated at base angle
2. **Cross-Hatch Lines**: Generated at `(angle + 90) % 180`
3. **Density Control**: Cross-hatch spacing adjusted by density factor
   ```javascript
   crossBaseSpacing = baseSpacing / crossHatchDensity;
   crossMinSpacing = minSpacing / crossHatchDensity;
   ```
4. **Combination**: Merge both sets of lines

**Implementation:**
```javascript
if (crossHatch && crossHatchDensity > 0) {
  const crossAngle = (angle + 90) % 180;
  const crossBaseSpacing = baseSpacing / crossHatchDensity;
  const crossMinSpacing = minSpacing / crossHatchDensity;
  
  const crossLines = generateAdaptiveHatchLines(
    polygon,
    crossBaseSpacing,
    crossMinSpacing,
    crossAngle,
    bounds,
    calculateShading
  );
  
  // For new cross-hatch system, reduce density
  const keepRatio = 0.5; // Keep 50% of cross-hatch lines
  const filteredCross = crossLines.filter((_, idx) => 
    idx % Math.ceil(1 / keepRatio) === 0
  );
  
  lines.push(...filteredCross);
}
```

### Key Algorithm
```javascript
function generateHatchLines(polygon, shading, spacing, minSpacing, angle, bounds) {
  // 1. Calculate density from shading
  const density = 1 - shading;
  const localSpacing = minSpacing + (spacing - minSpacing) * (1 - density);
  
  // 2. Calculate hatch direction
  const angleRad = angle * Math.PI / 180;
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  const perpX = -dy; // Perpendicular for spacing
  const perpY = dx;
  
  // 3. Project polygon onto perpendicular
  const projMin = polygon.reduce((min, p) => 
    Math.min(min, p.x * perpX + p.y * perpY), Infinity);
  const projMax = polygon.reduce((max, p) => 
    Math.max(max, p.x * perpX + p.y * perpY), -Infinity);
  
  // 4. Generate lines at intervals
  const lines = [];
  for (let offset = projMin; offset <= projMax; offset += localSpacing) {
    // Find intersections with polygon edges
    const intersections = findLinePolygonIntersections(offset, polygon, perpX, perpY, dx, dy);
    
    // Create line segments from intersection pairs
    for (let i = 0; i < intersections.length - 1; i += 2) {
      lines.push({
        x1: intersections[i].x,
        y1: intersections[i].y,
        x2: intersections[i+1].x,
        y2: intersections[i+1].y
      });
    }
  }
  
  return lines;
}
```

## 6. Occlusion Clipping

### Purpose
Remove parts of hatch lines that are hidden behind other faces (hidden surface removal).

### Algorithm
For each hatch line:
1. Check if line passes through occluding face
2. Clip line against occluding polygon
3. Keep only visible segments

### Line-Polygon Clipping
```javascript
function clipLineAgainstPolygon(line, polygon) {
  const p1 = { x: line.x1, y: line.y1 };
  const p2 = { x: line.x2, y: line.y2 };
  
  const p1Inside = pointInPolygon(p1, polygon);
  const p2Inside = pointInPolygon(p2, polygon);
  
  // Case 1: Both inside = fully occluded
  if (p1Inside && p2Inside) return null;
  
  // Case 2: Find intersections with polygon edges
  const intersections = [];
  for (let i = 0; i < polygon.length; i++) {
    const edge = [polygon[i], polygon[(i+1) % polygon.length]];
    const intersection = lineEdgeIntersection(line, edge);
    if (intersection) intersections.push(intersection);
  }
  
  // Case 3: One endpoint inside = clip at first intersection
  if (p1Inside && intersections.length > 0) {
    return { x1: intersections[0].x, y1: intersections[0].y, x2: line.x2, y2: line.y2 };
  }
  
  // Case 4: Both outside with intersections = split into segments
  if (!p1Inside && !p2Inside && intersections.length >= 2) {
    return [
      { x1: line.x1, y1: line.y1, x2: intersections[0].x, y2: intersections[0].y },
      { x1: intersections[1].x, y1: intersections[1].y, x2: line.x2, y2: line.y2 }
    ];
  }
  
  return line; // No occlusion
}
```

### Expansion Factor
To prevent visual gaps, expand occluding polygons slightly:
```javascript
const expansionFactor = 1.005; // 0.5% expansion
const expandedFace = face.map(p => ({
  x: faceCenterX + (p.x - faceCenterX) * expansionFactor,
  y: faceCenterY + (p.y - faceCenterY) * expansionFactor
}));
```

### Multiple Occluders
- Check against all faces in front (closer to camera)
- Clip iteratively: clip result of previous clip against next occluder
- Early exit if all segments are occluded

## 7. Shadow Rendering

### Shadow Projection
Project cube vertices onto floor plane along light direction:
```javascript
function projectShadow(vertices, lightDir, floorZ) {
  const MAX_SHADOW_DISTANCE = 500; // mm - prevent infinite projections
  const shadowVertices = [];
  
  for (const v of vertices) {
    if (Math.abs(lightDir.z) < 1e-6) {
      // Light is horizontal - project vertically down
      shadowVertices.push({ x: v.x, y: v.y, z: floorZ });
      continue;
    }
    
    // Find intersection of light ray with floor
    const t = (floorZ - v.z) / lightDir.z;
    
    if (t >= 0 && t < MAX_SHADOW_DISTANCE) {
      const shadowX = v.x + t * lightDir.x;
      const shadowY = v.y + t * lightDir.y;
      shadowVertices.push({ x: shadowX, y: shadowY, z: floorZ });
    }
  }
  
  return shadowVertices;
}
```

### Shadow Layers
Create multiple shadow layers for realistic soft shadows:

1. **Contact Shadow**: Cube's bottom face (where it touches floor)
2. **Blend Layers**: Smooth transition from contact to projected shadow
3. **Projected Shadow**: Full light-projected shadow polygon
4. **Blur Layers**: Directional extension beyond shadow edge (for soft edges)

```javascript
const shadowLayers = [
  { type: 'contact', scale: 1.00, darkness: 0.45, crossHatch: true },
  { type: 'blend',   scale: 0.25, darkness: 0.38, crossHatch: true },
  { type: 'project', scale: 0.50, darkness: 0.28, crossHatch: true },
  { type: 'project', scale: 0.75, darkness: 0.18, crossHatch: false },
  { type: 'project', scale: 1.00, darkness: 0.10, crossHatch: false }
];

// Add directional blur layers if soft edges enabled
if (shadowSoftEdges && shadowFalloff > 1.0) {
  const numBlurLayers = Math.ceil(2 + blurIntensity * 2);
  for (let i = 1; i <= numBlurLayers; i++) {
    const blurExtension = (i / numBlurLayers) * maxBlurExtension;
    const blurDarkness = 0.08 * Math.pow(1 - t, falloffPower);
    shadowLayers.push({
      type: 'directionalBlur',
      blurExtension: blurExtension,
      darkness: blurDarkness,
      crossHatch: false
    });
  }
}
```

### Shadow Gradient Calculation
Calculate shading gradient within shadow for smooth transitions:

```javascript
function calculateShadowGradient(point, cubeBottomFace2D, shadowPolygon, lightAngle, lightElevation, lightBrightness, ambientLight, falloff = 2.0) {
  // Calculate contact point (center of cube bottom face)
  const contactPoint = {
    x: cubeBottomFace2D.reduce((sum, p) => sum + p.x, 0) / cubeBottomFace2D.length,
    y: cubeBottomFace2D.reduce((sum, p) => sum + p.y, 0) / cubeBottomFace2D.length
  };
  
  // Distance from contact point
  const distFromContact = Math.hypot(point.x - contactPoint.x, point.y - contactPoint.y);
  
  // Calculate max distance from contact to edge
  let maxDist = 0;
  shadowPolygon.forEach(v => {
    const dist = Math.hypot(v.x - contactPoint.x, v.y - contactPoint.y);
    maxDist = Math.max(maxDist, dist);
  });
  
  // Normalize distance (0 = at contact, 1 = at edge)
  const normalizedDist = maxDist > 0 ? Math.min(1, distFromContact / maxDist) : 0;
  
  // Apply falloff using power function
  const exponent = 1.0 / (falloff * 0.25);
  const falloffDist = Math.pow(normalizedDist, exponent);
  
  // Shadow gradient: darker near contact (0.3), lighter at edges (0.8)
  const shadowShading = 0.3 + (0.5 * falloffDist);
  
  return shadowShading;
}
```

### Shadow Occlusion
- Clip shadow hatch lines against cube silhouette (convex hull of visible vertices)
- Use expanded occlusion polygon (configurable expansion factor, default 0.2%)
- Apply inset to line endpoints for extra safety (prevents leaks)
- Check against all visible cube faces (not just silhouette)

### Directional Blur
For soft shadow edges, extend shadow only in direction away from light:

```javascript
if (layer.type === 'directionalBlur') {
  // Calculate direction from cube base to shadow point
  const dx = shadowPt.x - cubeBottomCenterX;
  const dy = shadowPt.y - cubeBottomCenterY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist > 1.0) {
    const dirX = dx / dist;
    const dirY = dy / dist;
    
    // Dot product with light direction
    const dotWithLight = dirX * lightDir2D.x + dirY * lightDir2D.y;
    
    // Smooth transition zone (smoothstep function)
    let blurFactor = 0;
    if (dotWithLight < -0.2) {
      blurFactor = 0; // Fully lit side - no blur
    } else if (dotWithLight > 0.5) {
      blurFactor = 1; // Fully shadow side - full blur
    } else {
      const t = (dotWithLight + 0.2) / 0.7; // Map [-0.2, 0.5] to [0, 1]
      blurFactor = t * t * (3 - 2 * t); // Smoothstep
    }
    
    if (blurFactor > 0.01) {
      const extensionAmount = dist * layer.blurExtension * blurFactor;
      return {
        x: shadowPt.x + dirX * extensionAmount,
        y: shadowPt.y + dirY * extensionAmount
      };
    }
  }
  
  return shadowPt; // No blur
}
```

## 8. Line Jitter / Waviness

### Purpose
Apply subtle, human-like waviness to lines for hand-drawn appearance. Each line gets unique random deformation parameters.

### Algorithm
Generate wavy polyline path from straight line:

```javascript
function createWavyLine(x1, y1, x2, y2, jitterIntensity, waveFrequency, randomness) {
  // Calculate line properties
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const dirX = dx / length;
  const dirY = dy / length;
  const perpX = -dirY; // Perpendicular for waviness
  const perpY = dirX;
  
  // Generate unique seed from line coordinates
  const lineSeed = hashCoordinates(x1, y1, x2, y2);
  
  // Generate unique wave parameters for this line
  const phase1 = seededRandom(lineSeed) * Math.PI * 2;
  const phase2 = seededRandom(lineSeed + 1000) * Math.PI * 2;
  const phase3 = seededRandom(lineSeed + 2000) * Math.PI * 2;
  
  // Wave frequency control: 0-100 maps to 0.3x to 2.5x multiplier
  const frequencyMultiplier = 0.3 + (waveFrequency / 100) * 2.2;
  const freq1 = 4 * frequencyMultiplier;
  const freq2 = 2 * frequencyMultiplier;
  const freq3 = 6 * frequencyMultiplier;
  
  // Wave amplitudes (vary per line)
  const amp1 = 0.4 + (seededRandom(lineSeed + 6000) - 0.5) * 0.3;
  const amp2 = 0.3 + (seededRandom(lineSeed + 7000) - 0.5) * 0.2;
  const amp3 = 0.2 + (seededRandom(lineSeed + 8000) - 0.5) * 0.15;
  
  // Randomness control: 0-100 maps to 0.05 to 0.5
  const baseRandomness = 0.05 + (randomness / 100) * 0.45;
  const randomnessFactor = baseRandomness + (seededRandom(lineSeed + 9000) - 0.5) * baseRandomness * 0.4;
  
  // Generate points along line
  const numSegments = Math.max(2, Math.ceil(length / 2.5)); // ~2.5mm segments
  const points = [{ x: x1, y: y1 }]; // Start point
  
  for (let i = 1; i < numSegments; i++) {
    const t = i / numSegments;
    const baseX = x1 + t * dx;
    const baseY = y1 + t * dy;
    
    // Generate waviness using multiple sine waves
    const wave1 = Math.sin(t * Math.PI * freq1 + phase1) * amp1;
    const wave2 = Math.sin(t * Math.PI * freq2 + phase2) * amp2;
    const wave3 = Math.sin(t * Math.PI * freq3 + phase3) * amp3;
    
    // Add per-segment randomness
    const segmentSeed = lineSeed + i * 100;
    const random1 = (seededRandom(segmentSeed) - 0.5) * randomnessFactor;
    const random2 = (seededRandom(segmentSeed + 5000) - 0.5) * randomnessFactor * 0.5;
    
    // Combine waves with randomness
    const wavinessAmount = (jitterIntensity / 100) * 0.52; // Max 0.52mm at 100%
    const waveOffset = (wave1 + wave2 + wave3 + random1 + random2) * wavinessAmount;
    
    // Apply perpendicular offset
    points.push({
      x: baseX + perpX * waveOffset,
      y: baseY + perpY * waveOffset
    });
  }
  
  points.push({ x: x2, y: y2 }); // End point
  return points;
}
```

### Key Features
- **Unique per line**: Each line gets different wave parameters based on coordinates
- **Deterministic**: Same line always produces same wavy path
- **Subtle**: Maximum waviness ~0.52mm (very subtle hand-drawn effect)
- **Configurable**: Intensity (0-100), frequency (0-100), randomness (0-100)
- **Multiple waves**: Combines 3 sine waves with different frequencies for natural variation

### SVG Output
Wavy lines are output as `<polyline>` elements instead of `<line>`:
```xml
<polyline points="10,20 10.1,20.05 10.2,20.08 ... 30,40" 
          stroke="#000000" 
          stroke-width="0.3" 
          fill="none"/>
```

## 9. SVG Output

### Line Elements
Each visible line segment becomes an SVG `<line>` element:
```xml
<line x1="10" y1="20" x2="30" y2="40" 
      stroke="#000000" 
      stroke-width="0.3" 
      data-face="top" />
```

### Layer Organization
Group lines by face into SVG `<g>` elements:
```xml
<g id="layer-top" inkscape:label="Top" data-face="top">
  <line ... />
  <line ... />
</g>
```

### Export Process
1. Clone SVG DOM
2. Remove preview-only elements (grid, boundaries)
3. Group lines by face (if using face colors)
4. Set proper dimensions and viewBox
5. Serialize to XML string
6. Create downloadable blob

### Plotter Compatibility
- All coordinates in millimeters (mm)
- No fills, only strokes
- Proper stroke-width for pen size
- Clean line segments (no curves unless jitter enabled)

## 10. Rendering Modes

### Simple Shading Mode
- Uniform shading per face
- Fixed hatch line spacing based on face shading value
- Faster computation
- Good for basic rendering

### Advanced Shading Mode
- Gradient shading across each face
- Adaptive hatch line spacing (varies based on local shading)
- Smooth transitions using key point interpolation
- Shadow falloff control for soft edges
- More realistic appearance
- Slower computation

**Key Differences:**
```javascript
if (advancedShading) {
  // Use adaptive hatch lines with gradient shading
  hatchLines = generateAdaptiveHatchLines(
    projectedFace,
    hatchSpacing,
    minSpacing,
    faceHatchAngle,
    bounds,
    (point2D) => calculateFaceGradientShading(
      point2D, projectedFace, faceVertices3D, 
      normalizedNormal, lightDir, lightBrightness, 
      ambientLight, shadowFalloff
    ),
    crossHatch,
    crossHatchDensity
  );
} else {
  // Use uniform face shading
  hatchLines = generateHatchLines(
    projectedFace, shading, hatchSpacing, 
    minSpacing, faceHatchAngle, bounds
  );
}
```

## 11. Key Algorithms Summary

### Point-in-Polygon Test
Ray casting algorithm:
```javascript
function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const intersect = ((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
      (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / 
                 (polygon[j].y - polygon[i].y) + polygon[i].x);
    if (intersect) inside = !inside;
  }
  return inside;
}
```

### Convex Hull
Gift wrapping algorithm (Jarvis march) for creating shadow silhouettes:
- Find bottommost-leftmost point
- Iteratively find next point that makes smallest left turn
- Continue until returning to start

### Line-Edge Intersection
Calculate intersection between line segment and polygon edge:
```javascript
function lineEdgeIntersection(line, edge) {
  const denom = (line.x2 - line.x1) * (edge[1].y - edge[0].y) - 
                (line.y2 - line.y1) * (edge[1].x - edge[0].x);
  if (Math.abs(denom) < 1e-9) return null; // Parallel
  
  const t = ((edge[0].x - line.x1) * (edge[1].y - edge[0].y) - 
             (edge[0].y - line.y1) * (edge[1].x - edge[0].x)) / denom;
  const u = ((edge[0].x - line.x1) * (line.y2 - line.y1) - 
             (edge[0].y - line.y1) * (line.x2 - line.x1)) / denom;
  
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: line.x1 + t * (line.x2 - line.x1),
      y: line.y1 + t * (line.y2 - line.y1)
    };
  }
  return null;
}
```

## 12. Performance Optimizations

### Depth Sorting
- Only check occlusion against faces in front (not all faces)
- Early exit if all segments occluded

### Bounding Box Checks
- Quick overlap test before detailed clipping
- Skip occlusion checks if bounding boxes don't overlap

### Adaptive Resolution
- Use fine resolution for adaptive hatch lines
- Filter candidates based on spacing requirements

## 13. STL File Adaptation Considerations

For adapting this approach to STL files:

### STL Parsing
1. Parse STL file (ASCII or binary format)
2. Extract triangle facets (vertices + normals)
3. Group triangles into connected surfaces (optional)

### Geometry Processing
1. **Triangulation**: STL files are already triangulated
2. **Face Grouping**: May need to merge triangles into larger faces for better hatch patterns
3. **Normal Calculation**: Use STL normals or recalculate from vertices

### Rendering Adaptations
1. **Projection**: Same isometric/perspective projection works
2. **Back-Face Culling**: Use STL normals directly
3. **Hatch Lines**: Generate per-triangle or per-surface group
4. **Occlusion**: More complex with many small triangles - may need spatial acceleration

### Key Differences
- **Complexity**: STL files have many more faces than a cube
- **Topology**: May have holes, non-manifold geometry, or disconnected parts
- **Scale**: Need to handle arbitrary model sizes and scales
- **Performance**: May need optimization for large models (thousands of triangles)

## 14. Module Architecture

The codebase is organized into focused modules:

```
src/
├── core/              # Core geometry & math
│   ├── geometry.js    # Polygon utilities, convex hull
│   ├── projection.js  # 3D→2D projection
│   └── transformations.js # 3D rotations
├── rendering/         # Main rendering engine
│   ├── renderer.js    # Main draw() function
│   └── clipping.js    # Line clipping algorithms
├── shading/           # Shading effects
│   ├── hatchLines.js  # Hatch line generation
│   └── shadow.js      # Shadow projection
├── lighting/          # Lighting calculations
│   ├── lightCalculation.js # Basic lighting
│   └── gradientShading.js  # Gradient shading
└── export/            # Export functionality
    └── svgExporter.js  # SVG export
```

## 15. Critical Implementation Details

### Coordinate Systems
- **3D Space**: Right-handed, Z-up
- **2D Screen**: SVG coordinates (Y increases downward)
- **Units**: Millimeters (mm) throughout

### Precision
- Use tight tolerances for clipping (0.001mm)
- Handle floating-point precision issues
- Remove duplicate points/intersections

### Edge Cases
- Degenerate polygons (collinear points)
- Parallel lines/edges
- Zero-length segments
- Points exactly on polygon boundaries

## 16. Output Format

### SVG Structure
```xml
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     width="297mm" height="210mm"
     viewBox="0 0 297 210">
  <g id="layer-shadow" inkscape:label="Shadow">
    <line x1="..." y1="..." x2="..." y2="..." stroke="#000000" stroke-width="0.3"/>
  </g>
  <g id="layer-face1" inkscape:label="Face1">
    <line ... />
  </g>
</svg>
```

### Plotter Requirements
- All coordinates in mm
- No fills, only strokes
- Proper stroke-width (typically 0.2-0.5mm)
- Clean line segments
- Organized layers for multi-color plotting

---

## Summary

This rendering method converts 3D geometry to plotter-ready line art through:

1. **Projection**: 3D→2D conversion (isometric/perspective)
2. **Lighting**: Basic and advanced gradient shading systems
3. **Hatching**: 
   - Basic hatch lines with uniform spacing
   - Adaptive hatch lines with gradient-based spacing
   - Cross-hatching for enhanced shading
4. **Shadows**: Multi-layer shadow system with soft edges and directional blur
5. **Occlusion**: Precise clipping of hidden line segments
6. **Line Effects**: Optional waviness/jitter for hand-drawn appearance
7. **Export**: Clean SVG output organized by layers

### Key Rendering Features Covered:
- ✅ Basic lighting calculation (dot product, ambient, brightness)
- ✅ Advanced gradient shading (key points, barycentric interpolation, falloff)
- ✅ Hatch line generation (basic and adaptive)
- ✅ Cross-hatching system
- ✅ Shadow projection and multi-layer rendering
- ✅ Shadow gradient calculation with falloff
- ✅ Directional blur for soft shadow edges
- ✅ Line jitter/waviness for hand-drawn effect
- ✅ Occlusion clipping (precise and standard)
- ✅ Depth sorting and back-face culling
- ✅ SVG export with layer organization

The approach is modular, precise, and optimized for plotter printing. It can be adapted for STL files with additional geometry processing and performance optimizations.


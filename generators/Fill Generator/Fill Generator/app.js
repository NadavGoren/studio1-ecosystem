/* ============================================================
   HATCH ENGINE — REWRITE v1
   Part 1: Setup, Utilities, Noise (Value + Curl)
   Debug Mode: ENABLED
============================================================ */

/* ------------------------------
   Configuration
------------------------------ */
const DEBUG = true;
function log(...args) {
  if (DEBUG) console.log(...args);
}

const DEFAULT_CANVAS = { width: 420, height: 297 };
const CANVAS_PRESETS = {
  A2: { width: 594, height: 420 },
  A3: { width: 420, height: 297 },
  A4: { width: 297, height: 210 },
  A5: { width: 210, height: 148 },
  A6: { width: 148, height: 105 }
};

/* ------------------------------
   Seeded RNG (Mulberry32)
------------------------------ */
function mulberry32(seed) {
  return function() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ============================================================
   VALUE NOISE (core)
   This is not Perlin. It is fast, deterministic value noise.
============================================================ */

/* Hash function */
function hash(ix, iy) {
  let t = ix * 374761393 + iy * 668265263;
  t = (t ^ (t >> 13)) >>> 0;
  return t;
}

/* Interpolation */
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(t) { return t * t * (3 - 2 * t); }
function smootherstep(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

/* Catmull-Rom spline interpolation for smooth curves */
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  };
}

/* Ultra-smooth interpolation with multiple passes */
function ultraSmooth(p0, p1, p2, p3, t) {
  // First pass: Catmull-Rom
  const cr1 = catmullRom(p0, p1, p2, p3, t);
  
  // Second pass: Apply smootherstep to the interpolation parameter for extra smoothness
  const ultraT = smootherstep(t);
  const cr2 = catmullRom(p0, p1, p2, p3, ultraT);
  
  // Third pass: Even more aggressive smoothing
  const superUltraT = smootherstep(smootherstep(t));
  const cr3 = catmullRom(p0, p1, p2, p3, superUltraT);
  
  // Blend all three passes for maximum smoothness
  return {
    x: cr1.x * 0.3 + cr2.x * 0.4 + cr3.x * 0.3,
    y: cr1.y * 0.3 + cr2.y * 0.4 + cr3.y * 0.3
  };
}

/* Base value noise */
function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);

  const xf = x - xi;
  const yf = y - yi;

  const h00 = hash(xi, yi);
  const h10 = hash(xi + 1, yi);
  const h01 = hash(xi, yi + 1);
  const h11 = hash(xi + 1, yi + 1);

  const nx0 = lerp(h00, h10, smoothstep(xf));
  const nx1 = lerp(h01, h11, smoothstep(xf));
  const n = lerp(nx0, nx1, smoothstep(yf));

  return (n / 4294967295) * 2 - 1; // [-1, 1]
}

/* ============================================================
   CURL NOISE (medium-flow field)
   Derived from value noise.
   Produces smooth, coherent vector fields:
   curl = [ d/dy noise, -d/dx noise ]
============================================================ */

function curlNoise(x, y, scale = 60) {
  const eps = 1.0;

  // Sample offsets
  const n1 = valueNoise((x + eps) / scale, y / scale);
  const n2 = valueNoise((x - eps) / scale, y / scale);
  const n3 = valueNoise(x / scale, (y + eps) / scale);
  const n4 = valueNoise(x / scale, (y - eps) / scale);

  const dx = (n1 - n2) * 0.5;  
  const dy = (n3 - n4) * 0.5;

  // Curl vector
  return { x: dy, y: -dx };
}

/* ============================================================
   GEOMETRY CLIPPER
   Clip infinite line (x0,y0,direction) to rectangular bounds.
============================================================ */
function clipLineToRect(xmin, ymin, xmax, ymax, x0, y0, dx, dy) {
  const ts = [];

  function checkX(xEdge) {
    if (Math.abs(dx) < 1e-6) return;
    let t = (xEdge - x0) / dx;
    let y = y0 + t * dy;
    if (y >= ymin && y <= ymax) ts.push(t);
  }

  function checkY(yEdge) {
    if (Math.abs(dy) < 1e-6) return;
    let t = (yEdge - y0) / dy;
    let x = x0 + t * dx;
    if (x >= xmin && x <= xmax) ts.push(t);
  }

  checkX(xmin); checkX(xmax);
  checkY(ymin); checkY(ymax);

  if (ts.length < 2) return null;

  ts.sort((a, b) => a - b);
  const t1 = ts[0], t2 = ts[ts.length - 1];

  return {
    x1: x0 + t1 * dx,
    y1: y0 + t1 * dy,
    x2: x0 + t2 * dx,
    y2: y0 + t2 * dy
  };
}

/* ============================================================
   Utility: Exponential jitter
============================================================ */
function computeJitter(jitterPct, strokeWidth) {
  const ratio = (jitterPct / 100);
  const expo = ratio * ratio;      // exponential
  return expo * strokeWidth * 2.0; // jitter band
}/* ============================================================
   PART 2 — ANGLE SYSTEM + UI BEHAVIOR
============================================================ */

/* ------------------------------
   Evaluate Angle for Each Line
   Returns angle in radians.
------------------------------ */

function computeAngle(px, py, params) {
  const {
    angleBehavior,
    angleDeg,
    dynamicAngleMode,
    canvasWidth,
    canvasHeight,
    // Pattern-specific parameters
    radialCenterX,
    radialCenterY,
    radialOffset,
    spiralCenterX,
    spiralCenterY,
    spiralTightness,
    spiralType,
    waveFrequency,
    waveAmplitude,
    waveDirection,
    gridSize,
    gridRotation,
    concentricCenterX,
    concentricCenterY,
    lissajousA,
    lissajousB,
    lissajousPhase
  } = params;

  const baseAngle = angleDeg * Math.PI / 180;

  // --------------------------
  // Uniform mode
  // --------------------------
  if (angleBehavior === "uniform") {
    return baseAngle;
  }

  // --------------------------
  // Mathematical Pattern Modes
  // --------------------------
  if (angleBehavior === "dynamic") {

    // RADIAL PATTERN: Lines radiate from a center point
    if (dynamicAngleMode === "radial") {
      const dx = px - radialCenterX;
      const dy = py - radialCenterY;
      const distance = Math.hypot(dx, dy);
      
      // Handle center point gracefully
      if (distance < 0.1) {
        return baseAngle;
      }
      
      const angle = Math.atan2(dy, dx) + (radialOffset * Math.PI / 180);
      return angle;
    }

    // SPIRAL PATTERNS: Logarithmic or Archimedean spirals
    if (dynamicAngleMode === "spiral") {
      const dx = px - spiralCenterX;
      const dy = py - spiralCenterY;
      const distance = Math.hypot(dx, dy);
      
      // Avoid division by zero and ensure smooth behavior at center
      if (distance < 0.1) {
        return baseAngle;
      }
      
      const baseRadialAngle = Math.atan2(dy, dx);
      
      if (spiralType === "logarithmic") {
        // Logarithmic spiral: angle = atan2(y, x) + a * ln(r)
        // Use normalized distance for smoother curves
        const normalizedDist = distance / Math.max(canvasWidth, canvasHeight);
        const spiralRotation = spiralTightness * Math.log(normalizedDist * 10 + 1) * 0.5;
        const spiralAngle = baseRadialAngle + spiralRotation;
        return spiralAngle;
      } else {
        // Archimedean spiral: angle = atan2(y, x) + a * r
        // Use normalized distance for better scaling
        const normalizedDist = distance / Math.max(canvasWidth, canvasHeight);
        const spiralRotation = spiralTightness * normalizedDist * 2;
        const spiralAngle = baseRadialAngle + spiralRotation;
        return spiralAngle;
      }
    }

    // WAVE PATTERNS: Sine/cosine waves across canvas with improved scaling
    if (dynamicAngleMode === "wave") {
      // Normalize coordinates for consistent wave behavior across canvas sizes
      const normalizedX = px / Math.max(canvasWidth, 1);
      const normalizedY = py / Math.max(canvasHeight, 1);
      
      let waveValue = 0;
      
      if (waveDirection === "x") {
        // Wave along X axis
        waveValue = Math.sin(normalizedX * waveFrequency * Math.PI * 2);
      } else if (waveDirection === "y") {
        // Wave along Y axis
        waveValue = Math.sin(normalizedY * waveFrequency * Math.PI * 2);
      } else if (waveDirection === "grid") {
        // Wave grid: combination of X and Y waves, normalized
        waveValue = (Math.sin(normalizedX * waveFrequency * Math.PI * 2) + 
                     Math.sin(normalizedY * waveFrequency * Math.PI * 2)) * 0.5;
      }
      
      const angle = baseAngle + waveValue * waveAmplitude * Math.PI / 180;
      return angle;
    }

    // GRID PATTERN: Alternating angles based on grid cells with smooth transitions
    if (dynamicAngleMode === "grid") {
      // Calculate grid position with sub-cell precision for smoothing
      const gridX = px / gridSize;
      const gridY = py / gridSize;
      
      // Get integer grid coordinates
      const gridXi = Math.floor(gridX);
      const gridYi = Math.floor(gridY);
      
      // Get fractional part for smooth interpolation
      const fx = gridX - gridXi;
      const fy = gridY - gridYi;
      
      // Check if we're near a grid boundary (within 20% of cell edge)
      const nearEdgeX = fx < 0.2 || fx > 0.8;
      const nearEdgeY = fy < 0.2 || fy > 0.8;
      
      // Base angles
      const angle1 = baseAngle;
      const angle2 = baseAngle + (gridRotation * Math.PI / 180);
      
      // Determine base pattern (checkerboard)
      const isEven = (gridXi + gridYi) % 2 === 0;
      let targetAngle = isEven ? angle1 : angle2;
      
      // Smooth transition at grid boundaries
      if (nearEdgeX || nearEdgeY) {
        // Interpolate between adjacent cells
        const distToEdge = Math.min(fx, 1 - fx, fy, 1 - fy);
        const blendFactor = Math.max(0, (distToEdge - 0.1) / 0.1); // Smooth over 10% of cell
        
        // Get angle from adjacent cell
        const adjIsEven = nearEdgeX ? ((gridXi + (fx < 0.5 ? -1 : 1) + gridYi) % 2 === 0) :
                                   ((gridXi + gridYi + (fy < 0.5 ? -1 : 1)) % 2 === 0);
        const adjAngle = adjIsEven ? angle1 : angle2;
        
        // Blend angles smoothly
        const angleDiff = ((adjAngle - targetAngle + Math.PI) % (2 * Math.PI)) - Math.PI;
        targetAngle = targetAngle + angleDiff * (1 - blendFactor);
      }
      
      return targetAngle;
    }

    // CONCENTRIC PATTERN: Lines tangent to concentric circles with smooth variation
    if (dynamicAngleMode === "concentric") {
      const dx = px - concentricCenterX;
      const dy = py - concentricCenterY;
      const distance = Math.hypot(dx, dy);
      
      // Avoid issues at center
      if (distance < 0.1) {
        return baseAngle;
      }
      
      // Base angle is tangent to circle (perpendicular to radial)
      const radialAngle = Math.atan2(dy, dx);
      const tangentAngle = radialAngle + Math.PI / 2;
      
      // Add subtle variation based on distance to create more organic look
      // This prevents all lines at same distance from having identical angles
      const distanceVariation = Math.sin(distance * 0.1) * 0.05; // Small variation
      
      return tangentAngle + distanceVariation;
    }

    // LISSAJOUS PATTERN: Based on parametric Lissajous curves
    if (dynamicAngleMode === "lissajous") {
      // Normalize position to [-1, 1] range
      const normalizedX = (px - canvasWidth / 2) / Math.max(canvasWidth, canvasHeight) * 2;
      const normalizedY = (py - canvasHeight / 2) / Math.max(canvasWidth, canvasHeight) * 2;
      
      // Map position to parameter t (use both x and y for better coverage)
      const t = Math.atan2(normalizedY, normalizedX);
      
      // Lissajous curve derivatives (tangent direction)
      const dx = -lissajousA * Math.sin(lissajousA * t + lissajousPhase);
      const dy = lissajousB * Math.cos(lissajousB * t);
      
      // Avoid zero vector
      const magnitude = Math.hypot(dx, dy);
      if (magnitude < 0.001) {
        return baseAngle;
      }
      
      const angle = Math.atan2(dy, dx);
      return angle;
    }
  }

  // fallback
  return baseAngle;
}

/* ============================================================
   UI LOGIC: ADVANCED SECTIONS
============================================================ */

function setupAdvancedToggles() {
  document.querySelectorAll(".advanced-toggle").forEach(toggle => {
    toggle.addEventListener("click", () => {
      const targetID = toggle.dataset.target;
      const section = document.getElementById(targetID);

      if (!section) return;

      const isOpen = section.style.display === "block";
      section.style.display = isOpen ? "none" : "block";

      // Change arrow
      toggle.textContent = isOpen ? "Advanced ▶" : "Advanced ▼";
    });
  });

  // Default all advanced sections closed
  document.querySelectorAll(".advanced-section").forEach(sec => {
    sec.style.display = "none";
  });

  // Dynamic angle advanced is initially closed unless needed
  document.getElementById("dynamicAngle").style.display = "none";

  // Crosshatch advanced closed by default
  document.getElementById("crosshatchAdvanced").style.display = "none";
}

/* ============================================================
   UI LOGIC: Angle Behavior Sync
============================================================ */

function updateAngleUI() {
  const behavior = document.getElementById("angleBehavior").value;

  const dynamicSec = document.getElementById("dynamicAngle");

  if (behavior === "dynamic") {
    dynamicSec.style.display = "block";
    document.querySelector(".advanced-toggle[data-target='dynamicAngle']").textContent = "Advanced ▼";
  } else {
    dynamicSec.style.display = "none";
  }

  // Dynamic mode internal visibility
  const dynamicMode = document.getElementById("dynamicAngleMode").value;

  // Hide all dynamic-only groups
  document.querySelectorAll(".dynamic-only").forEach(el => {
    el.style.display = "none";
  });

  // Show the relevant pattern controls
  if (dynamicMode === "radial") {
    document.querySelectorAll(".radial-only").forEach(el => el.style.display = "block");
  } else if (dynamicMode === "spiral") {
    document.querySelectorAll(".spiral-only").forEach(el => el.style.display = "block");
  } else if (dynamicMode === "wave") {
    document.querySelectorAll(".wave-only").forEach(el => el.style.display = "block");
  } else if (dynamicMode === "grid") {
    document.querySelectorAll(".grid-only").forEach(el => el.style.display = "block");
  } else if (dynamicMode === "concentric") {
    document.querySelectorAll(".concentric-only").forEach(el => el.style.display = "block");
  } else if (dynamicMode === "lissajous") {
    document.querySelectorAll(".lissajous-only").forEach(el => el.style.display = "block");
  }
}

/* ============================================================
   UI LOGIC: Crosshatch Advanced
============================================================ */

function updateCrosshatchUI() {
  const chk = document.getElementById("crosshatch").checked;
  const sec = document.getElementById("crosshatchAdvanced");
  if (sec) sec.style.display = chk ? "block" : "none";
}

/* ============================================================
   UI LOGIC: Gradient Toggle
============================================================ */

function updateGradientUI() {
  const enabled = document.getElementById("gradientEnabled").checked;
  const controls = document.getElementById("gradientControls");
  if (controls) {
    controls.style.display = enabled ? "" : "none";
  }
}

/* ============================================================
   LABEL UPDATES
============================================================ */

function updateLabels() {
  /* Global */
  const presetEl = document.getElementById("canvasPreset");
  if (presetEl) {
    document.getElementById("canvasPresetLabel").textContent =
      presetEl.options[presetEl.selectedIndex].textContent.split(" (")[0];
  }

  document.getElementById("canvasWidthValue").textContent =
    document.getElementById("canvasWidth").value;

  document.getElementById("canvasHeightValue").textContent =
    document.getElementById("canvasHeight").value;

  document.getElementById("marginValue").textContent =
    document.getElementById("margin").value;

  document.getElementById("strokeWidthValue").textContent =
    document.getElementById("strokeWidth").value;

  document.getElementById("spacingValue").textContent =
    document.getElementById("spacing").value;

  const colorVal = document.getElementById("strokeColor").value;
  document.getElementById("colorValue").textContent = colorVal;

  document.getElementById("jitterValue").textContent =
    document.getElementById("jitter").value;

  document.getElementById("seedValue").textContent =
    document.getElementById("seed").value;

  /* Angles */
  document.getElementById("angleValue").textContent =
    document.getElementById("angle").value;

  /* Pattern mode labels */
  const dynamicModeEl = document.getElementById("dynamicAngleMode");
  if (dynamicModeEl) {
    document.getElementById("dynamicAngleModeLabel").textContent =
      dynamicModeEl.options[dynamicModeEl.selectedIndex].textContent;
  }

  /* Radial pattern */
  document.getElementById("radialCenterXValue").textContent =
    document.getElementById("radialCenterX").value;
  document.getElementById("radialCenterYValue").textContent =
    document.getElementById("radialCenterY").value;
  document.getElementById("radialOffsetValue").textContent =
    document.getElementById("radialOffset").value;

  /* Spiral pattern */
  const spiralTypeEl = document.getElementById("spiralType");
  if (spiralTypeEl) {
    document.getElementById("spiralTypeValue").textContent =
      spiralTypeEl.options[spiralTypeEl.selectedIndex].textContent;
  }
  document.getElementById("spiralCenterXValue").textContent =
    document.getElementById("spiralCenterX").value;
  document.getElementById("spiralCenterYValue").textContent =
    document.getElementById("spiralCenterY").value;
  document.getElementById("spiralTightnessValue").textContent =
    document.getElementById("spiralTightness").value;

  /* Wave pattern */
  const waveDirectionEl = document.getElementById("waveDirection");
  if (waveDirectionEl) {
    document.getElementById("waveDirectionValue").textContent =
      waveDirectionEl.options[waveDirectionEl.selectedIndex].textContent;
  }
  document.getElementById("waveFrequencyValue").textContent =
    document.getElementById("waveFrequency").value;
  document.getElementById("waveAmplitudeValue").textContent =
    document.getElementById("waveAmplitude").value;

  /* Grid pattern */
  document.getElementById("gridSizeValue").textContent =
    document.getElementById("gridSize").value;
  document.getElementById("gridRotationValue").textContent =
    document.getElementById("gridRotation").value;

  /* Concentric pattern */
  document.getElementById("concentricCenterXValue").textContent =
    document.getElementById("concentricCenterX").value;
  document.getElementById("concentricCenterYValue").textContent =
    document.getElementById("concentricCenterY").value;

  /* Lissajous pattern */
  document.getElementById("lissajousAValue").textContent =
    document.getElementById("lissajousA").value;
  document.getElementById("lissajousBValue").textContent =
    document.getElementById("lissajousB").value;
  document.getElementById("lissajousPhaseValue").textContent =
    document.getElementById("lissajousPhase").value;

  /* Noise */
  document.getElementById("noiseStrengthValue").textContent =
    document.getElementById("noiseStrength").value;

  document.getElementById("noiseFrequencyValue").textContent =
    document.getElementById("noiseFrequency").value;

  document.getElementById("noiseDetailValue").textContent =
    document.getElementById("noiseDetail").value;

  document.getElementById("noiseIntensityValue").textContent =
    document.getElementById("noiseIntensity").value;

  document.getElementById("noiseWaveSmoothingValue").textContent =
    document.getElementById("noiseWaveSmoothing").value;

  document.getElementById("gradientStrengthValue").textContent =
    document.getElementById("gradientStrength").value;

  const gradientTypeEl = document.getElementById("gradientType");
  document.getElementById("gradientTypeValue").textContent =
    gradientTypeEl ? gradientTypeEl.options[gradientTypeEl.selectedIndex].textContent : "";

  document.getElementById("gradientAngleValue").textContent =
    document.getElementById("gradientAngle").value;

  document.getElementById("minSpacingValue").textContent =
    document.getElementById("minSpacing").value;
}/* ============================================================
/* ============================================================
   PART 3 — STABLE, PRECISE HATCH ENGINE (UPDATED)
============================================================ */

function getCanvasDimensions() {
  const widthInput = document.getElementById("canvasWidth");
  const heightInput = document.getElementById("canvasHeight");

  let width = parseFloat(widthInput?.value);
  let height = parseFloat(heightInput?.value);

  if (isNaN(width) || width <= 0) width = DEFAULT_CANVAS.width;
  if (isNaN(height) || height <= 0) height = DEFAULT_CANVAS.height;

  return { width, height };
}

function updateNoiseUI() {
  const enabled = document.getElementById("noiseEnabled").checked;
  const controls = document.getElementById("lineNoiseControls");
  if (controls) {
    controls.style.display = enabled ? "" : "none";
  }
}

function draw() {
  const svg = document.getElementById("svg");
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions();
  svg.setAttribute("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`);
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.aspectRatio = "";

  /* ------------------------------
     EXTRACT PARAMETERS
  ------------------------------ */
  const margin = +document.getElementById("margin").value;
  const strokeWidth = +document.getElementById("strokeWidth").value;
  const strokeColor = document.getElementById("strokeColor").value;

  const baseSpacing = +document.getElementById("spacing").value;         // user spacing (max)

  const angleBehavior = document.getElementById("angleBehavior").value;
  const angleDeg = +document.getElementById("angle").value;
  const dynamicAngleMode = document.getElementById("dynamicAngleMode").value;

  // Pattern-specific parameters
  const radialCenterX = +document.getElementById("radialCenterX").value;
  const radialCenterY = +document.getElementById("radialCenterY").value;
  const radialOffset = +document.getElementById("radialOffset").value;

  const spiralType = document.getElementById("spiralType").value;
  const spiralCenterX = +document.getElementById("spiralCenterX").value;
  const spiralCenterY = +document.getElementById("spiralCenterY").value;
  const spiralTightness = +document.getElementById("spiralTightness").value;

  const waveDirection = document.getElementById("waveDirection").value;
  const waveFrequency = +document.getElementById("waveFrequency").value;
  const waveAmplitude = +document.getElementById("waveAmplitude").value;

  const gridSize = +document.getElementById("gridSize").value;
  const gridRotation = +document.getElementById("gridRotation").value;

  const concentricCenterX = +document.getElementById("concentricCenterX").value;
  const concentricCenterY = +document.getElementById("concentricCenterY").value;

  const lissajousA = +document.getElementById("lissajousA").value;
  const lissajousB = +document.getElementById("lissajousB").value;
  const lissajousPhase = +document.getElementById("lissajousPhase").value * Math.PI / 180;

  const jitterPct = +document.getElementById("jitter").value;
  const jitterBand = computeJitter(jitterPct, strokeWidth);

  const noiseEnabled = document.getElementById("noiseEnabled").checked;
  const noiseStrength = +document.getElementById("noiseStrength").value;
  const noiseFrequency = +document.getElementById("noiseFrequency").value;
  const noiseDetail = +document.getElementById("noiseDetail").value;
  const noiseIntensity = +document.getElementById("noiseIntensity").value;
  const noiseWaveSmoothing = +document.getElementById("noiseWaveSmoothing").value;

  const gradientEnabled = document.getElementById("gradientEnabled").checked;
  const gradientType = document.getElementById("gradientType").value;
  const gradientStrengthRaw = +document.getElementById("gradientStrength").value / 100;
  const gradientStrength = gradientEnabled ? gradientStrengthRaw : 0;
  const gradientActive = gradientStrength > 0;
  const gradientAngle = +document.getElementById("gradientAngle").value;
  const gradientReverse = document.getElementById("gradientReverse").checked;
  const minSpacing = +document.getElementById("minSpacing").value;

  // Density system removed: densityMethodV, densityPriorityV, maxCopiesV

  const crosshatchV = document.getElementById("crosshatch").checked;
  const angle2DegV = +document.getElementById("angle2").value;

  const rng = mulberry32(+document.getElementById("seed").value);

  const gRad = gradientAngle * Math.PI / 180;
  const gx = Math.cos(gRad);
  const gy = Math.sin(gRad);

  log("\n[DRAW] START — Clean Engine");

  /* ------------------------------
     CANVAS BOUNDS
  ------------------------------ */
  const x0 = margin;
  const y0 = margin;
  const x1 = canvasWidth - margin;
  const y1 = canvasHeight - margin;

  const frame = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  frame.setAttribute("x", x0);
  frame.setAttribute("y", y0);
  frame.setAttribute("width", x1 - x0);
  frame.setAttribute("height", y1 - y0);
  frame.setAttribute("stroke", "black");
  frame.setAttribute("stroke-width", 0.3);
  frame.setAttribute("fill", "none");
  frame.setAttribute("data-preview-only", "true"); // Mark as preview-only
  svg.appendChild(frame);

  let gradProjMin = 0;
  let gradProjDenom = 1;
  if (gradientActive) {
    const corners = [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x0, y: y1 },
      { x: x1, y: y1 }
    ];
    let minProj = Infinity;
    let maxProj = -Infinity;
    corners.forEach(({ x, y }) => {
      const proj = x * gx + y * gy;
      if (proj < minProj) minProj = proj;
      if (proj > maxProj) maxProj = proj;
    });
    gradProjMin = minProj;
    gradProjDenom = Math.max(maxProj - minProj, 1e-6);
  }

  function projectToGradient(px, py) {
    if (!gradientActive) return 0;
    let t = ((px * gx + py * gy) - gradProjMin) / gradProjDenom;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return t;
  }

  /* ------------------------------
     DIRECTIONAL GRADIENT MASK (skip-lines)
  ------------------------------ */
  function getMask(px, py) {
    if (!gradientActive) return 1;

    const t = projectToGradient(px, py);
    const densityWeight = gradientReverse ? t : (1 - t);
    let mask = 1 - densityWeight * gradientStrength;

    // Clamp
    if (mask < 0) mask = 0;
    if (mask > 1) mask = 1;

    return mask;
  }

  /* ------------------------------
     FREQUENCY-BASED NOISE JITTER SYSTEM
     Uses continuous noise sampled along lines for smooth, natural jitter
  ------------------------------ */
  function sampleJitterNoise(x, y, lineAngle, distanceAlongLine, frequency, detail, intensity, waveSmoothing, lineSeed, phaseShiftX, phaseShiftY, phaseShiftLine, spatialOffsetX, spatialOffsetY) {
    // Create line-specific RNG for additional random variations
    const lineRng = mulberry32(lineSeed + 99999); // Different seed for per-point variation
    
    // Sample noise perpendicular to line direction for natural flow
    const perpAngle = lineAngle + Math.PI / 2;
    const perpX = Math.cos(perpAngle);
    const perpY = Math.sin(perpAngle);
    
    // Multi-octave noise for natural variation
    let noiseValue = 0;
    let amplitude = 1;
    let totalAmplitude = 0;
    
    for (let octave = 0; octave < detail; octave++) {
      const scale = Math.pow(2, octave);
      
      // Add line-specific offsets: phase shifts + spatial offsets + seed-based offset
      // Each line samples from completely different noise regions
      const seedOffset = lineSeed * 0.001;
      const sampleX = (x + perpX * octave * 2 + spatialOffsetX + phaseShiftX + seedOffset) * frequency * scale;
      const sampleY = (y + perpY * octave * 2 + spatialOffsetY + phaseShiftY + seedOffset) * frequency * scale;
      const lineCoord = (distanceAlongLine + phaseShiftLine + seedOffset) * frequency * scale;
      
      // Combine spatial and line-based noise with more line-specific variation
      // Use different noise seeds per octave for more variation
      const spatialNoise = valueNoise(sampleX, sampleY);
      const lineNoise = valueNoise(lineCoord, lineSeed * 0.0001 + octave * 100);
      let n = spatialNoise * 0.5 + lineNoise * 0.5;
      
      // Add per-point micro-variation for extra randomness (small but noticeable)
      const pointVariation = valueNoise(x * 0.1 + lineSeed * 0.01, y * 0.1 + lineSeed * 0.01) * 0.15;
      n = n * 0.85 + pointVariation * 0.15;
      
      // Apply intensity boost (non-linear for extreme effects)
      if (intensity > 1.0) {
        const boost = intensity - 1.0;
        // Apply curve: more boost = more dramatic effect
        n = n * (1 + boost * Math.abs(n));
      } else if (intensity < 1.0) {
        n = n * intensity;
      }
      
      noiseValue += n * amplitude;
      totalAmplitude += amplitude;
      amplitude *= 0.5; // Each octave has half the amplitude
    }
    
    let result = noiseValue / totalAmplitude;
    
    // Apply wave smoothing for ultra-smooth curves
    if (waveSmoothing > 0) {
      // Use smootherstep to create ultra-smooth waves
      const smoothed = smootherstep((result + 1) / 2) * 2 - 1;
      result = result * (1 - waveSmoothing) + smoothed * waveSmoothing;
    }
    
    return result;
  }

  /* ------------------------------
     MAIN HATCH LAYER
  ------------------------------ */
  // Precompute base density anchor normal (primary angle)
  const primaryRad = angleDeg * Math.PI / 180;
  const primaryNX = -Math.sin(primaryRad);
  const primaryNY = Math.cos(primaryRad);
  function drawLayer(inputDeg) {
    // Reduce jitter + noise on crosshatch for stability
    const isCross = (inputDeg === angle2DegV);
    const localNoiseStrength = isCross ? noiseStrength * 0.5 : noiseStrength;
    const localJitterBand = isCross ? jitterBand * 0.5 : jitterBand;

    let countLines = 0;
    let totalLength = 0; // Track total line length in mm
    let totalTravelDistance = 0; // Track travel moves between lines
    let lastLineEnd = null; // Track end point of previous line
    
    // Create independent RNG for this layer
    const mainSeed = +document.getElementById("seed").value;

    // Base angle (radians)
    const baseRad = inputDeg * Math.PI / 180;

    // Hatch line direction
    const dxH = Math.cos(baseRad);
    const dyH = Math.sin(baseRad);

    // Hatch normal (perp to line direction)
    const nxH = -Math.sin(baseRad);
    const nyH =  Math.cos(baseRad);

    const directionSign = gradientActive ? ((nxH * gx + nyH * gy) >= 0 ? 1 : -1) : 1;

    // Maximum number of lines
    const maxLines = Math.ceil((canvasWidth + canvasHeight) / Math.min(baseSpacing, minSpacing)) + 40;

    // Center of canvas
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;

    // Dual accumulators for spacing along gradient direction
    let offsetPos = 0;
    let offsetNeg = 0;

    for (let i = -maxLines; i <= maxLines; i++) {
      // 5) Determine spacing direction based on projection
      const iProj = i * directionSign;
      const isCenterLine = (i === 0);

      let px, py;

      if (isCenterLine) {
        px = cx;
        py = cy;
      } else {
        let localSpacing = baseSpacing;

        if (gradientActive) {
          // --- RECOMPUTE GRADIENT USING TRUE LINE POSITION (Linear A-model) ---
          let pxTemp, pyTemp;
          if (iProj >= 0) {
            pxTemp = cx + (offsetPos + minSpacing) * nxH;
            pyTemp = cy + (offsetPos + minSpacing) * nyH;
          } else {
            pxTemp = cx - (offsetNeg + minSpacing) * nxH;
            pyTemp = cy - (offsetNeg + minSpacing) * nyH;
          }

          const t = projectToGradient(pxTemp, pyTemp);
          const densityWeight = gradientReverse ? t : (1 - t);
          const spacingMix = Math.max(0, Math.min(1, 1 - densityWeight * gradientStrength));
          localSpacing = minSpacing + (baseSpacing - minSpacing) * spacingMix;
        }

        // Now increment offsets and assign px, py
        if (iProj >= 0) {
          offsetPos += localSpacing;
          px = cx + offsetPos * nxH;
          py = cy + offsetPos * nyH;
        } else {
          offsetNeg += localSpacing;
          px = cx - offsetNeg * nxH;
          py = cy - offsetNeg * nyH;
        }
      }

      // 6) Compute dynamic line angle
      const lineAngle = computeAngle(px, py, {
        angleBehavior,
        angleDeg: inputDeg,
        dynamicAngleMode,
        canvasWidth,
        canvasHeight,
        // Pattern parameters
        radialCenterX,
        radialCenterY,
        radialOffset,
        spiralCenterX,
        spiralCenterY,
        spiralTightness,
        spiralType,
        waveFrequency,
        waveAmplitude,
        waveDirection,
        gridSize,
        gridRotation,
        concentricCenterX,
        concentricCenterY,
        lissajousA,
        lissajousB,
        lissajousPhase
      });

      const dx = Math.cos(lineAngle);
      const dy = Math.sin(lineAngle);

      // 7) Clip line
      const seg = clipLineToRect(x0, y0, x1, y1, px, py, dx, dy);
      if (!seg) continue;

      // 8) Draw the hatch line
      const jitterOffset = (Math.random() * 2 - 1) * localJitterBand;
      const jitterX = jitterOffset * nxH;
      const jitterY = jitterOffset * nyH;

      let x1p = seg.x1 + jitterX;
      let y1p = seg.y1 + jitterY;
      let x2p = seg.x2 + jitterX;
      let y2p = seg.y2 + jitterY;

      const len = Math.hypot(x2p - x1p, y2p - y1p);
      
      // Create unique seed for this line
      const lineSeed = i * 100000 + mainSeed;
      
      // Pre-calculate line-specific random variations (deterministic but unique per line)
      const lineRng = mulberry32(lineSeed);
      const linePhaseShiftX = lineRng() * 1000;
      const linePhaseShiftY = lineRng() * 1000;
      const linePhaseShiftLine = lineRng() * 1000;
      const lineFreqVariation = 0.8 + lineRng() * 0.4; // 0.8x to 1.2x
      const lineSpatialOffsetX = lineRng() * 5000;
      const lineSpatialOffsetY = lineRng() * 5000;
      const lineFrequency = noiseFrequency * lineFreqVariation;
      
      // Generate points along the line with frequency-based noise jitter
      let pts = "";
      const pointDensity = 2; // Points per mm for smooth curves
      const renderSteps = Math.max(Math.ceil(len * pointDensity), 20);
      
      for (let s = 0; s <= renderSteps; s++) {
        const tt = s / renderSteps;
        let bx = x1p + (x2p - x1p) * tt;
        let by = y1p + (y2p - y1p) * tt;
        
        // Apply frequency-based noise jitter
        if (noiseEnabled && noiseStrength > 0) {
          const distanceAlongLine = len * tt;
          
          // Sample noise perpendicular to line direction with line-specific variations
          const noiseValue = sampleJitterNoise(
            bx, by, lineAngle, 
            distanceAlongLine, 
            lineFrequency, 
            noiseDetail,
            noiseIntensity,
            noiseWaveSmoothing,
            lineSeed,
            linePhaseShiftX,
            linePhaseShiftY,
            linePhaseShiftLine,
            lineSpatialOffsetX,
            lineSpatialOffsetY
          );
          
          // Apply jitter perpendicular to line
          const perpAngle = lineAngle + Math.PI / 2;
          const jitterAmount = noiseValue * localNoiseStrength;
          bx += Math.cos(perpAngle) * jitterAmount;
          by += Math.sin(perpAngle) * jitterAmount;
        }

        // Clamp
        if (bx < x0) bx = x0;
        if (bx > x1) bx = x1;
        if (by < y0) by = y0;
        if (by > y1) by = y1;

        pts += `${bx},${by} `;
      }

      const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      poly.setAttribute("points", pts.trim());
      poly.setAttribute("stroke", strokeColor);
      poly.setAttribute("stroke-width", strokeWidth);
      poly.setAttribute("fill", "none");
      poly.setAttribute("stroke-linecap", "round");
      svg.appendChild(poly);

      // Calculate line length from points
      const pointArray = pts.trim().split(/\s+/);
      let lineLength = 0;
      for (let i = 0; i < pointArray.length - 1; i++) {
        const [x1, y1] = pointArray[i].split(',').map(Number);
        const [x2, y2] = pointArray[i + 1].split(',').map(Number);
        lineLength += Math.hypot(x2 - x1, y2 - y1);
      }
      totalLength += lineLength;

      // Calculate travel distance from end of previous line to start of current line
      if (lastLineEnd !== null) {
        const [startX, startY] = pointArray[0].split(',').map(Number);
        const travelDist = Math.hypot(startX - lastLineEnd.x, startY - lastLineEnd.y);
        totalTravelDistance += travelDist;
      }

      // Store end point of this line for next travel calculation
      const [endX, endY] = pointArray[pointArray.length - 1].split(',').map(Number);
      lastLineEnd = { x: endX, y: endY };

      countLines++;
    }

    return { count: countLines, length: totalLength, travel: totalTravelDistance };
  }

  /* ------------------------------
     MAIN + CROSSHATCH
  ------------------------------ */

  const result1 = drawLayer(angleDeg);
  let totalLines = result1.count;
  let totalLength = result1.length;
  let totalTravel = result1.travel;
  
  if (crosshatchV) {
    const result2 = drawLayer(angle2DegV);
    totalLines += result2.count;
    totalLength += result2.length;
    totalTravel += result2.travel;
  }

  const lineCountEl = document.getElementById("lineCount");
  if (lineCountEl) lineCountEl.textContent = totalLines;
  
  // Calculate plotting time with travel moves and overhead
  // More realistic velocities based on actual plotter performance
  const DRAWING_VELOCITY = 40; // mm per second (when drawing - more conservative)
  const TRAVEL_VELOCITY = 120; // mm per second (when moving without drawing)
  const PEN_UP_TIME = 0.15; // seconds per pen up operation
  const PEN_DOWN_TIME = 0.15; // seconds per pen down operation
  const ACCELERATION_OVERHEAD = 0.1; // seconds overhead per line for acceleration/deceleration
  
  // Calculate base drawing and travel times
  const drawingTime = totalLength / DRAWING_VELOCITY;
  const travelTime = totalTravel / TRAVEL_VELOCITY;
  
  // Add overhead: pen up/down for each line + acceleration overhead
  const penOperationsTime = totalLines * (PEN_UP_TIME + PEN_DOWN_TIME);
  const accelerationTime = totalLines * ACCELERATION_OVERHEAD;
  
  // Total time with all overhead, then reduce by 20% for calibration
  const totalSeconds = (drawingTime + travelTime + penOperationsTime + accelerationTime) * 0.8;
  
  // Format as Hours:Minutes:Seconds
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  let formattedTime;
  if (hours > 0) {
    formattedTime = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  const plotTimeEl = document.getElementById("plotTime");
  if (plotTimeEl) plotTimeEl.textContent = formattedTime;
  
  log("[TOTAL LINES]", totalLines);
  log("[DRAWING LENGTH]", totalLength.toFixed(2), "mm");
  log("[TRAVEL DISTANCE]", totalTravel.toFixed(2), "mm");
  log("[DRAWING TIME]", drawingTime.toFixed(2), "s");
  log("[TRAVEL TIME]", travelTime.toFixed(2), "s");
  log("[PEN OPERATIONS TIME]", penOperationsTime.toFixed(2), "s");
  log("[ACCELERATION TIME]", accelerationTime.toFixed(2), "s");
  log("[EST. TOTAL TIME]", formattedTime);
}
/* ============================================================
   PART 4 — UI BINDINGS, DOWNLOAD, INIT
============================================================ */

/* ------------------------------
   DOWNLOAD SVG
------------------------------ */
document.getElementById("download").addEventListener("click", () => {
  const svg = document.getElementById("svg");
  
  // Get canvas dimensions for proper scaling
  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions();
  
  // Clone the SVG to avoid modifying the original
  const svgClone = svg.cloneNode(true);
  
  // Set explicit dimensions with mm units for proper scaling in vector software
  svgClone.setAttribute("width", `${canvasWidth}mm`);
  svgClone.setAttribute("height", `${canvasHeight}mm`);
  svgClone.setAttribute("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`);
  
  // Ensure proper namespace
  if (!svgClone.getAttribute("xmlns")) {
    svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  
  // Remove preview-only elements (like the boundary frame)
  const previewOnlyElements = svgClone.querySelectorAll('[data-preview-only="true"]');
  previewOnlyElements.forEach(el => el.remove());
  
  const data = new XMLSerializer().serializeToString(svgClone);
  const blob = new Blob([data], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "hatch_a3.svg";
  a.click();

  URL.revokeObjectURL(url);
});

/* ------------------------------
   MASTER UPDATE FUNCTION
------------------------------ */
function fullUpdate() {
  syncCanvasPresetFromInputs();
  updateAngleUI();
  updateCrosshatchUI();
  updateNoiseUI();
  updateGradientUI();
  updateLabels();
  draw();
}

/* ------------------------------
   EVENT LISTENERS
------------------------------ */

// Sliders
[
  "margin",
  "strokeWidth",
  "spacing",
  "jitter",
  "angle",
  "angle2",
  // Pattern controls
  "radialCenterX",
  "radialCenterY",
  "radialOffset",
  "spiralCenterX",
  "spiralCenterY",
  "spiralTightness",
  "waveFrequency",
  "waveAmplitude",
  "gridSize",
  "gridRotation",
  "concentricCenterX",
  "concentricCenterY",
  "lissajousA",
  "lissajousB",
  "lissajousPhase",
  // Noise and gradient
  "noiseStrength",
  "noiseFrequency",
  "noiseDetail",
  "noiseIntensity",
  "noiseWaveSmoothing",
  "gradientStrength",
  "minSpacing"
].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("input", fullUpdate);
  }
});

// Gradient angle with snap-to points
const gradientAngleEl = document.getElementById("gradientAngle");
if (gradientAngleEl) {
  const snapPoints = [0, 90, 180, 270];
  const snapThreshold = 5; // degrees
  
  gradientAngleEl.addEventListener("input", (e) => {
    let value = +e.target.value;
    
    // Check if we're close to any snap point
    for (const snapPoint of snapPoints) {
      const diff = Math.abs(value - snapPoint);
      // Also check for wrap-around (e.g., 359 is close to 0)
      const wrapDiff = Math.min(diff, Math.abs(value - (snapPoint + 360)), Math.abs(value - (snapPoint - 360)));
      
      if (wrapDiff <= snapThreshold) {
        value = snapPoint;
        e.target.value = snapPoint;
        break;
      }
    }
    
    fullUpdate();
  });
}

// Number inputs
[
  "seed"
].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", fullUpdate);
});

// Selects
[
  "gradientType",
  "angleBehavior",
  "dynamicAngleMode",
  "spiralType",
  "waveDirection"
].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", () => {
    if (id === "dynamicAngleMode" || id === "angleBehavior") {
      updateAngleUI();
    }
    fullUpdate();
  });
});

function applyCanvasPreset(preset) {
  const dims = CANVAS_PRESETS[preset];
  const widthEl = document.getElementById("canvasWidth");
  const heightEl = document.getElementById("canvasHeight");
  if (!dims || !widthEl || !heightEl) return;
  widthEl.value = dims.width;
  heightEl.value = dims.height;
}

function syncCanvasPresetFromInputs() {
  const presetEl = document.getElementById("canvasPreset");
  const widthEl = document.getElementById("canvasWidth");
  const heightEl = document.getElementById("canvasHeight");
  if (!presetEl || !widthEl || !heightEl) return;

  const width = +widthEl.value;
  const height = +heightEl.value;

  let found = "custom";
  Object.entries(CANVAS_PRESETS).forEach(([key, dims]) => {
    if (Math.abs(dims.width - width) < 0.001 && Math.abs(dims.height - height) < 0.001) {
      found = key;
    }
  });
  presetEl.value = found;
}

const canvasPresetEl = document.getElementById("canvasPreset");
if (canvasPresetEl) {
  canvasPresetEl.addEventListener("change", () => {
    const preset = canvasPresetEl.value;
    if (preset !== "custom") {
      applyCanvasPreset(preset);
    }
    if (typeof syncOrientationFromInputs === "function") syncOrientationFromInputs();
    fullUpdate();
  });
}

["canvasWidth", "canvasHeight"].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("input", () => {
      const presetEl = document.getElementById("canvasPreset");
      if (presetEl) presetEl.value = "custom";
      syncOrientationFromInputs();
      fullUpdate();
    });
  }
});

function syncOrientationFromInputs() {
  const widthEl = document.getElementById("canvasWidth");
  const heightEl = document.getElementById("canvasHeight");
  if (!widthEl || !heightEl) return;
  const isLandscape = +widthEl.value >= +heightEl.value;
  document.querySelectorAll(".orientation-btn").forEach(btn => {
    const target = btn.dataset.orientation;
    const active = (target === "landscape" && isLandscape) || (target === "portrait" && !isLandscape);
    btn.classList.toggle("active", active);
  });
}

document.querySelectorAll(".orientation-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.orientation;
    const widthEl = document.getElementById("canvasWidth");
    const heightEl = document.getElementById("canvasHeight");
    if (!widthEl || !heightEl) return;
    const w = +widthEl.value;
    const h = +heightEl.value;
    const isCurrentlyLandscape = w >= h;
    const wantLandscape = target === "landscape";
    if (wantLandscape !== isCurrentlyLandscape) {
      widthEl.value = h;
      heightEl.value = w;
    }
    syncOrientationFromInputs();
    fullUpdate();
  });
});

syncOrientationFromInputs();

// Checkboxes
[
  "noiseEnabled",
  "crosshatch",
  "gradientEnabled",
  "gradientReverse"
].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", fullUpdate);
});

// Color picker
const strokeColorEl = document.getElementById("strokeColor");
if (strokeColorEl) {
  strokeColorEl.addEventListener("input", fullUpdate);
  strokeColorEl.addEventListener("change", fullUpdate);
}

/* ------------------------------
   INITIALIZATION
------------------------------ */

// Setup advanced toggles
setupAdvancedToggles();

// Initial UI sync
updateAngleUI();
updateCrosshatchUI();
updateNoiseUI();
updateGradientUI();
updateLabels();

// First draw
draw();
log("INIT COMPLETE");

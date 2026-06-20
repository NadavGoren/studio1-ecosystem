/* ============================================================
   CONTROLS
   All event listeners and user interaction handlers
============================================================ */

import { CANVAS_PRESETS } from '../core/constants.js';
import { draw } from '../rendering/renderer.js';
import { fullUpdate, updateViewModeUI, updateLabels } from './updates.js';
import { applyCanvasPreset, updateOrientationLabel } from './canvas.js';

// Orbit state (cube rotation around Z-axis)
let orbitHorizontal = 0; // Rotation angle around Z-axis (0-360°)

// Position offset state
let positionX = 0; // Horizontal position offset in mm
let positionY = 0; // Vertical position offset in mm

// Mouse drag state
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let animationFrameId = null;

// Active tool state
let activeTool = 'rotate'; // 'rotate' or 'move'

/**
 * Get current orbit angle
 */
export function getOrbitHorizontal() {
  return orbitHorizontal;
}

/**
 * Set orbit angle
 */
export function setOrbitHorizontal(angle) {
  orbitHorizontal = angle;
}

/**
 * Get current position offsets
 */
export function getPositionOffsets() {
  return { x: positionX, y: positionY };
}

/**
 * Set position offsets
 */
export function setPositionOffsets(x, y) {
  positionX = x;
  positionY = y;
}

/**
 * Get active tool
 */
export function getActiveTool() {
  return activeTool;
}

/**
 * Setup all event listeners for UI controls
 */
export function setupControls() {
  console.log('=== setupControls called ===');
  // Wrapper for fullUpdate that includes orbit state
  const triggerFullUpdate = () => fullUpdate(orbitHorizontal);

  // Sliders
  [
    "margin",
    "strokeWidth",
    "lightAngle",
    "lightElevation",
    "lightBrightness",
    "ambientLight",
    "hatchSpacing",
    "minSpacing",
    "hatchAngle",
    "lineJitter",
    "jitterFrequency",
    "jitterRandomness",
    "perspectiveStrength",
    "shadowFalloff"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", triggerFullUpdate);
    }
  });

  // Cube size slider with sticky behavior at 5mm increments and number input sync
  setupCubeSizeControls(triggerFullUpdate);

  // Number inputs for canvas dimensions
  setupCanvasDimensionControls(triggerFullUpdate);

  // Orientation toggle
  setupOrientationToggle(triggerFullUpdate);

  // View mode select
  setupViewModeControl(triggerFullUpdate);

  // Canvas preset select
  setupCanvasPresetControl(triggerFullUpdate);

  // Checkboxes
  setupCheckboxControls(triggerFullUpdate);

  // Cross-hatch controls
  setupCrossHatchControls(triggerFullUpdate);

  // Color controls
  setupColorControls(triggerFullUpdate);

  // Tool buttons
  setupToolButtons(triggerFullUpdate);

  // Mouse controls (handles both rotate and move based on active tool)
  setupMouseControls(triggerFullUpdate);
  
  // Test angle buttons for debugging shadow leaks
  setupTestAngleButtons(triggerFullUpdate);
  
  // Shadow expansion slider
  setupShadowExpansionControl(triggerFullUpdate);
  
  // Line jitter toggle
  setupLineJitterToggle(triggerFullUpdate);
  
  // Animation controls
  setupAnimationControls();
}

/**
 * Setup cube size slider and number input with sync
 */
function setupCubeSizeControls(triggerFullUpdate) {
  const cubeSizeEl = document.getElementById("cubeSize");
  const cubeSizeInputEl = document.getElementById("cubeSizeInput");

  const updateCubeSize = (value) => {
    // Clamp to valid range
    value = Math.max(20, Math.min(200, value));
    
    // Update number input
    if (cubeSizeInputEl) {
      cubeSizeInputEl.value = value;
    }
    
    // Update slider
    if (cubeSizeEl) {
      cubeSizeEl.value = value;
    }
    
    // Update display value
    const cubeSizeValueEl = document.getElementById("cubeSizeValue");
    if (cubeSizeValueEl) {
      cubeSizeValueEl.textContent = value;
    }
    
    triggerFullUpdate();
  };
  
  // Number input listeners
  if (cubeSizeInputEl) {
    cubeSizeInputEl.addEventListener("input", (e) => {
      updateCubeSize(parseFloat(e.target.value));
    });
    
    cubeSizeInputEl.addEventListener("change", (e) => {
      updateCubeSize(parseFloat(e.target.value));
    });
  }

  // Slider listener with sticky behavior
  if (cubeSizeEl) {
    cubeSizeEl.addEventListener("input", (e) => {
      let value = parseFloat(e.target.value);
      
      // Check if value is close to a 5mm increment (within 0.25mm)
      const nearest5 = Math.round(value / 5) * 5;
      if (Math.abs(value - nearest5) < 0.25) {
        // Snap to the nearest 5mm increment
        value = nearest5;
        e.target.value = value;
      }
      
      // Update number input
      if (cubeSizeInputEl) {
        cubeSizeInputEl.value = value;
      }
      
      // Update display value
      const cubeSizeValueEl = document.getElementById("cubeSizeValue");
      if (cubeSizeValueEl) {
        cubeSizeValueEl.textContent = value;
      }
      
      triggerFullUpdate();
    });
  }
}

/**
 * Setup canvas dimension number inputs
 */
function setupCanvasDimensionControls(triggerFullUpdate) {
  ["canvasWidth", "canvasHeight"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => {
        const presetEl = document.getElementById("canvasPreset");
        const widthEl = document.getElementById("canvasWidth");
        const heightEl = document.getElementById("canvasHeight");
        
        if (presetEl && widthEl && heightEl) {
          // Check if current dimensions match any preset (in either orientation)
          const width = parseFloat(widthEl.value);
          const height = parseFloat(heightEl.value);
          let matchingPreset = "custom";
          
          for (const [preset, dims] of Object.entries(CANVAS_PRESETS)) {
            // Check both landscape and portrait orientations
            if ((dims.width === width && dims.height === height) ||
                (dims.width === height && dims.height === width)) {
              matchingPreset = preset;
              break;
            }
          }
          
          presetEl.value = matchingPreset;
        }
        triggerFullUpdate();
      });
    }
  });
}

/**
 * Setup orientation toggle button
 */
function setupOrientationToggle(triggerFullUpdate) {
  const toggleOrientationBtn = document.getElementById("toggleOrientation");
  if (!toggleOrientationBtn) return;

  toggleOrientationBtn.addEventListener("change", () => {
    const widthEl = document.getElementById("canvasWidth");
    const heightEl = document.getElementById("canvasHeight");
    const presetEl = document.getElementById("canvasPreset");
    
    if (widthEl && heightEl) {
      // Get current preset before swapping - this is the key!
      const currentPreset = presetEl ? presetEl.value : "custom";
      
      // Swap width and height
      const currentWidth = parseFloat(widthEl.value);
      const currentHeight = parseFloat(heightEl.value);
      
      widthEl.value = currentHeight;
      heightEl.value = currentWidth;
      
      // Update labels
      updateLabels();
      
      // If we had a preset (A3, A4, A5, A6), keep the same preset
      // The preset represents the paper size, not the orientation
      if (currentPreset !== "custom" && CANVAS_PRESETS[currentPreset]) {
        // Keep the same preset - orientation doesn't change the preset
        // A3 is A3 whether landscape or portrait
        if (presetEl) {
          presetEl.value = currentPreset;
        }
      } else {
        // If it was custom, check if swapped dimensions match any preset
        const newWidth = currentHeight;
        const newHeight = currentWidth;
        let matchingPreset = "custom";
        for (const [preset, dims] of Object.entries(CANVAS_PRESETS)) {
          // Check both landscape and portrait orientations
          if ((dims.width === newWidth && dims.height === newHeight) ||
              (dims.width === newHeight && dims.height === newWidth)) {
            matchingPreset = preset;
            break;
          }
        }
        if (presetEl) {
          presetEl.value = matchingPreset;
        }
      }
      
      // Update orientation label
      updateOrientationLabel();
      
      // Redraw
      triggerFullUpdate();
    }
  });
  
  // Update label when dimensions change
  const widthEl = document.getElementById("canvasWidth");
  const heightEl = document.getElementById("canvasHeight");
  if (widthEl) {
    widthEl.addEventListener("input", updateOrientationLabel);
    widthEl.addEventListener("change", updateOrientationLabel);
  }
  if (heightEl) {
    heightEl.addEventListener("input", updateOrientationLabel);
    heightEl.addEventListener("change", updateOrientationLabel);
  }
  
  // Initial label update
  updateOrientationLabel();
}

/**
 * Setup view mode select control
 */
function setupViewModeControl(triggerFullUpdate) {
  const viewModeEl = document.getElementById("viewMode");
  if (viewModeEl) {
    viewModeEl.addEventListener("change", () => {
      updateViewModeUI();
      triggerFullUpdate();
    });
  }
}

/**
 * Setup canvas preset select control
 */
function setupCanvasPresetControl(triggerFullUpdate) {
  const canvasPresetEl = document.getElementById("canvasPreset");
  const toggleOrientationBtn = document.getElementById("toggleOrientation");
  
  if (canvasPresetEl) {
    canvasPresetEl.addEventListener("change", () => {
      const preset = canvasPresetEl.value;
      if (preset !== "custom") {
        applyCanvasPreset(preset);
      }
      // Update orientation toggle after preset change
      if (toggleOrientationBtn) {
        const widthEl = document.getElementById("canvasWidth");
        const heightEl = document.getElementById("canvasHeight");
        if (widthEl && heightEl) {
          const width = parseFloat(widthEl.value);
          const height = parseFloat(heightEl.value);
          const isPortrait = height > width;
          toggleOrientationBtn.checked = isPortrait;
          const orientationLabel = document.getElementById("orientationLabel");
          if (orientationLabel) {
            orientationLabel.textContent = isPortrait ? "Portrait" : "Landscape";
          }
          // Update label colors
          const labelLeft = document.querySelector(".orientation-label-left");
          const labelRight = document.querySelector(".orientation-label-right");
          if (labelLeft && labelRight) {
            if (isPortrait) {
              labelLeft.style.color = "var(--text-muted)";
              labelLeft.style.fontWeight = "600";
              labelRight.style.color = "var(--accent)";
              labelRight.style.fontWeight = "700";
            } else {
              labelLeft.style.color = "var(--accent)";
              labelLeft.style.fontWeight = "700";
              labelRight.style.color = "var(--text-muted)";
              labelRight.style.fontWeight = "600";
            }
          }
        }
      }
      triggerFullUpdate();
    });
  }
}

/**
 * Setup checkbox controls
 */
function setupCheckboxControls(triggerFullUpdate) {
  ["showEdges", "showShadow", "showGrid", "debugOcclusion", "advancedShading", "shadowSoftEdges"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      console.log(`✓ Setting up checkbox: ${id}`);
      el.addEventListener("change", () => {
        console.log(`Checkbox changed: ${id} = ${el.checked}`);
        // Update active class for advanced shading toggle
        if (id === "advancedShading") {
          const label = el.closest(".advanced-shading-toggle");
          if (label) {
            if (el.checked) {
              label.classList.add("active");
            } else {
              label.classList.remove("active");
            }
          }
          // Show/hide shadow falloff control
          toggleShadowFalloffUI();
        }
        triggerFullUpdate();
      });
    } else {
      console.warn(`✗ Checkbox element not found: ${id}`);
      
      // Initialize active state for advanced shading
      if (id === "advancedShading" && el.checked) {
        const label = el.closest(".advanced-shading-toggle");
        if (label) {
          label.classList.add("active");
        }
      }
    }
  });
  
  // Initialize shadow falloff UI state
  toggleShadowFalloffUI();
}

/**
 * Toggle visibility of shadow falloff controls based on advanced shading state
 */
function toggleShadowFalloffUI() {
  const advancedShadingEl = document.getElementById("advancedShading");
  const shadowFalloffGroup = document.getElementById("shadowFalloffGroup");
  
  if (advancedShadingEl && shadowFalloffGroup) {
    shadowFalloffGroup.style.display = advancedShadingEl.checked ? "block" : "none";
  }
}

/**
 * Setup cross-hatch controls
 */
function setupCrossHatchControls(triggerFullUpdate) {
  const crossHatchEl = document.getElementById("crossHatch");
  const crossHatchDensityEl = document.getElementById("crossHatchDensity");
  const crossHatchDensityGroup = document.getElementById("crossHatchDensityGroup");
  const crossHatchDensityValue = document.getElementById("crossHatchDensityValue");

  if (crossHatchEl) {
    const toggleCrossHatchUI = () => {
      const enabled = crossHatchEl.checked;
      if (crossHatchDensityGroup) {
        crossHatchDensityGroup.style.display = enabled ? "block" : "none";
      }
    };
    
    crossHatchEl.addEventListener("change", () => {
      toggleCrossHatchUI();
      triggerFullUpdate();
    });
    
    // Initialize UI state
    toggleCrossHatchUI();
  }

  if (crossHatchDensityEl && crossHatchDensityValue) {
    crossHatchDensityEl.addEventListener("input", () => {
      if (crossHatchDensityValue) {
        crossHatchDensityValue.textContent = crossHatchDensityEl.value;
      }
      triggerFullUpdate();
    });
    
    // Initialize value display
    if (crossHatchDensityValue) {
      crossHatchDensityValue.textContent = crossHatchDensityEl.value;
    }
  }
}

/**
 * Setup color controls
 */
function setupColorControls(triggerFullUpdate) {
  // Single color input (for monochromatic mode)
  const singleColorEl = document.getElementById("singleColor");
  if (singleColorEl) {
    singleColorEl.addEventListener("input", triggerFullUpdate);
    singleColorEl.addEventListener("change", triggerFullUpdate);
  }

  // Face color inputs
  const faceColorIds = ['Top', 'Front', 'Back', 'Left', 'Right', 'Bottom'];
  faceColorIds.forEach(faceName => {
    const colorEl = document.getElementById(`face${faceName}Color`);
    if (colorEl) {
      colorEl.addEventListener("input", triggerFullUpdate);
      colorEl.addEventListener("change", triggerFullUpdate);
    }
  });

  // Toggle for using face colors vs single color
  const useFaceColorsEl = document.getElementById("useFaceColors");
  if (useFaceColorsEl) {
    const toggleColorUI = () => {
      const useFaceColors = useFaceColorsEl.checked;
      const singleColorGroup = document.getElementById("singleColorGroup");
      const faceColorsGroups = document.querySelectorAll("#faceColorsGroup");
      
      if (useFaceColors) {
        // Show face color pickers, hide single color
        if (singleColorGroup) singleColorGroup.style.display = "none";
        faceColorsGroups.forEach(group => {
          group.style.display = "block";
        });
      } else {
        // Show single color picker, hide face colors
        if (singleColorGroup) singleColorGroup.style.display = "block";
        faceColorsGroups.forEach(group => {
          group.style.display = "none";
        });
      }
    };
    
    useFaceColorsEl.addEventListener("change", () => {
      toggleColorUI();
      triggerFullUpdate();
    });
    
    // Initialize UI state
    toggleColorUI();
  }
}

/**
 * Setup tool buttons (Rotate and Move)
 */
function setupToolButtons(triggerFullUpdate) {
  const rotateToolBtn = document.getElementById('rotateTool');
  const moveToolBtn = document.getElementById('moveTool');
  const toolHint = document.getElementById('toolHint');
  const svgElement = document.getElementById('svg');

  if (!rotateToolBtn || !moveToolBtn) return;

  // Tool button click handlers
  rotateToolBtn.addEventListener('click', () => {
    activeTool = 'rotate';
    rotateToolBtn.classList.add('active');
    moveToolBtn.classList.remove('active');
    if (toolHint) toolHint.textContent = 'Drag to rotate the cube around its axis';
    if (svgElement) updateCursor(svgElement);
  });

  moveToolBtn.addEventListener('click', () => {
    activeTool = 'move';
    moveToolBtn.classList.add('active');
    rotateToolBtn.classList.remove('active');
    if (toolHint) toolHint.textContent = 'Drag to move the artwork on the canvas';
    if (svgElement) updateCursor(svgElement);
  });

  // Keyboard shortcuts: R for Rotate, V for Move
  document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.key === 'r' || e.key === 'R') {
      rotateToolBtn.click();
    } else if (e.key === 'v' || e.key === 'V') {
      moveToolBtn.click();
    }
  });
}

/**
 * Update cursor based on active tool
 */
function updateCursor(element) {
  if (activeTool === 'rotate') {
    element.style.cursor = 'grab';
  } else if (activeTool === 'move') {
    element.style.cursor = 'move';
  }
}

/**
 * Setup mouse controls for both rotating and moving based on active tool
 */
function setupMouseControls(triggerFullUpdate) {
  const svgElement = document.getElementById("svg");
  if (!svgElement) return;

  // Mouse down: start dragging
  svgElement.addEventListener("mousedown", (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    
    // Update cursor based on active tool
    if (activeTool === 'rotate') {
      svgElement.style.cursor = "grabbing";
    } else if (activeTool === 'move') {
      svgElement.style.cursor = "grabbing";
    }
    
    e.preventDefault();
  });

  // Mouse move: update based on active tool (with throttling for smooth performance)
  svgElement.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;
    
    if (activeTool === 'rotate') {
      // Rotate mode: only horizontal movement = rotate around Z-axis (spinning on floor)
      orbitHorizontal += deltaX * 0.5; // Sensitivity
      orbitHorizontal = ((orbitHorizontal % 360) + 360) % 360; // Wrap to 0-360
    } else if (activeTool === 'move') {
      // Move mode: drag in any direction to reposition
      // Convert pixel movement to mm (rough approximation)
      // Adjust sensitivity based on canvas scale
      const moveSensitivity = 0.5; // Adjust as needed
      positionX += deltaX * moveSensitivity;
      positionY += deltaY * moveSensitivity;
      
      // Clamp to reasonable bounds
      positionX = Math.max(-200, Math.min(200, positionX));
      positionY = Math.max(-200, Math.min(200, positionY));
    }
    
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    
    // Throttle redraws using requestAnimationFrame for smooth performance
    if (animationFrameId === null) {
      animationFrameId = requestAnimationFrame(() => {
        draw(orbitHorizontal);
        animationFrameId = null;
      });
    }
    
    e.preventDefault();
  });

  // Mouse up: stop dragging
  svgElement.addEventListener("mouseup", () => {
    isDragging = false;
    updateCursor(svgElement);
    // Ensure final redraw
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    draw(orbitHorizontal);
  });

  svgElement.addEventListener("mouseleave", () => {
    isDragging = false;
    updateCursor(svgElement);
    // Ensure final redraw
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    draw(orbitHorizontal);
  });
}

/**
 * Setup test angle buttons for shadow leak debugging
 */
function setupTestAngleButtons(triggerFullUpdate) {
  const testAngleButtons = document.querySelectorAll('.test-angle-btn');
  
  testAngleButtons.forEach(button => {
    button.addEventListener('click', () => {
      const angle = parseFloat(button.dataset.angle);
      orbitHorizontal = angle;
      triggerFullUpdate();
    });
  });
}

/**
 * Setup shadow expansion slider control
 */
function setupShadowExpansionControl(triggerFullUpdate) {
  const shadowExpansionEl = document.getElementById("shadowExpansion");
  const shadowExpansionValueEl = document.getElementById("shadowExpansionValue");
  
  if (shadowExpansionEl && shadowExpansionValueEl) {
    shadowExpansionEl.addEventListener("input", () => {
      shadowExpansionValueEl.textContent = shadowExpansionEl.value;
      triggerFullUpdate();
    });
  }
  
  // Shadow inset control
  const shadowInsetEl = document.getElementById("shadowInset");
  const shadowInsetValueEl = document.getElementById("shadowInsetValue");
  
  if (shadowInsetEl && shadowInsetValueEl) {
    shadowInsetEl.addEventListener("input", () => {
      shadowInsetValueEl.textContent = shadowInsetEl.value;
      triggerFullUpdate();
    });
  }
}

/**
 * Setup animation controls with parameter balancing
 */
/**
 * Setup line jitter toggle to show/hide jitter controls
 */
function setupLineJitterToggle(triggerFullUpdate) {
  const toggleEl = document.getElementById("lineJitterEnabled");
  const jitterControls = document.querySelectorAll(".jitter-control");
  
  if (!toggleEl) return;
  
  // Function to update visibility
  const updateVisibility = () => {
    const isEnabled = toggleEl.checked;
    jitterControls.forEach(control => {
      control.style.display = isEnabled ? "block" : "none";
    });
  };
  
  // Initial visibility update
  updateVisibility();
  
  // Listen for toggle changes
  toggleEl.addEventListener("change", () => {
    updateVisibility();
    triggerFullUpdate();
  });
}

function setupAnimationControls() {
  const startAngleEl = document.getElementById("animStartAngle");
  const startAngleValueEl = document.getElementById("animStartAngleValue");
  const endAngleEl = document.getElementById("animEndAngle");
  const endAngleValueEl = document.getElementById("animEndAngleValue");
  const frameCountEl = document.getElementById("animFrameCount");
  const frameCountValueEl = document.getElementById("animFrameCountValue");
  const fpsEl = document.getElementById("animFps");
  const fpsValueEl = document.getElementById("animFpsValue");
  const durationValueEl = document.getElementById("animDurationValue");
  
  /**
   * Update duration display based on frames and fps
   */
  const updateDuration = () => {
    if (!frameCountEl || !fpsEl || !durationValueEl) return;
    
    const frames = parseInt(frameCountEl.value);
    const fps = parseInt(fpsEl.value);
    
    if (frames && fps) {
      const duration = frames / fps;
      durationValueEl.textContent = `${duration.toFixed(1)}s`;
    }
  };
  
  // Start angle control
  if (startAngleEl && startAngleValueEl) {
    startAngleEl.addEventListener("input", () => {
      startAngleValueEl.textContent = startAngleEl.value;
    });
  }
  
  // End angle control
  if (endAngleEl && endAngleValueEl) {
    endAngleEl.addEventListener("input", () => {
      endAngleValueEl.textContent = endAngleEl.value;
    });
  }
  
  // Frame count control with duration update
  if (frameCountEl && frameCountValueEl) {
    frameCountEl.addEventListener("input", () => {
      frameCountValueEl.textContent = frameCountEl.value;
      updateDuration();
    });
  }
  
  // FPS control with duration update
  if (fpsEl && fpsValueEl) {
    fpsEl.addEventListener("change", () => {
      fpsValueEl.textContent = fpsEl.value;
      updateDuration();
    });
  }
  
  // Initial duration calculation
  updateDuration();
}


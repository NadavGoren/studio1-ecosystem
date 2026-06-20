import type { HomeGeneratorConfig, HomeMood, CanvasSizePreset, Orientation, PathGroup } from '../config/types';
import { DEFAULT_CONFIG, getMoodDefaults, PAPER_SIZES } from '../config/defaults';
import { HouseGenerator } from '../generator/houseGenerator';
import { generateHomeSvg, exportHome, downloadSvg, svgToString, calculateSvgStats } from '../export/svgExporter';
import type { SvgStats } from '../export/svgExporter';

/**
 * Saved item structure for gallery
 */
interface SavedItem {
  id: string;
  svgString: string;
  config: HomeGeneratorConfig;
  timestamp: number;
  seed: number;
}

/**
 * UI Controller for managing the HOME Generator interface
 */
export class UIController {
  private config: HomeGeneratorConfig;
  private previewContainer: HTMLElement;
  private generator: HouseGenerator | null = null;
  private generateTimeout: number | null = null; // requestAnimationFrame ID
  private statsHandle: number | null = null; // Pending stats update
  private lastRandomSeed: number = 0; // Track last random seed to ensure uniqueness
  private savedItems: SavedItem[] = []; // In-memory storage for saved SVGs

  constructor(previewContainer: HTMLElement) {
    this.config = { ...DEFAULT_CONFIG };
    this.previewContainer = previewContainer;
    this.setupEventListeners();
    this.updateUIFromConfig();
    this.renderGallery(); // Initialize gallery with empty state
  }

  /**
   * Sets up event listeners for all UI controls
   */
  private setupEventListeners(): void {
    // Collapsible category headers
    document.querySelectorAll('.category-header').forEach(header => {
      header.addEventListener('click', () => {
        header.classList.toggle('collapsed');
        const categoryId = header.getAttribute('data-category');
        const content = document.getElementById(`${categoryId}-category`);
        content?.classList.toggle('collapsed');
      });
    });

    // Canvas preset
    const presetSelect = document.getElementById('canvas-preset') as HTMLSelectElement;
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        this.config.canvas.preset = (e.target as HTMLSelectElement).value as CanvasSizePreset;
        // Update dimensions based on preset
        if (this.config.canvas.preset !== 'CUSTOM') {
          const size = PAPER_SIZES[this.config.canvas.preset];
          this.config.canvas.widthMm = size.width;
          this.config.canvas.heightMm = size.height;
        }
        // Clear generator state to force full re-render
        this.generator = null;
        // Cancel any pending generation
        if (this.generateTimeout !== null) {
          window.cancelAnimationFrame(this.generateTimeout);
          this.generateTimeout = null;
        }
        this.updateCustomSizeVisibility();
        this.updateUIFromConfig();
        this.generate();
      });
    }

    // Canvas orientation toggle
    const orientationToggle = document.getElementById('orientation-toggle') as HTMLInputElement;
    if (orientationToggle) {
      orientationToggle.addEventListener('change', (e) => {
        const isLandscape = (e.target as HTMLInputElement).checked;
        this.config.canvas.orientation = isLandscape ? 'landscape' : 'portrait';
        // Clear generator state to force full re-render with new dimensions
        this.generator = null;
        // Cancel any pending generation
        if (this.generateTimeout !== null) {
          window.cancelAnimationFrame(this.generateTimeout);
          this.generateTimeout = null;
        }
        // Update UI immediately
        this.updateUIFromConfig();
        // Force immediate generation with new orientation
        this.generate();
      });
    }

    // Custom dimensions
    const customWidth = document.getElementById('custom-width') as HTMLInputElement;
    if (customWidth) {
      customWidth.addEventListener('input', (e) => {
        this.config.canvas.widthMm = parseFloat((e.target as HTMLInputElement).value);
        if (this.config.canvas.preset === 'CUSTOM') {
          this.generate();
        }
      });
    }

    const customHeight = document.getElementById('custom-height') as HTMLInputElement;
    if (customHeight) {
      customHeight.addEventListener('input', (e) => {
        this.config.canvas.heightMm = parseFloat((e.target as HTMLInputElement).value);
        if (this.config.canvas.preset === 'CUSTOM') {
          this.generate();
        }
      });
    }

    // Margin slider
    this.setupSlider('margin', (value) => {
      this.config.canvas.marginMm = value;
    });

    // Stroke width slider
    this.setupSlider('stroke-width', (value) => {
      this.config.globalStrokeWidthMm = value;
    });

    // Style sliders
    this.setupSlider('corner-radius', (value) => {
      this.config.style.cornerRadiusMm = value;
    });

    // House Settings sliders
    this.setupSlider('house-width', (value) => {
      this.config.style.houseWidthRatio = value;
    });
    this.setupSlider('house-height', (value) => {
      this.config.style.houseHeightRatio = value;
    });
    this.setupSlider('roof-height', (value) => {
      this.config.style.roofHeightRatio = value;
    });
    this.setupSlider('window-count', (value) => {
      this.config.style.windowCount = Math.round(value);
    });
    this.setupSlider('brick-density', (value) => {
      this.config.environment.houseElements.brickDensity = value;
    });
    this.setupSlider('tile-density', (value) => {
      this.config.environment.houseElements.tileDensity = value;
    });

    // Sky category controls
    this.setupSlider('sky-density', (value) => {
      this.config.environment.skyElements.density = value;
    });
    this.setupSlider('sky-size', (value) => {
      this.config.environment.skyElements.sizeMultiplier = value;
    });
    this.setupSlider('sky-jitter', (value) => {
      this.config.environment.skyElements.jitterIntensity = value;
    });
    this.setupSlider('sky-fill-density', (value) => {
      this.config.environment.skyFillDensity = value;
    });
    this.setupSlider('sky-height', (value) => {
      this.config.environment.skyBandHeightRatio = value;
    });

    // Ground category controls
    this.setupSlider('ground-density', (value) => {
      this.config.environment.groundElements.density = value;
    });
    this.setupSlider('ground-size', (value) => {
      this.config.environment.groundElements.sizeMultiplier = value;
    });
    this.setupSlider('ground-jitter', (value) => {
      this.config.environment.groundElements.jitterIntensity = value;
    });
    this.setupSlider('ground-fill-density', (value) => {
      this.config.environment.groundFillDensity = value;
    });
    this.setupSlider('fill-pattern-randomness', (value) => {
      this.config.environment.fillPatternRandomness = value;
    });

    // House category controls
    this.setupSlider('house-jitter', (value) => {
      this.config.environment.houseElements.jitterIntensity = value;
    });

    // Environment toggles
    this.setupToggle('show-ground', (checked) => {
      this.config.environment.showGroundLine = checked;
    });
    this.setupToggle('show-path', (checked) => {
      this.config.environment.showPath = checked;
    });
    this.setupToggle('show-tree', (checked) => {
      this.config.environment.showTree = checked;
    });
    this.setupToggle('show-dog', (checked) => {
      this.config.environment.showDog = checked;
    });
    this.setupToggle('show-human', (checked) => {
      this.config.environment.showHuman = checked;
    });
    this.setupToggle('show-sky', (checked) => {
      this.config.environment.showSkyBand = checked;
    });
    this.setupToggle('show-sun', (checked) => {
      this.config.environment.showSunOrMoon = checked;
    });
    this.setupToggle('show-clouds', (checked) => {
      this.config.environment.showClouds = checked;
    });
    this.setupToggle('show-birds', (checked) => {
      this.config.environment.showBirds = checked;
    });
    this.setupToggle('show-flowers', (checked) => {
      this.config.environment.showFlowers = checked;
    });
    this.setupToggle('show-rocks', (checked) => {
      this.config.environment.showRocks = checked;
    });
    this.setupToggle('show-bushes', (checked) => {
      this.config.environment.showBushes = checked;
    });
    this.setupToggle('show-fence', (checked) => {
      this.config.environment.showFence = checked;
    });

    // House element visibility toggles
    this.setupToggle('show-bricks', (checked) => {
      this.config.environment.showBricks = checked;
    });
    this.setupToggle('show-tiles', (checked) => {
      this.config.environment.showTiles = checked;
    });
    this.setupToggle('show-windows', (checked) => {
      this.config.environment.showWindows = checked;
    });
    this.setupToggle('show-door-details', (checked) => {
      this.config.environment.showDoorDetails = checked;
    });

    // Random seed
    const seedInput = document.getElementById('random-seed') as HTMLInputElement;
    if (seedInput) {
      seedInput.addEventListener('input', (e) => {
        this.config.randomSeed = parseInt((e.target as HTMLInputElement).value) || 0;
        this.generate();
      });
    }

    // Random seed button - always regenerate
    const randomSeedBtn = document.getElementById('random-seed-btn');
    if (randomSeedBtn) {
      randomSeedBtn.addEventListener('click', () => {
        // Generate a truly random seed ensuring it's different from the last one
        let newSeed: number;
        do {
          // Use timestamp + random + counter for guaranteed uniqueness
          newSeed = Math.floor(Math.random() * 1000000) + (Date.now() % 1000000) + Math.floor(Math.random() * 1000);
        } while (newSeed === this.lastRandomSeed || newSeed === this.config.randomSeed);
        
        this.lastRandomSeed = this.config.randomSeed;
        this.config.randomSeed = newSeed;
        
        if (seedInput) {
          seedInput.value = this.config.randomSeed.toString();
        }
        
        // Randomize parameters within strict ranges
        this.randomizeParameters();
        
        // Cancel any pending generation
        if (this.generateTimeout !== null) {
          window.cancelAnimationFrame(this.generateTimeout);
          this.generateTimeout = null;
        }
        
        // Force immediate regeneration without debouncing
        this.generate();
      });
    }

    // Generate button
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => {
        this.generate();
      });
    }

    // Download button
    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        this.download();
      });
    }

    // Batch generate button
    const batchGenerateBtn = document.getElementById('batch-generate-btn');
    if (batchGenerateBtn) {
      batchGenerateBtn.addEventListener('click', () => {
        this.batchGenerate();
      });
    }

    // Save button
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveCurrent();
      });
    }

    // Gallery sidebar toggle
    const galleryToggle = document.getElementById('gallery-toggle');
    if (galleryToggle) {
      galleryToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const sidebar = document.getElementById('gallery-sidebar');
        if (sidebar) {
          const isCollapsed = sidebar.classList.toggle('collapsed');
          const icon = galleryToggle.querySelector('.collapse-icon');
          if (icon) {
            // When collapsed (mostly hidden), show left arrow ◀ to expand
            // When expanded (visible), show right arrow ▶ to collapse
            icon.textContent = isCollapsed ? '◀' : '▶';
          }
        }
      });
    }

    // Batch download saved items
    const batchDownloadBtn = document.getElementById('batch-download-saved-btn');
    if (batchDownloadBtn) {
      batchDownloadBtn.addEventListener('click', () => {
        this.batchDownloadSaved();
      });
    }
  }

  /**
   * Sets up a slider with value display and callback
   * Uses immediate updates with debouncing for smooth performance
   */
  private setupSlider(id: string, callback: (value: number) => void): void {
    const slider = document.getElementById(id) as HTMLInputElement;
    const display = document.getElementById(`${id}-value`);
    
    if (slider) {
      // Update display immediately on input
      slider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        if (display) {
          display.textContent = value.toFixed(2);
        }
        callback(value);
        // Debounce generation for smooth updates
        this.debouncedGenerate();
      });
    }
  }

  /**
   * Debounced generate function for smooth slider updates
   * Using requestAnimationFrame for instant visual updates during slider drag
   * Ensures proper cleanup and prevents race conditions
   */
  private debouncedGenerate(): void {
    // Cancel any pending frame
    if (this.generateTimeout !== null) {
      window.cancelAnimationFrame(this.generateTimeout);
      this.generateTimeout = null;
    }
    
    // Schedule new generation frame
    this.generateTimeout = window.requestAnimationFrame(() => {
      try {
        this.generate();
      } catch (error) {
        console.error('Generation error:', error);
        // Fallback: try to render with safe defaults
        this.generateWithFallback();
      } finally {
        this.generateTimeout = null;
      }
    });
  }

  /**
   * Sets up a checkbox toggle with callback
   */
  private setupToggle(id: string, callback: (checked: boolean) => void): void {
    const toggle = document.getElementById(id) as HTMLInputElement;
    
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        callback(checked);
        this.generate();
      });
    }
  }

  /**
   * Randomizes parameters within strict ranges when random button is pressed
   */
  private randomizeParameters(): void {
    // Helper function to generate random value in range [min, max]
    const randomInRange = (min: number, max: number): number => {
      return Math.random() * (max - min) + min;
    };

    // Field pattern: 0.01 to 0.03
    const fillPatternRandomness = randomInRange(0.01, 0.03);
    this.config.environment.fillPatternRandomness = fillPatternRandomness;
    this.updateSlider('fill-pattern-randomness', fillPatternRandomness);

    // House width: 0.45 to 0.48
    const houseWidth = randomInRange(0.45, 0.48);
    this.config.style.houseWidthRatio = houseWidth;
    this.updateSlider('house-width', houseWidth);

    // House height: 0.3 to 0.36
    const houseHeight = randomInRange(0.3, 0.36);
    this.config.style.houseHeightRatio = houseHeight;
    this.updateSlider('house-height', houseHeight);

    // Roof height: 0.38 to 0.4 (interpreting "point. 3-8 2.4" as 0.38 to 0.4)
    const roofHeight = randomInRange(0.38, 0.4);
    this.config.style.roofHeightRatio = roofHeight;
    this.updateSlider('roof-height', roofHeight);

    // Window count: constant at 4
    this.config.style.windowCount = 4;
    this.updateSlider('window-count', 4);

    // Texture density (brick-density): 0.9 to 1.1
    const brickDensity = randomInRange(0.9, 1.1);
    this.config.environment.houseElements.brickDensity = brickDensity;
    this.updateSlider('brick-density', brickDensity);

    // Roof tile density: 0.9 to 1.5
    const tileDensity = randomInRange(0.9, 1.5);
    this.config.environment.houseElements.tileDensity = tileDensity;
    this.updateSlider('tile-density', tileDensity);

    // Sky density: constant (keep current value - no change)

    // Sky element size: 0.92 to 1.2
    const skySize = randomInRange(0.92, 1.2);
    this.config.environment.skyElements.sizeMultiplier = skySize;
    this.updateSlider('sky-size', skySize);

    // Sky Jitter: 0.5 to 0.69
    const skyJitter = randomInRange(0.5, 0.69);
    this.config.environment.skyElements.jitterIntensity = skyJitter;
    this.updateSlider('sky-jitter', skyJitter);

    // Sky fill density: 0.24 to 0.7
    const skyFillDensity = randomInRange(0.24, 0.7);
    this.config.environment.skyFillDensity = skyFillDensity;
    this.updateSlider('sky-fill-density', skyFillDensity);

    // Sky height: 0.392 to 0.47
    const skyHeight = randomInRange(0.392, 0.47);
    this.config.environment.skyBandHeightRatio = skyHeight;
    this.updateSlider('sky-height', skyHeight);

    // Ground jitter: 0.5 to 0.8
    const groundJitter = randomInRange(0.5, 0.8);
    this.config.environment.groundElements.jitterIntensity = groundJitter;
    this.updateSlider('ground-jitter', groundJitter);

    // Ground field density (ground-density): 0.5 to 0.8
    const groundDensity = randomInRange(0.5, 0.8);
    this.config.environment.groundElements.density = groundDensity;
    this.updateSlider('ground-density', groundDensity);

    // Ground element size: 1 to 1.2
    const groundSize = randomInRange(1, 1.2);
    this.config.environment.groundElements.sizeMultiplier = groundSize;
    this.updateSlider('ground-size', groundSize);

    // House details (house-jitter): 0.5 to 0.59
    const houseJitter = randomInRange(0.5, 0.59);
    this.config.environment.houseElements.jitterIntensity = houseJitter;
    this.updateSlider('house-jitter', houseJitter);
  }

  /**
   * Updates UI controls to reflect current configuration
   */
  private updateUIFromConfig(): void {
    // Canvas
    const presetSelect = document.getElementById('canvas-preset') as HTMLSelectElement;
    if (presetSelect) {
      presetSelect.value = this.config.canvas.preset;
    }

    const orientationToggle = document.getElementById('orientation-toggle') as HTMLInputElement;
    if (orientationToggle) {
      const isLandscape = this.config.canvas.orientation === 'landscape';
      orientationToggle.checked = isLandscape;
    }

    this.updateSlider('margin', this.config.canvas.marginMm);
    this.updateSlider('stroke-width', this.config.globalStrokeWidthMm);

    // Mood
    const moodSelect = document.getElementById('mood') as HTMLSelectElement;
    if (moodSelect) {
      moodSelect.value = this.config.style.mood;
    }

    // Sliders
    this.updateSlider('house-width', this.config.style.houseWidthRatio);
    this.updateSlider('house-height', this.config.style.houseHeightRatio);
    this.updateSlider('roof-height', this.config.style.roofHeightRatio);
    this.updateSlider('corner-radius', this.config.style.cornerRadiusMm);
    this.updateSlider('window-count', this.config.style.windowCount);
    this.updateSlider('jitter', this.config.style.jitterMm);

    // Sky category sliders
    this.updateSlider('sky-density', this.config.environment.skyElements.density);
    this.updateSlider('sky-size', this.config.environment.skyElements.sizeMultiplier);
    this.updateSlider('sky-jitter', this.config.environment.skyElements.jitterIntensity);
    this.updateSlider('sky-fill-density', this.config.environment.skyFillDensity);
    this.updateSlider('sky-height', this.config.environment.skyBandHeightRatio);

    // Ground category sliders
    this.updateSlider('ground-density', this.config.environment.groundElements.density);
    this.updateSlider('ground-size', this.config.environment.groundElements.sizeMultiplier);
    this.updateSlider('ground-jitter', this.config.environment.groundElements.jitterIntensity);
    this.updateSlider('ground-fill-density', this.config.environment.groundFillDensity);
    this.updateSlider('fill-pattern-randomness', this.config.environment.fillPatternRandomness);

    // House category sliders
    this.updateSlider('brick-density', this.config.environment.houseElements.brickDensity);
    this.updateSlider('tile-density', this.config.environment.houseElements.tileDensity);
    this.updateSlider('house-jitter', this.config.environment.houseElements.jitterIntensity);

    // Toggles
    this.updateToggle('show-ground', this.config.environment.showGroundLine);
    this.updateToggle('show-path', this.config.environment.showPath);
    this.updateToggle('show-tree', this.config.environment.showTree);
    this.updateToggle('show-dog', this.config.environment.showDog);
    this.updateToggle('show-human', this.config.environment.showHuman ?? true);
    this.updateToggle('show-sky', this.config.environment.showSkyBand);
    this.updateToggle('show-sun', this.config.environment.showSunOrMoon);
    this.updateToggle('show-clouds', this.config.environment.showClouds ?? true);
    this.updateToggle('show-birds', this.config.environment.showBirds ?? true);
    this.updateToggle('show-flowers', this.config.environment.showFlowers ?? true);
    this.updateToggle('show-rocks', this.config.environment.showRocks ?? true);
    this.updateToggle('show-bushes', this.config.environment.showBushes ?? true);
    this.updateToggle('show-fence', this.config.environment.showFence ?? true);

    // House element visibility toggles
    this.updateToggle('show-bricks', this.config.environment.showBricks ?? true);
    this.updateToggle('show-tiles', this.config.environment.showTiles ?? true);
    this.updateToggle('show-windows', this.config.environment.showWindows ?? true);
    this.updateToggle('show-door-details', this.config.environment.showDoorDetails ?? true);

    // Seed
    const seedInput = document.getElementById('random-seed') as HTMLInputElement;
    if (seedInput) {
      seedInput.value = this.config.randomSeed.toString();
    }

    this.updateCustomSizeVisibility();
  }

  /**
   * Updates a slider value and display
   */
  private updateSlider(id: string, value: number): void {
    const slider = document.getElementById(id) as HTMLInputElement;
    const display = document.getElementById(`${id}-value`);
    
    if (slider) {
      slider.value = value.toString();
    }
    if (display) {
      display.textContent = value.toFixed(2);
    }
  }

  /**
   * Updates a toggle checkbox
   */
  private updateToggle(id: string, checked: boolean): void {
    const toggle = document.getElementById(id) as HTMLInputElement;
    if (toggle) {
      toggle.checked = checked;
    }
  }

  /**
   * Shows/hides custom size inputs based on preset
   */
  private updateCustomSizeVisibility(): void {
    const customSizeGroup = document.getElementById('custom-size-group');
    if (customSizeGroup) {
      customSizeGroup.style.display = 
        this.config.canvas.preset === 'CUSTOM' ? 'block' : 'none';
    }
  }

  /**
   * Validates the configuration and ensures all values are within valid ranges
   * Returns a validated config with fallback defaults for invalid values
   * Preserves all existing fields and only constrains values that need validation
   */
  private validateConfig(): HomeGeneratorConfig {
    // Start with defaults and merge in current config, ensuring all fields exist
    const validated: HomeGeneratorConfig = {
      canvas: {
        ...DEFAULT_CONFIG.canvas,
        ...(this.config?.canvas || {}),
      },
      style: {
        ...DEFAULT_CONFIG.style,
        ...(this.config?.style || {}),
      },
      environment: {
        ...DEFAULT_CONFIG.environment,
        ...(this.config?.environment || {}),
      },
      pens: (this.config?.pens && Array.isArray(this.config.pens) && this.config.pens.length > 0) 
        ? this.config.pens 
        : DEFAULT_CONFIG.pens,
      randomSeed: this.config?.randomSeed ?? DEFAULT_CONFIG.randomSeed,
      globalStrokeWidthMm: this.config?.globalStrokeWidthMm ?? DEFAULT_CONFIG.globalStrokeWidthMm,
    };
    
    // Validate and constrain canvas values
    validated.canvas.marginMm = Math.max(0, Math.min(100, validated.canvas.marginMm ?? 15));
    if (validated.canvas.orientation !== 'landscape' && validated.canvas.orientation !== 'portrait') {
      validated.canvas.orientation = 'portrait';
    }
    validated.canvas.widthMm = Math.max(50, Math.min(2000, validated.canvas.widthMm ?? 210));
    validated.canvas.heightMm = Math.max(50, Math.min(2000, validated.canvas.heightMm ?? 297));
    
    // Validate and constrain style values (preserve all fields, only constrain ranges)
    validated.style.houseWidthRatio = Math.max(0.1, Math.min(0.9, validated.style.houseWidthRatio ?? 0.45));
    validated.style.houseHeightRatio = Math.max(0.1, Math.min(0.9, validated.style.houseHeightRatio ?? 0.35));
    validated.style.roofHeightRatio = Math.max(0.1, Math.min(1.0, validated.style.roofHeightRatio ?? 0.4));
    validated.style.cornerRadiusMm = Math.max(0, Math.min(20, validated.style.cornerRadiusMm ?? 3));
    validated.style.windowCount = Math.max(0, Math.min(4, Math.round(validated.style.windowCount ?? 3)));
    validated.style.jitterMm = Math.max(0, Math.min(10, validated.style.jitterMm ?? 0.3));
    // Ensure other style fields have valid defaults if missing
    validated.style.windowWidthRatio = validated.style.windowWidthRatio ?? DEFAULT_CONFIG.style.windowWidthRatio;
    validated.style.windowHeightRatio = validated.style.windowHeightRatio ?? DEFAULT_CONFIG.style.windowHeightRatio;
    validated.style.doorWidthRatio = validated.style.doorWidthRatio ?? DEFAULT_CONFIG.style.doorWidthRatio;
    validated.style.doorHeightRatio = validated.style.doorHeightRatio ?? DEFAULT_CONFIG.style.doorHeightRatio;
    validated.style.asymmetryFactor = validated.style.asymmetryFactor ?? DEFAULT_CONFIG.style.asymmetryFactor;
    validated.style.lineBreakProbability = validated.style.lineBreakProbability ?? DEFAULT_CONFIG.style.lineBreakProbability;
    if (!validated.style.mood || !['cozy', 'temporary', 'fortress', 'minimal', 'playful'].includes(validated.style.mood)) {
      validated.style.mood = DEFAULT_CONFIG.style.mood;
    }
    
    // Validate and constrain environment values
    validated.environment.elementDensity = Math.max(0, Math.min(1, validated.environment.elementDensity ?? 0.85));
    validated.environment.skyBandHeightRatio = Math.max(0.10, Math.min(0.60, validated.environment.skyBandHeightRatio ?? 0.35));
    validated.environment.skyFillDensity = Math.max(0, Math.min(2, validated.environment.skyFillDensity ?? 1.2));
    validated.environment.groundFillDensity = Math.max(0, Math.min(2, validated.environment.groundFillDensity ?? 1.4));
    // Ensure all boolean flags exist
    validated.environment.showGroundLine = validated.environment.showGroundLine ?? true;
    validated.environment.showPath = validated.environment.showPath ?? true;
    validated.environment.showTree = validated.environment.showTree ?? true;
    validated.environment.showDog = validated.environment.showDog ?? true;
    validated.environment.showHuman = validated.environment.showHuman ?? true;
    validated.environment.showSkyBand = validated.environment.showSkyBand ?? true;
    validated.environment.showSunOrMoon = validated.environment.showSunOrMoon ?? true;
    validated.environment.showClouds = validated.environment.showClouds ?? true;
    validated.environment.showBirds = validated.environment.showBirds ?? true;
    validated.environment.showFlowers = validated.environment.showFlowers ?? true;
    validated.environment.showRocks = validated.environment.showRocks ?? true;
    validated.environment.showBushes = validated.environment.showBushes ?? true;
    validated.environment.showFence = validated.environment.showFence ?? true;
    validated.environment.showBricks = validated.environment.showBricks ?? true;
    validated.environment.showTiles = validated.environment.showTiles ?? true;
    validated.environment.showWindows = validated.environment.showWindows ?? true;
    validated.environment.showDoorDetails = validated.environment.showDoorDetails ?? true;
    
    // Validate sky elements configuration
    if (!validated.environment.skyElements) {
      // Migrate old config
      validated.environment.skyElements = {
        density: validated.environment.elementDensity ?? 0.85,
        sizeMultiplier: 1.0,
        spreadHorizontal: 0.8,
        spreadVertical: 0.6,
        jitterIntensity: 0.5
      };
    }
    validated.environment.skyElements.density = Math.max(0, Math.min(1, validated.environment.skyElements.density ?? 0.85));
    validated.environment.skyElements.sizeMultiplier = Math.max(0.5, Math.min(2.0, validated.environment.skyElements.sizeMultiplier ?? 1.0));
    validated.environment.skyElements.spreadHorizontal = Math.max(0, Math.min(1, validated.environment.skyElements.spreadHorizontal ?? 0.8));
    validated.environment.skyElements.spreadVertical = Math.max(0, Math.min(1, validated.environment.skyElements.spreadVertical ?? 0.6));
    validated.environment.skyElements.jitterIntensity = Math.max(0, Math.min(3, validated.environment.skyElements.jitterIntensity ?? 0.5));

    // Validate ground elements configuration
    if (!validated.environment.groundElements) {
      // Migrate old config
      validated.environment.groundElements = {
        density: validated.environment.elementDensity ?? 0.85,
        sizeMultiplier: 1.0,
        scatterRadius: 30,
        jitterIntensity: 0.5
      };
    }
    validated.environment.groundElements.density = Math.max(0, Math.min(1, validated.environment.groundElements.density ?? 0.85));
    validated.environment.groundElements.sizeMultiplier = Math.max(0.5, Math.min(2.0, validated.environment.groundElements.sizeMultiplier ?? 1.0));
    validated.environment.groundElements.scatterRadius = Math.max(0, Math.min(50, validated.environment.groundElements.scatterRadius ?? 30));
    validated.environment.groundElements.jitterIntensity = Math.max(0, Math.min(3, validated.environment.groundElements.jitterIntensity ?? 0.5));

    // Validate house elements configuration
    if (!validated.environment.houseElements) {
      validated.environment.houseElements = {
        brickDensity: 1.0,
        tileDensity: 1.0,
        detailLevel: 1.0,
        jitterIntensity: 0.3
      };
    }
    validated.environment.houseElements.brickDensity = Math.max(0, Math.min(2, validated.environment.houseElements.brickDensity ?? 1.0));
    validated.environment.houseElements.tileDensity = Math.max(0, Math.min(2, validated.environment.houseElements.tileDensity ?? 1.0));
    validated.environment.houseElements.detailLevel = Math.max(0, Math.min(1, validated.environment.houseElements.detailLevel ?? 1.0));
    validated.environment.houseElements.jitterIntensity = Math.max(0, Math.min(3, validated.environment.houseElements.jitterIntensity ?? 0.3));
    
    // Validate global stroke width
    validated.globalStrokeWidthMm = Math.max(0.1, Math.min(10, validated.globalStrokeWidthMm ?? 0.5));
    
    // Validate random seed
    if (!Number.isInteger(validated.randomSeed) || validated.randomSeed < 0) {
      validated.randomSeed = 12345;
    }
    
    return validated;
  }

  /**
   * Generates and displays the house with validation and error handling
   */
  generate(): void {
    try {
      // Validate config before generating
      const validatedConfig = this.validateConfig();

      // Update internal config with validated values
      this.config = validatedConfig;

      // Generate house
      this.generator = new HouseGenerator(this.config);
      const pathGroups = this.generator.generate();
      const svg = generateHomeSvg(this.config, pathGroups);

      // Clear preview and add new SVG
      // Find or create the svg-wrapper div
      let svgWrapper = this.previewContainer.querySelector('.svg-wrapper');
      if (!svgWrapper) {
        svgWrapper = document.createElement('div');
        svgWrapper.className = 'svg-wrapper';
        this.previewContainer.innerHTML = '';
        this.previewContainer.appendChild(svgWrapper);
      } else {
        svgWrapper.innerHTML = '';
      }
      svgWrapper.appendChild(svg);

      // Defer stats off the critical path so the preview paints immediately
      this.scheduleStatsUpdate(pathGroups);
    } catch (error) {
      console.error('Generation failed:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      // Fallback to safe generation
      this.generateWithFallback(error);
    }
  }

  /**
   * Schedules stats calculation off the critical render path so the SVG paints
   * immediately when sliders change. Cancels any pending pass to avoid wasted work.
   */
  private scheduleStatsUpdate(pathGroups: PathGroup[]): void {
    if (this.statsHandle !== null) {
      const w = window as Window & { cancelIdleCallback?: (h: number) => void };
      if (w.cancelIdleCallback) w.cancelIdleCallback(this.statsHandle);
      else window.clearTimeout(this.statsHandle);
      this.statsHandle = null;
    }

    const run = () => {
      this.statsHandle = null;
      try {
        this.updateStats(calculateSvgStats(pathGroups));
      } catch (e) {
        console.error('Stats update failed:', e);
      }
    };

    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    this.statsHandle = w.requestIdleCallback
      ? w.requestIdleCallback(run, { timeout: 200 })
      : window.setTimeout(run, 0);
  }

  /**
   * Updates the statistics display in the preview header
   */
  private updateStats(stats: SvgStats): void {
    // Update paper size
    const paperSizeEl = document.getElementById('paper-size');
    if (paperSizeEl) {
      const orientation = this.config.canvas.orientation === 'landscape' ? ' (L)' : ' (P)';
      paperSizeEl.textContent = this.config.canvas.preset + orientation;
    }
    
    // Update line count
    const lineCountEl = document.getElementById('line-count');
    if (lineCountEl) {
      lineCountEl.textContent = stats.lineCount.toString();
    }
    
    // Update total length (convert mm to meters)
    const totalLengthEl = document.getElementById('total-length');
    if (totalLengthEl) {
      const meters = stats.totalLengthMm / 1000;
      totalLengthEl.textContent = `${meters.toFixed(1)}m`;
    }
  }

  /**
   * Fallback generation with safe defaults if main generation fails
   */
  private generateWithFallback(originalError?: unknown): void {
    try {
      // Use default config as fallback, ensuring all fields are properly set
      const fallbackConfig: HomeGeneratorConfig = {
        ...DEFAULT_CONFIG,
        randomSeed: (this.config?.randomSeed && Number.isInteger(this.config.randomSeed)) 
          ? this.config.randomSeed 
          : 12345,
      };
      
      // Ensure all nested objects are properly initialized
      fallbackConfig.canvas = { ...DEFAULT_CONFIG.canvas };
      fallbackConfig.style = { ...DEFAULT_CONFIG.style };
      fallbackConfig.environment = { ...DEFAULT_CONFIG.environment };
      fallbackConfig.pens = [...DEFAULT_CONFIG.pens];
      
      const generator = new HouseGenerator(fallbackConfig);
      const pathGroups = generator.generate();
      const svg = generateHomeSvg(fallbackConfig, pathGroups);

      // Find or create the svg-wrapper div
      let svgWrapper = this.previewContainer.querySelector('.svg-wrapper');
      if (!svgWrapper) {
        svgWrapper = document.createElement('div');
        svgWrapper.className = 'svg-wrapper';
        this.previewContainer.innerHTML = '';
        this.previewContainer.appendChild(svgWrapper);
      } else {
        svgWrapper.innerHTML = '';
      }
      svgWrapper.appendChild(svg);

      // Defer stats off the critical path
      this.scheduleStatsUpdate(pathGroups);
      
      // Update config to match what was rendered
      this.config = fallbackConfig;
      this.updateUIFromConfig();
      
      console.warn('Used fallback configuration due to error. Original error:', originalError);
    } catch (fallbackError) {
      console.error('Fallback generation also failed:', fallbackError);
      if (fallbackError instanceof Error) {
        console.error('Fallback error details:', fallbackError.message, fallbackError.stack);
      }
      
      // Last resort: show detailed error message
      const errorMsg = originalError instanceof Error ? originalError.message : String(originalError);
      const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      this.previewContainer.innerHTML = `
        <div style="color: red; padding: 20px; text-align: center;">
          <h3>Error generating house</h3>
          <p>Original error: ${errorMsg}</p>
          <p>Fallback error: ${fallbackMsg}</p>
          <p style="margin-top: 20px;">Please check the browser console for details and refresh the page.</p>
        </div>
      `;
    }
  }

  /**
   * Downloads the current house as SVG
   */
  download(): void {
    if (!this.generator) {
      this.generate();
    }
    
    if (this.generator) {
      const pathGroups = this.generator.generate();
      exportHome(this.config, pathGroups);
    }
  }

  /**
   * Generates 30 random house drawings and saves them
   * Uses File System Access API if available, otherwise downloads sequentially
   */
  async batchGenerate(): Promise<void> {
    const count = 30;
    const batchGenerateBtn = document.getElementById('batch-generate-btn') as HTMLButtonElement;
    
    if (batchGenerateBtn) {
      batchGenerateBtn.disabled = true;
      batchGenerateBtn.textContent = 'Generating...';
    }

    try {
      // Generate 30 unique random seeds
      const seeds: number[] = [];
      for (let i = 0; i < count; i++) {
        let seed: number;
        do {
          seed = Math.floor(Math.random() * 1000000);
        } while (seeds.includes(seed));
        seeds.push(seed);
      }

      // Check if File System Access API is available
      if ('showDirectoryPicker' in window) {
        // Use File System Access API to save to a folder
        try {
          const directoryHandle = await (window as any).showDirectoryPicker();
          const files: Array<{ name: string; svg: string }> = [];

          // Generate all SVGs first
          for (let i = 0; i < count; i++) {
            const seed = seeds[i];
            const config = { ...this.config, randomSeed: seed };
            const generator = new HouseGenerator(config);
            const pathGroups = generator.generate();
            const svg = generateHomeSvg(config, pathGroups);
            const svgString = svgToString(svg);
            
            const filename = `house-${String(i + 1).padStart(2, '0')}-seed-${seed}.svg`;
            files.push({ name: filename, svg: svgString });

            if (batchGenerateBtn) {
              batchGenerateBtn.textContent = `Generating ${i + 1}/${count}...`;
            }
          }

          // Save all files to the selected directory
          for (let i = 0; i < files.length; i++) {
            const fileHandle = await directoryHandle.getFileHandle(files[i].name, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(files[i].svg);
            await writable.close();
          }

          alert(`✅ Successfully saved ${count} SVG files to the selected folder!`);
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            throw error;
          }
          // User cancelled, fall through to sequential download
        }
      }

      // Fallback: Sequential download (if File System Access API not available or user cancelled)
      if (!('showDirectoryPicker' in window) || confirm('File System Access API not available. Download files sequentially? (You may need to allow multiple downloads)')) {
        for (let i = 0; i < count; i++) {
          const seed = seeds[i];
          const config = { ...this.config, randomSeed: seed };
          const generator = new HouseGenerator(config);
          const pathGroups = generator.generate();
          const svg = generateHomeSvg(config, pathGroups);
          
          const filename = `house-${String(i + 1).padStart(2, '0')}-seed-${seed}.svg`;
          downloadSvg(svg, filename);

          if (batchGenerateBtn) {
            batchGenerateBtn.textContent = `Downloading ${i + 1}/${count}...`;
          }

          // Small delay to avoid browser blocking multiple downloads
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        alert(`✅ Downloaded ${count} SVG files!`);
      }
    } catch (error) {
      console.error('Batch generation error:', error);
      alert(`Error during batch generation: ${error}`);
    } finally {
      if (batchGenerateBtn) {
        batchGenerateBtn.disabled = false;
        batchGenerateBtn.textContent = 'Batch Generate (30)';
      }
    }
  }

  /**
   * Saves the current SVG to the gallery
   */
  saveCurrent(): void {
    if (!this.generator) {
      this.generate();
    }

    if (!this.generator) {
      console.error('Cannot save: generator not initialized');
      return;
    }

    try {
      const pathGroups = this.generator.generate();
      const svg = generateHomeSvg(this.config, pathGroups);
      const svgString = svgToString(svg);

      const savedItem: SavedItem = {
        id: `saved-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        svgString,
        config: { ...this.config },
        timestamp: Date.now(),
        seed: this.config.randomSeed
      };

      this.savedItems.push(savedItem);
      this.renderGallery();

      // Visual feedback
      const saveBtn = document.getElementById('save-btn');
      if (saveBtn) {
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.style.background = '#28a745';
        setTimeout(() => {
          if (saveBtn) {
            saveBtn.textContent = originalText;
            saveBtn.style.background = '';
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error saving SVG:', error);
      alert('Error saving SVG. Please try again.');
    }
  }

  /**
   * Loads a saved item into the preview
   */
  loadSavedItem(id: string): void {
    const item = this.savedItems.find(s => s.id === id);
    if (!item) {
      console.error('Saved item not found:', id);
      return;
    }

    // Restore config
    this.config = { ...item.config };
    this.updateUIFromConfig();

    // Generate and display
    this.generator = new HouseGenerator(this.config);
    const pathGroups = this.generator.generate();
    const svg = generateHomeSvg(this.config, pathGroups);

    // Update preview
    let svgWrapper = this.previewContainer.querySelector('.svg-wrapper');
    if (!svgWrapper) {
      svgWrapper = document.createElement('div');
      svgWrapper.className = 'svg-wrapper';
      this.previewContainer.innerHTML = '';
      this.previewContainer.appendChild(svgWrapper);
    } else {
      svgWrapper.innerHTML = '';
    }
    svgWrapper.appendChild(svg);

    // Defer stats off the critical path
    this.scheduleStatsUpdate(pathGroups);
  }

  /**
   * Deletes a saved item from the gallery
   */
  deleteSavedItem(id: string): void {
    this.savedItems = this.savedItems.filter(item => item.id !== id);
    this.renderGallery();
  }

  /**
   * Downloads a single saved item
   */
  downloadSavedItem(id: string): void {
    const item = this.savedItems.find(s => s.id === id);
    if (!item) {
      console.error('Saved item not found:', id);
      return;
    }

    const blob = new Blob([item.svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `home-${item.config.style.mood}-${item.seed}-${new Date(item.timestamp).toISOString().slice(0, 19).replace(/[:]/g, '-')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Batch downloads all saved items
   */
  async batchDownloadSaved(): Promise<void> {
    if (this.savedItems.length === 0) {
      alert('No saved items to download.');
      return;
    }

    const batchDownloadBtn = document.getElementById('batch-download-saved-btn') as HTMLButtonElement;
    if (batchDownloadBtn) {
      batchDownloadBtn.disabled = true;
      batchDownloadBtn.textContent = 'Downloading...';
    }

    try {
      // Check if File System Access API is available
      if ('showDirectoryPicker' in window) {
        try {
          const directoryHandle = await (window as any).showDirectoryPicker();

          for (let i = 0; i < this.savedItems.length; i++) {
            const item = this.savedItems[i];
            const filename = `home-${item.config.style.mood}-${item.seed}-${new Date(item.timestamp).toISOString().slice(0, 19).replace(/[:]/g, '-')}.svg`;
            
            const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(item.svgString);
            await writable.close();

            if (batchDownloadBtn) {
              batchDownloadBtn.textContent = `Downloading ${i + 1}/${this.savedItems.length}...`;
            }
          }

          alert(`✅ Successfully saved ${this.savedItems.length} SVG files to the selected folder!`);
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            throw error;
          }
          // User cancelled, fall through to sequential download
        }
      }

      // Fallback: Sequential download
      if (!('showDirectoryPicker' in window) || confirm('File System Access API not available. Download files sequentially? (You may need to allow multiple downloads)')) {
        for (let i = 0; i < this.savedItems.length; i++) {
          const item = this.savedItems[i];
          const filename = `home-${item.config.style.mood}-${item.seed}-${new Date(item.timestamp).toISOString().slice(0, 19).replace(/[:]/g, '-')}.svg`;
          
          const blob = new Blob([item.svgString], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          if (batchDownloadBtn) {
            batchDownloadBtn.textContent = `Downloading ${i + 1}/${this.savedItems.length}...`;
          }

          // Small delay to avoid browser blocking multiple downloads
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        alert(`✅ Downloaded ${this.savedItems.length} SVG files!`);
      }
    } catch (error) {
      console.error('Batch download error:', error);
      alert(`Error during batch download: ${error}`);
    } finally {
      if (batchDownloadBtn) {
        batchDownloadBtn.disabled = false;
        batchDownloadBtn.textContent = `Download All (${this.savedItems.length})`;
      }
    }
  }

  /**
   * Renders the gallery sidebar with all saved items
   */
  renderGallery(): void {
    const galleryContainer = document.getElementById('gallery-thumbnails');
    const galleryCount = document.getElementById('gallery-count');
    const batchDownloadBtn = document.getElementById('batch-download-saved-btn') as HTMLButtonElement;

    if (!galleryContainer) {
      return;
    }

    // Update count
    if (galleryCount) {
      galleryCount.textContent = this.savedItems.length.toString();
    }

    // Update batch download button
    if (batchDownloadBtn) {
      batchDownloadBtn.textContent = `Download All (${this.savedItems.length})`;
      batchDownloadBtn.disabled = this.savedItems.length === 0;
    }

    // Clear existing thumbnails
    galleryContainer.innerHTML = '';

    if (this.savedItems.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'gallery-empty';
      emptyState.textContent = 'No saved items yet. Click "Save" to add items to your gallery.';
      galleryContainer.appendChild(emptyState);
      return;
    }

    // Create thumbnails for each saved item
    this.savedItems.forEach(item => {
      const thumbnailWrapper = document.createElement('div');
      thumbnailWrapper.className = 'gallery-thumbnail-wrapper';

      // Create thumbnail container
      const thumbnail = document.createElement('div');
      thumbnail.className = 'gallery-thumbnail';
      thumbnail.setAttribute('data-item-id', item.id);
      // Make thumbnail clickable to preview
      thumbnail.addEventListener('click', () => {
        this.loadSavedItem(item.id);
      });

      // Parse SVG string to create preview
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(item.svgString, 'image/svg+xml');
      const svgElement = svgDoc.documentElement;

      // Create a scaled-down preview
      const previewSvg = svgElement.cloneNode(true) as SVGSVGElement;
      previewSvg.setAttribute('width', '120');
      previewSvg.setAttribute('height', '120');
      previewSvg.style.maxWidth = '100%';
      previewSvg.style.maxHeight = '100%';

      thumbnail.appendChild(previewSvg);

      // Add label with seed
      const label = document.createElement('div');
      label.className = 'gallery-thumbnail-label';
      label.textContent = `Seed: ${item.seed}`;
      thumbnail.appendChild(label);

      // Add action buttons
      const actions = document.createElement('div');
      actions.className = 'gallery-thumbnail-actions';

      const previewBtn = document.createElement('button');
      previewBtn.className = 'gallery-action-btn preview-btn';
      previewBtn.title = 'Preview';
      previewBtn.innerHTML = '👁';
      previewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.loadSavedItem(item.id);
      });

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'gallery-action-btn download-btn';
      downloadBtn.title = 'Download';
      downloadBtn.innerHTML = '⬇';
      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadSavedItem(item.id);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'gallery-action-btn delete-btn';
      deleteBtn.title = 'Delete';
      deleteBtn.innerHTML = '🗑';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this saved item?')) {
          this.deleteSavedItem(item.id);
        }
      });

      actions.appendChild(previewBtn);
      actions.appendChild(downloadBtn);
      actions.appendChild(deleteBtn);

      thumbnailWrapper.appendChild(thumbnail);
      thumbnailWrapper.appendChild(actions);
      galleryContainer.appendChild(thumbnailWrapper);
    });
  }
}

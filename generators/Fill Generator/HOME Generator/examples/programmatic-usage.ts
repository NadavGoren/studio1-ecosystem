/**
 * Example: Programmatic usage of HOME Generator
 * 
 * This file demonstrates how to use the generator
 * programmatically for batch generation, custom workflows,
 * or integration into other systems.
 */

import { 
  HouseGenerator, 
  HomeGeneratorConfig,
  DEFAULT_CONFIG,
  getMoodDefaults,
  HomeMood
} from '../src/index';
import { generateHomeSvg, svgToString } from '../src/export/svgExporter';

// Example 1: Generate a single house with custom configuration
function generateSingleHouse() {
  const config: HomeGeneratorConfig = {
    ...DEFAULT_CONFIG,
    randomSeed: 42,
    style: {
      ...DEFAULT_CONFIG.style,
      ...getMoodDefaults('cozy'),
      houseWidthRatio: 0.5,
      windowCount: 4,
      jitterMm: 0.8
    },
    environment: {
      ...DEFAULT_CONFIG.environment,
      showTree: true,
      showDog: true,
      showPath: true
    }
  };

  const generator = new HouseGenerator(config);
  const pathGroups = generator.generate();
  const svg = generateHomeSvg(config, pathGroups);
  const svgString = svgToString(svg);

  console.log('Generated house SVG:', svgString.length, 'characters');
  return svgString;
}

// Example 2: Generate a series with different moods
function generateMoodSeries() {
  const moods: HomeMood[] = ['cozy', 'temporary', 'fortress', 'minimal', 'playful'];
  const series: Array<{ mood: HomeMood; seed: number; svg: string }> = [];

  for (let i = 0; i < moods.length; i++) {
    const mood = moods[i];
    const seed = 1000 + i * 100;

    const config: HomeGeneratorConfig = {
      ...DEFAULT_CONFIG,
      randomSeed: seed,
      style: {
        ...DEFAULT_CONFIG.style,
        ...getMoodDefaults(mood)
      }
    };

    const generator = new HouseGenerator(config);
    const pathGroups = generator.generate();
    const svg = generateHomeSvg(config, pathGroups);
    const svgString = svgToString(svg);

    series.push({ mood, seed, svg: svgString });
  }

  console.log(`Generated ${series.length} houses in mood series`);
  return series;
}

// Example 3: Generate variations with same base but different seeds
function generateSeedVariations(baseSeed: number, count: number) {
  const variations: string[] = [];

  const baseConfig = {
    ...DEFAULT_CONFIG,
    style: {
      ...DEFAULT_CONFIG.style,
      ...getMoodDefaults('cozy')
    }
  };

  for (let i = 0; i < count; i++) {
    const config: HomeGeneratorConfig = {
      ...baseConfig,
      randomSeed: baseSeed + i
    };

    const generator = new HouseGenerator(config);
    const pathGroups = generator.generate();
    const svg = generateHomeSvg(config, pathGroups);
    
    variations.push(svgToString(svg));
  }

  console.log(`Generated ${count} variations from seed ${baseSeed}`);
  return variations;
}

// Example 4: Generate with progressive jitter
function generateJitterProgression() {
  const jitterLevels = [0, 0.3, 0.6, 1.0, 1.5, 2.0];
  const results: Array<{ jitter: number; svg: string }> = [];

  for (const jitter of jitterLevels) {
    const config: HomeGeneratorConfig = {
      ...DEFAULT_CONFIG,
      randomSeed: 12345, // Same seed for comparison
      style: {
        ...DEFAULT_CONFIG.style,
        ...getMoodDefaults('minimal'),
        jitterMm: jitter
      }
    };

    const generator = new HouseGenerator(config);
    const pathGroups = generator.generate();
    const svg = generateHomeSvg(config, pathGroups);

    results.push({
      jitter,
      svg: svgToString(svg)
    });
  }

  console.log(`Generated ${results.length} houses with jitter progression`);
  return results;
}

// Example 5: Generate with all canvas sizes
function generateMultipleSizes() {
  const sizes = [
    { preset: 'A5' as const, orientation: 'portrait' as const },
    { preset: 'A4' as const, orientation: 'portrait' as const },
    { preset: 'A4' as const, orientation: 'landscape' as const },
    { preset: 'A3' as const, orientation: 'portrait' as const }
  ];

  const results = sizes.map(size => {
    const config: HomeGeneratorConfig = {
      ...DEFAULT_CONFIG,
      randomSeed: 9999,
      canvas: {
        ...DEFAULT_CONFIG.canvas,
        preset: size.preset,
        orientation: size.orientation
      }
    };

    const generator = new HouseGenerator(config);
    const pathGroups = generator.generate();
    const svg = generateHomeSvg(config, pathGroups);

    return {
      preset: size.preset,
      orientation: size.orientation,
      svg: svgToString(svg)
    };
  });

  console.log(`Generated ${results.length} houses in different sizes`);
  return results;
}

// Example 6: Generate with progressive complexity
function generateComplexityProgression() {
  const complexityLevels = [
    { windowCount: 0, elements: false, name: 'Minimal' },
    { windowCount: 1, elements: false, name: 'Simple' },
    { windowCount: 2, elements: true, name: 'Basic' },
    { windowCount: 3, elements: true, name: 'Standard' },
    { windowCount: 4, elements: true, name: 'Complex' }
  ];

  const results = complexityLevels.map(level => {
    const config: HomeGeneratorConfig = {
      ...DEFAULT_CONFIG,
      randomSeed: 7777,
      style: {
        ...DEFAULT_CONFIG.style,
        windowCount: level.windowCount
      },
      environment: {
        ...DEFAULT_CONFIG.environment,
        showTree: level.elements,
        showDog: level.elements,
        showPath: level.elements,
        showSunOrMoon: level.elements
      }
    };

    const generator = new HouseGenerator(config);
    const pathGroups = generator.generate();
    const svg = generateHomeSvg(config, pathGroups);

    return {
      name: level.name,
      svg: svgToString(svg)
    };
  });

  console.log(`Generated ${results.length} houses with complexity progression`);
  return results;
}

// Example 7: Generate a matrix (moods × seeds)
function generateMatrix() {
  const moods: HomeMood[] = ['cozy', 'fortress', 'minimal'];
  const seedBase = 5000;
  const seedCount = 3;

  const matrix: Array<Array<{ mood: HomeMood; seed: number; svg: string }>> = [];

  for (const mood of moods) {
    const row: Array<{ mood: HomeMood; seed: number; svg: string }> = [];
    
    for (let i = 0; i < seedCount; i++) {
      const seed = seedBase + i;
      
      const config: HomeGeneratorConfig = {
        ...DEFAULT_CONFIG,
        randomSeed: seed,
        style: {
          ...DEFAULT_CONFIG.style,
          ...getMoodDefaults(mood)
        }
      };

      const generator = new HouseGenerator(config);
      const pathGroups = generator.generate();
      const svg = generateHomeSvg(config, pathGroups);

      row.push({
        mood,
        seed,
        svg: svgToString(svg)
      });
    }
    
    matrix.push(row);
  }

  console.log(`Generated ${moods.length}×${seedCount} matrix of houses`);
  return matrix;
}

// Export examples for use
export {
  generateSingleHouse,
  generateMoodSeries,
  generateSeedVariations,
  generateJitterProgression,
  generateMultipleSizes,
  generateComplexityProgression,
  generateMatrix
};

// Example usage in Node.js or browser console:
/*

import { generateMoodSeries } from './examples/programmatic-usage';

const series = generateMoodSeries();
// series now contains SVG strings for all moods

// Save to files (Node.js):
import fs from 'fs';
series.forEach(({ mood, seed, svg }) => {
  fs.writeFileSync(`house-${mood}-${seed}.svg`, svg);
});

*/







/**
 * Batch Generation Script
 * Generates 30 random house drawings and saves them to a folder
 * 
 * Usage: npm run batch-generate
 * or: npx tsx scripts/batch-generate.ts
 */

// Setup DOM environment for Node.js
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

// Make DOM APIs available globally
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).XMLSerializer = dom.window.XMLSerializer;

import { 
  HouseGenerator, 
  HomeGeneratorConfig,
  DEFAULT_CONFIG
} from '../src/index';
import { generateHomeSvg, svgToString } from '../src/export/svgExporter';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Generates 30 random house SVGs and saves them to a folder
 */
function batchGenerate(): void {
  const outputDir = join(process.cwd(), 'batch-output');
  const count = 30;

  // Create output directory if it doesn't exist
  try {
    mkdirSync(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
    console.log(`Using existing output directory: ${outputDir}`);
  }

  console.log(`Generating ${count} random house drawings...\n`);

  const seeds: number[] = [];
  const results: Array<{ seed: number; filename: string }> = [];

  // Generate 30 unique random seeds
  for (let i = 0; i < count; i++) {
    let seed: number;
    do {
      seed = Math.floor(Math.random() * 1000000);
    } while (seeds.includes(seed));
    seeds.push(seed);
  }

  // Generate each house
  for (let i = 0; i < count; i++) {
    const seed = seeds[i];
    const config: HomeGeneratorConfig = {
      ...DEFAULT_CONFIG,
      randomSeed: seed
    };

    try {
      // Generate the house
      const generator = new HouseGenerator(config);
      const pathGroups = generator.generate();
      const svg = generateHomeSvg(config, pathGroups);
      const svgString = svgToString(svg);

      // Create filename
      const filename = `house-${String(i + 1).padStart(2, '0')}-seed-${seed}.svg`;
      const filepath = join(outputDir, filename);

      // Save to file
      writeFileSync(filepath, svgString, 'utf-8');

      results.push({ seed, filename });
      console.log(`✓ Generated ${i + 1}/${count}: ${filename} (seed: ${seed})`);
    } catch (error) {
      console.error(`✗ Error generating house ${i + 1} with seed ${seed}:`, error);
    }
  }

  console.log(`\n✅ Batch generation complete!`);
  console.log(`📁 Saved ${results.length} SVG files to: ${outputDir}`);
  console.log(`\nGenerated files:`);
  results.forEach(({ seed, filename }) => {
    console.log(`  - ${filename} (seed: ${seed})`);
  });
}

// Run the batch generation
batchGenerate();


/**
 * HOME Generator - Main Entry Point
 * Plotter-ready generative art system for archetypal houses
 */

import { UIController } from './ui/controller';

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const previewContainer = document.getElementById('preview-container');
  
  if (!previewContainer) {
    console.error('Preview container not found');
    return;
  }

  // Initialize UI controller
  const controller = new UIController(previewContainer);
  
  // Generate initial house
  controller.generate();
  
  console.log('HOME Generator initialized');
});

// Export main types and classes for programmatic use
export * from './config/types';
export * from './config/defaults';
export { HouseGenerator } from './generator/houseGenerator';
export { generateHomeSvg, downloadSvg, exportHome, svgToString } from './export/svgExporter';
export { SeededRNG } from './utils/rng';




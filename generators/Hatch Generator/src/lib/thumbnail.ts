/**
 * Thumbnail generation utilities
 * Converts SVG to a small thumbnail image (base64 data URL)
 */

import type { ProjectState } from '../types';
import { exportToSVG } from './svg-export';

const THUMBNAIL_SIZE = 200; // Width/height in pixels

/**
 * Generate a thumbnail image from a project state
 * Returns a base64 data URL (PNG)
 */
export async function generateThumbnail(state: ProjectState): Promise<string> {
  // Export to SVG (uses mm units, but browsers handle this fine via viewBox)
  const svgString = exportToSVG(state);
  
  // Convert mm units in width/height attributes to pixels for better image rendering
  // Extract dimensions from viewBox (which is in mm)
  const viewBoxMatch = svgString.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  if (!viewBoxMatch) {
    throw new Error('Could not parse SVG viewBox');
  }
  
  const widthMm = parseFloat(viewBoxMatch[1]);
  const heightMm = parseFloat(viewBoxMatch[2]);
  const aspectRatio = widthMm / heightMm;
  
  // Calculate thumbnail dimensions maintaining aspect ratio
  let thumbWidth = THUMBNAIL_SIZE;
  let thumbHeight = THUMBNAIL_SIZE;
  
  if (aspectRatio > 1) {
    thumbHeight = THUMBNAIL_SIZE / aspectRatio;
  } else {
    thumbWidth = THUMBNAIL_SIZE * aspectRatio;
  }
  
  // Replace mm units with pixel values for image rendering
  const svgForImage = svgString
    .replace(/width="[^"]*mm"/, `width="${thumbWidth}"`)
    .replace(/height="[^"]*mm"/, `height="${thumbHeight}"`);
  
  // Create an SVG blob URL
  const blob = new Blob([svgForImage], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  try {
    // Load SVG as an image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => {
        console.error('Error loading SVG for thumbnail:', e);
        reject(e);
      };
      img.src = url;
    });
    
    // Create a canvas and draw the image
    const canvas = document.createElement('canvas');
    canvas.width = THUMBNAIL_SIZE;
    canvas.height = THUMBNAIL_SIZE;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    // Fill with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    
    // Center the image
    const x = (THUMBNAIL_SIZE - thumbWidth) / 2;
    const y = (THUMBNAIL_SIZE - thumbHeight) / 2;
    
    // Draw the image
    ctx.drawImage(img, x, y, thumbWidth, thumbHeight);
    
    // Convert to base64 PNG
    const dataUrl = canvas.toDataURL('image/png');
    
    return dataUrl;
  } finally {
    // Clean up
    URL.revokeObjectURL(url);
  }
}



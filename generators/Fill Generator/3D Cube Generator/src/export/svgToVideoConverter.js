/* ============================================================
   SVG TO VIDEO CONVERTER
   Convert multiple SVG files into a video
============================================================ */

import { encodeVideo } from './videoExporter.js';

/**
 * Convert SVG file content to PNG image data with white background
 * @param {string} svgContent - SVG file content as string
 * @param {number} width - Target width in pixels
 * @param {number} height - Target height in pixels
 * @returns {Promise<Blob>} PNG image blob
 */
async function svgFileToPNG(svgContent, width, height) {
  return new Promise((resolve, reject) => {
    try {
      // Parse SVG string into DOM element
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = svgDoc.documentElement;
      
      // Check for parsing errors
      const parserError = svgDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('Failed to parse SVG: ' + parserError.textContent);
      }
      
      // Clone SVG to avoid modifying the original
      const svgClone = svgElement.cloneNode(true);
      
      // Set explicit dimensions
      svgClone.setAttribute('width', width);
      svgClone.setAttribute('height', height);
      
      // Ensure viewBox is set if not present
      if (!svgClone.getAttribute('viewBox')) {
        const existingWidth = svgClone.getAttribute('width') || width;
        const existingHeight = svgClone.getAttribute('height') || height;
        svgClone.setAttribute('viewBox', `0 0 ${existingWidth} ${existingHeight}`);
      }
      
      // Remove preview-only elements if any
      const previewElements = svgClone.querySelectorAll('[data-preview-only="true"]');
      previewElements.forEach(el => el.remove());
      
      // Serialize SVG to string
      const svgString = new XMLSerializer().serializeToString(svgClone);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      // Create image from SVG
      const img = new Image();
      img.onload = () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Draw white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // Draw SVG
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create PNG blob'));
          }
        }, 'image/png');
      };
      
      img.onerror = (error) => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG image: ' + error));
      };
      
      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get dimensions from SVG content
 * @param {string} svgContent - SVG file content as string
 * @returns {Object} {width, height} in pixels
 */
function getSVGDimensions(svgContent) {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
  const svgElement = svgDoc.documentElement;
  
  // Try to get width and height from attributes
  let width = svgElement.getAttribute('width');
  let height = svgElement.getAttribute('height');
  
  // If not found, try viewBox
  if (!width || !height) {
    const viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.split(/\s+/);
      if (parts.length >= 4) {
        width = parts[2];
        height = parts[3];
      }
    }
  }
  
  // Remove units and convert to number
  width = parseFloat(width) || 1000;
  height = parseFloat(height) || 1000;
  
  // If dimensions are in mm, convert to pixels (96 DPI: 1mm = 3.7795 pixels)
  // Check if original had 'mm' unit
  const originalWidth = svgElement.getAttribute('width') || '';
  const originalHeight = svgElement.getAttribute('height') || '';
  
  if (originalWidth.includes('mm')) {
    width = width * 3.7795;
  }
  if (originalHeight.includes('mm')) {
    height = height * 3.7795;
  }
  
  // Use high resolution for quality (at least 1920x1080 if smaller)
  const minWidth = 1920;
  const minHeight = 1080;
  
  if (width < minWidth || height < minHeight) {
    // Scale up while maintaining aspect ratio
    const scale = Math.max(minWidth / width, minHeight / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  
  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * Load SVG files from FileList or File array
 * @param {FileList|Array<File>} files - SVG files to load
 * @param {Function} progressCallback - Progress callback(message, percent)
 * @returns {Promise<Array<Blob>>} Array of PNG frame blobs
 */
async function loadAndConvertSVGFiles(files, progressCallback) {
  const frames = [];
  const fileArray = Array.from(files);
  
  // Sort files by name to ensure correct order
  fileArray.sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });
  
  console.log(`→ Loading ${fileArray.length} SVG files...`);
  
  // Load first file to determine dimensions
  const firstFile = fileArray[0];
  const firstContent = await firstFile.text();
  const dimensions = getSVGDimensions(firstContent);
  
  console.log(`  Using dimensions: ${dimensions.width}×${dimensions.height}px`);
  
  // Convert all files
  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    const percent = Math.round((i / fileArray.length) * 100);
    
    progressCallback(`Converting ${file.name} (${i + 1}/${fileArray.length})...`, percent);
    
    try {
      const svgContent = await file.text();
      const pngBlob = await svgFileToPNG(svgContent, dimensions.width, dimensions.height);
      frames.push(pngBlob);
      
      if ((i + 1) % 10 === 0 || i === 0 || i === fileArray.length - 1) {
        console.log(`  Frame ${i + 1}/${fileArray.length} converted (${(pngBlob.size / 1024).toFixed(1)}KB)`);
      }
    } catch (error) {
      console.error(`Failed to convert ${file.name}:`, error);
      throw new Error(`Failed to convert ${file.name}: ${error.message}`);
    }
  }
  
  console.log(`✓ All ${fileArray.length} frames converted (total: ${(frames.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)}MB)`);
  progressCallback(`All ${fileArray.length} frames converted`, 100);
  
  return frames;
}

/**
 * Download video file to user's Downloads folder
 * @param {Blob} videoBlob - Video blob to download
 * @param {string} filename - Optional custom filename
 */
function downloadVideo(videoBlob, filename = null) {
  if (!filename) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    filename = `svg_animation_${timestamp}.mp4`;
  }
  
  console.log(`→ Downloading video as: ${filename}`);
  
  const url = URL.createObjectURL(videoBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  
  console.log('✓ Download initiated');
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Main function to convert SVG files to video
 * @param {Object} options - Conversion options
 * @param {FileList|Array<File>} options.files - SVG files to convert
 * @param {number} options.duration - Video duration in seconds (default: 5)
 * @param {Function} options.onProgress - Progress callback(message, percent)
 * @param {Function} options.onComplete - Completion callback
 * @param {Function} options.onError - Error callback(error)
 */
export async function convertSVGFilesToVideo(options) {
  const {
    files,
    duration = 5,
    onProgress,
    onComplete,
    onError
  } = options;
  
  if (!files || files.length === 0) {
    throw new Error('No SVG files provided');
  }
  
  const frameCount = files.length;
  const fps = frameCount / duration; // Calculate FPS automatically
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('🎬 SVG TO VIDEO CONVERSION STARTED');
  console.log(`Parameters: ${frameCount} frames @ ${fps.toFixed(2)}fps`);
  console.log(`Expected duration: ${duration}s`);
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    // Phase 1: Load and convert SVG files to PNG frames (0-70% of total progress)
    console.log('\n[PHASE 1/2] Converting SVG files to PNG frames');
    const startTime = performance.now();
    const frames = await loadAndConvertSVGFiles(
      files,
      (msg, percent) => {
        // Map conversion progress (0-100%) to overall progress (0-70%)
        const overallPercent = percent !== undefined ? (percent * 0.7) : undefined;
        onProgress(msg, overallPercent);
      }
    );
    const convertTime = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log(`✓ Phase 1 completed in ${convertTime}s\n`);
    
    // Phase 2: Encode video (70-100% of total progress)
    console.log('[PHASE 2/2] Video Encoding');
    const encodeStart = performance.now();
    const videoBlob = await encodeVideo(
      frames,
      fps,
      (msg, percent) => {
        // Map encoding progress (0-100%) to overall progress (70-100%)
        const overallPercent = percent !== undefined ? (70 + percent * 0.3) : undefined;
        onProgress(msg, overallPercent);
      }
    );
    const encodeTime = ((performance.now() - encodeStart) / 1000).toFixed(1);
    console.log(`✓ Phase 2 completed in ${encodeTime}s\n`);
    
    // Download video
    downloadVideo(videoBlob);
    
    // Complete
    const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🎉 VIDEO CONVERSION COMPLETED in ${totalTime}s`);
    console.log(`Final video: ${(videoBlob.size / 1024 / 1024).toFixed(2)}MB`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    onComplete();
    
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════');
    console.error('❌ VIDEO CONVERSION FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('═══════════════════════════════════════════════════════\n');
    
    onError(error);
  }
}

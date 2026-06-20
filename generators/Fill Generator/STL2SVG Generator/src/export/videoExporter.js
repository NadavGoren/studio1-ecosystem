/* ============================================================
   VIDEO EXPORTER
   Generate turntable animation video using FFmpeg.wasm
============================================================ */

import { draw, getCanvasDimensions } from '../rendering/renderer.js';
import { setupCollapsibleSections } from '../ui/updates.js';

// FFmpeg instance (lazy-loaded)
let ffmpeg = null;
let ffmpegLoaded = false;

// Global flag to prevent animation preview from running during video generation
// Use window object so it can be checked synchronously from animation loop
window.__isGeneratingVideo = false;
let isGeneratingVideo = false; // Also keep local reference

/**
 * Check browser compatibility
 */
function checkBrowserCompatibility() {
  const issues = [];
  const warnings = [];
  
  // Check for SharedArrayBuffer (improves performance but not strictly required)
  // Note: FFmpeg.wasm v0.10 should work without it, but some configurations may require it
  if (typeof SharedArrayBuffer === 'undefined') {
    warnings.push('SharedArrayBuffer not available - video generation will be slower');
    warnings.push('To enable faster processing, use the included server.py script');
    warnings.push('Make sure to RESTART the server and HARD REFRESH the browser after starting');
  }
  
  // Check for ES6 module support (required)
  if (typeof Symbol === 'undefined') {
    issues.push('ES6 modules not supported - please use a modern browser');
  }
  
  // Check for fetch API (required)
  if (typeof fetch === 'undefined') {
    issues.push('Fetch API not supported - please use a modern browser');
  }
  
  // Check for WebAssembly (required)
  if (typeof WebAssembly === 'undefined') {
    issues.push('WebAssembly not supported - please use a modern browser');
  }
  
  return {
    compatible: issues.length === 0,
    issues: issues,
    warnings: warnings,
    hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined'
  };
}

/**
 * Load FFmpeg.wasm library from CDN
 * Uses jsdelivr CDN which has better CORS support
 */
async function loadFFmpeg(progressCallback) {
  if (ffmpegLoaded && ffmpeg) {
    console.log('✓ FFmpeg already loaded, reusing instance');
    progressCallback('FFmpeg already loaded');
    return { ffmpeg };
  }

  try {
    console.log('→ Starting FFmpeg load from CDN...');
    progressCallback('Loading FFmpeg library from CDN...');
    
    // Load FFmpeg.wasm using UMD bundle via script tag (most reliable method)
    progressCallback('Loading FFmpeg library...');
    
    // Check if already loaded globally
    if (window.FFmpeg && window.FFmpeg.createFFmpeg) {
      console.log('✓ FFmpeg library already in window, creating instance...');
      const { createFFmpeg } = window.FFmpeg;
      
      // Configure FFmpeg - work without SharedArrayBuffer if needed
      const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
      console.log(`  SharedArrayBuffer available: ${hasSharedArrayBuffer}`);
      
      ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js',
        // Don't require SharedArrayBuffer - will use single-threaded mode
      });
      console.log('✓ FFmpeg instance created');
    } else {
      // Load the UMD bundle dynamically
      console.log('→ Loading FFmpeg UMD bundle from unpkg.com...');
      console.log('  Note: If this fails, CDN resources may be blocked by COEP policy');
      
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.10.1/dist/ffmpeg.min.js';
        script.crossOrigin = 'anonymous'; // Help with CORS
        script.onload = () => {
          console.log('✓ FFmpeg script loaded, window.FFmpeg:', window.FFmpeg);
          resolve();
        };
        script.onerror = (error) => {
          console.error('✗ Failed to load FFmpeg from CDN:', error);
          reject(new Error(
            'Failed to load FFmpeg script from CDN. ' +
            'This may be because Cross-Origin-Embedder-Policy is blocking cross-origin resources. ' +
            'Check browser console for more details.'
          ));
        };
        // Set timeout to detect if script never loads
        setTimeout(() => {
          if (!window.FFmpeg) {
            reject(new Error('FFmpeg script load timeout - CDN may be blocked by COEP policy'));
          }
        }, 30000); // 30 second timeout
        document.head.appendChild(script);
      });
      
      // Now it should be available globally
      if (!window.FFmpeg || !window.FFmpeg.createFFmpeg) {
        throw new Error('FFmpeg library failed to load properly - window.FFmpeg not found');
      }
      
      console.log('✓ Creating FFmpeg instance...');
      const { createFFmpeg } = window.FFmpeg;
      
      // Configure FFmpeg - work without SharedArrayBuffer if needed
      const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
      console.log(`  SharedArrayBuffer available: ${hasSharedArrayBuffer}`);
      
      ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js',
        // Don't require SharedArrayBuffer - will use single-threaded mode
      });
      console.log('✓ FFmpeg instance created');
    }
    
    progressCallback('Loading FFmpeg core (~20MB)...');
    console.log('→ Loading FFmpeg core (this takes ~20-30 seconds)...');
    
    await ffmpeg.load();
    
    ffmpegLoaded = true;
    console.log('✓ FFmpeg core loaded successfully!');
    progressCallback('FFmpeg loaded successfully!');
    
    return { ffmpeg };
  } catch (error) {
    console.error('Failed to load FFmpeg:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Check if it's a SharedArrayBuffer error
    // NOTE: FFmpeg.wasm v0.10 SHOULD work without SharedArrayBuffer (single-threaded mode)
    // If we're getting this error, it might be from FFmpeg itself checking during init
    if (error.message.includes('SharedArrayBuffer') || 
        (typeof SharedArrayBuffer === 'undefined' && error.message.includes('undefined'))) {
      
      console.warn('⚠ SharedArrayBuffer not available');
      console.warn('⚠ FFmpeg.wasm should work in single-threaded mode, but initialization failed');
      console.warn('⚠ This suggests the error is coming from FFmpeg itself, not our code');
      
      // Provide troubleshooting but also suggest it might be an FFmpeg limitation
      throw new Error(
        `SharedArrayBuffer is not available, and FFmpeg initialization failed.\n\n` +
        `TROUBLESHOOTING (try these in order):\n\n` +
        `1. Verify server is running: python3 server.py\n` +
        `2. RESTART the server (Ctrl+C, then start again)\n` +
        `3. HARD REFRESH browser: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)\n` +
        `4. Check headers: Open http://localhost:8001/check-headers.html\n` +
        `5. Test SharedArrayBuffer: Open http://localhost:8001/test-sharedarraybuffer.html\n\n` +
        `If SharedArrayBuffer is still not available:\n` +
        `- The server headers may not be applying (check check-headers.html)\n` +
        `- Try a different browser (Chrome/Edge work best)\n` +
        `- Check browser console (F12) for blocked resource errors\n\n` +
        `Note: FFmpeg.wasm may require SharedArrayBuffer in some configurations.\n` +
        `If headers are correct but it still fails, this may be an FFmpeg limitation.`
      );
    }
    
    // Provide helpful error message for other issues
    let errorMessage = `FFmpeg loading failed: ${error.message}`;
    
    if (error.message.includes('fetch') || error.message.includes('network')) {
      errorMessage = `FFmpeg loading failed: ${error.message}\n\n` +
        `Please check your internet connection and try again.`;
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Convert SVG element to PNG image data
 * @param {SVGElement} svgElement - The SVG to convert
 * @param {number} width - Target width in pixels
 * @param {number} height - Target height in pixels
 * @returns {Promise<Blob>} PNG image blob
 */
async function svgToPNG(svgElement, width, height) {
  return new Promise((resolve, reject) => {
    try {
      // Clone SVG to avoid modifying the original
      const svgClone = svgElement.cloneNode(true);
      
      // Set explicit dimensions
      svgClone.setAttribute('width', width);
      svgClone.setAttribute('height', height);
      
      // Remove preview-only elements
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
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG image'));
      };
      
      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate animation frames
 * @param {number} startAngle - Starting rotation angle (degrees)
 * @param {number} endAngle - Ending rotation angle (degrees)
 * @param {number} frameCount - Number of frames to generate
 * @param {Function} progressCallback - Progress callback(message, percent)
 * @returns {Promise<Array<Blob>>} Array of PNG frame blobs
 */
async function generateFrames(startAngle, endAngle, frameCount, progressCallback) {
  console.log(`→ Starting frame generation: ${frameCount} frames from ${startAngle}° to ${endAngle}°`);
  const frames = [];
  const { width: canvasWidthMM, height: canvasHeightMM } = getCanvasDimensions();
  
  // Convert mm to pixels (use high resolution for quality)
  // Assume 96 DPI: 1mm = 3.7795 pixels
  const MM_TO_PX = 3.7795;
  const width = Math.round(canvasWidthMM * MM_TO_PX);
  const height = Math.round(canvasHeightMM * MM_TO_PX);
  
  console.log(`  Canvas size: ${canvasWidthMM}×${canvasHeightMM}mm = ${width}×${height}px`);
  
  const svgElement = document.getElementById('svg');
  if (!svgElement) {
    throw new Error('SVG element not found - cannot generate frames');
  }
  
  // Import functions once at the start (more efficient than importing in loop)
  let stopAnimationPreview = null;
  let setOrbitHorizontal = null;
  try {
    const animationModule = await import('../../3d-generator.js');
    stopAnimationPreview = animationModule.stopAnimationPreview;
  } catch (e) {
    console.warn('⚠ Could not import stopAnimationPreview:', e);
  }
  
  try {
    const controlsModule = await import('../ui/controls.js');
    setOrbitHorizontal = controlsModule.setOrbitHorizontal;
  } catch (e) {
    console.warn('⚠ Could not import setOrbitHorizontal:', e);
  }
  
  // Calculate angle step
  const angleRange = endAngle - startAngle;
  const angleStep = angleRange / (frameCount - 1);
  
  // CRITICAL: Ensure animation preview stays stopped during frame generation
  // Stop it at the start of frame generation to be absolutely sure
  if (stopAnimationPreview) {
    stopAnimationPreview();
  }
  
  for (let i = 0; i < frameCount; i++) {
    // Check for cancellation
    if (videoGenerationCancelled) {
      throw new Error('Video generation cancelled by user');
    }
    
    // Double-check animation is stopped every 10 frames (prevent it from restarting)
    if (i % 10 === 0 && stopAnimationPreview) {
      stopAnimationPreview();
    }
    
    const angle = startAngle + (i * angleStep);
    const percent = Math.round((i / frameCount) * 100);
    
    progressCallback(`Generating frame ${i + 1}/${frameCount}...`, percent);
    
    // CRITICAL: Ensure we're at the exact angle before rendering
    // Set the orbit state first to ensure consistency
    if (setOrbitHorizontal) {
      setOrbitHorizontal(angle);
    }
    
    // Render frame at this angle
    draw(angle);
    
    // Wait for render to complete using requestAnimationFrame
    // This ensures the browser has actually rendered the frame before we capture it
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve)); // Double frame to ensure completion
    
    // Small additional delay to ensure SVG is fully updated
    await new Promise(resolve => setTimeout(resolve, 16)); // ~1 frame at 60fps
    
    // Check again after delay
    if (videoGenerationCancelled) {
      throw new Error('Video generation cancelled by user');
    }
    
    // Convert to PNG - the SVG should now be fully rendered at the correct angle
    const pngBlob = await svgToPNG(svgElement, width, height);
    frames.push(pngBlob);
    
    // Log progress every 10 frames
    if ((i + 1) % 10 === 0 || i === 0 || i === frameCount - 1) {
      console.log(`  Frame ${i + 1}/${frameCount} generated (${angle.toFixed(1)}°, ${(pngBlob.size / 1024).toFixed(1)}KB)`);
    }
  }
  
  console.log(`✓ All ${frameCount} frames generated (total: ${(frames.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)}MB)`);
  progressCallback(`All ${frameCount} frames generated`, 100);
  return frames;
}

/**
 * Encode frames into video using FFmpeg
 * @param {Array<Blob>} frames - Array of PNG frame blobs
 * @param {number} fps - Frames per second
 * @param {Function} progressCallback - Progress callback(message, percent)
 * @returns {Promise<Blob>} Video blob
 */
async function encodeVideo(frames, fps, progressCallback) {
  console.log(`→ Starting video encoding: ${frames.length} frames @ ${fps}fps`);
  progressCallback('Initializing video encoder...', 0);
  
  let ffmpegLoadProgress = 0;
  const { ffmpeg: ffmpegInstance } = await loadFFmpeg((msg) => {
    // FFmpeg loading is about 0-10% of encoding phase
    // Map load messages to 0-10% range
    if (msg.includes('core') || msg.includes('loading')) {
      ffmpegLoadProgress = Math.min(9, ffmpegLoadProgress + 2);
    } else if (msg.includes('loaded') || msg.includes('ready')) {
      ffmpegLoadProgress = 10;
    }
    progressCallback(msg, ffmpegLoadProgress);
  });
  
  if (!ffmpegInstance) {
    throw new Error('FFmpeg instance is null after loading');
  }
  console.log('✓ FFmpeg instance ready for encoding');
  progressCallback('FFmpeg ready', 10);
  
  progressCallback('Writing frames to FFmpeg...', 10);
  console.log(`→ Writing ${frames.length} frames to FFmpeg virtual filesystem...`);
  
  // Write all frames to FFmpeg virtual filesystem (FFmpeg.wasm v0.10 API)
  // Writing frames is 10-40% of encoding phase
  for (let i = 0; i < frames.length; i++) {
    // Check for cancellation
    if (videoGenerationCancelled) {
      throw new Error('Video generation cancelled by user');
    }
    
    const filename = `frame_${String(i).padStart(4, '0')}.png`;
    try {
      const arrayBuffer = await frames[i].arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Verify frame data is not empty
      if (uint8Array.length === 0) {
        throw new Error(`Frame ${i + 1} is empty (0 bytes)`);
      }
      
      ffmpegInstance.FS('writeFile', filename, uint8Array);
      
      // Verify it was written
      const written = ffmpegInstance.FS('readFile', filename);
      if (written.length !== uint8Array.length) {
        throw new Error(`Frame ${i + 1} write verification failed: expected ${uint8Array.length} bytes, got ${written.length}`);
      }
      
      // Progress from 10% to 40% during frame writing
      const writeProgress = 10 + (i / frames.length) * 30;
      if (i % 10 === 0 || i === 0 || i === frames.length - 1) {
        progressCallback(`Writing frames: ${i + 1}/${frames.length}`, writeProgress);
        console.log(`  Written ${i + 1}/${frames.length} frames to FFmpeg FS (${(uint8Array.length / 1024).toFixed(1)}KB each)`);
      }
    } catch (error) {
      if (videoGenerationCancelled) {
        throw new Error('Video generation cancelled by user');
      }
      console.error(`Failed to write frame ${i}:`, error);
      throw new Error(`Failed to write frame ${i + 1} to FFmpeg filesystem: ${error.message}`);
    }
  }
  
  console.log(`✓ All ${frames.length} frames written to FFmpeg filesystem`);
  progressCallback('Encoding video... (this may take a minute)', 40);
  console.log('→ Running FFmpeg encoding (H.264, CRF 23)...');
  
  // Verify frames are actually in the filesystem and are valid PNGs
  console.log('→ Verifying frames in FFmpeg filesystem...');
  try {
    const testFrame = ffmpegInstance.FS('readFile', 'frame_0000.png');
    console.log(`✓ Verified first frame exists: ${testFrame.length} bytes`);
    
    // Verify it's a valid PNG (check PNG signature)
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    const firstBytes = Array.from(testFrame.slice(0, 8));
    const isValidPNG = pngSignature.every((byte, i) => firstBytes[i] === byte);
    
    if (!isValidPNG) {
      console.error('✗ First frame is NOT a valid PNG file!');
      console.error('First 8 bytes (hex):', firstBytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      console.error('Expected PNG signature:', pngSignature.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      throw new Error('Frame files are not valid PNG images. SVG to PNG conversion may have failed.');
    }
    console.log('✓ First frame is a valid PNG file');
    
    // Check a few more frames to be sure
    const midFrame = ffmpegInstance.FS('readFile', `frame_${String(Math.floor(frames.length / 2)).padStart(4, '0')}.png`);
    const lastFrame = ffmpegInstance.FS('readFile', `frame_${String(frames.length - 1).padStart(4, '0')}.png`);
    console.log(`✓ Verified mid frame (${Math.floor(frames.length / 2)}): ${midFrame.length} bytes`);
    console.log(`✓ Verified last frame (${frames.length - 1}): ${lastFrame.length} bytes`);
  } catch (e) {
    console.error('✗ Frame verification failed:', e);
    throw new Error(`Frame verification failed: ${e.message}`);
  }
  
  // Run FFmpeg encoding (FFmpeg.wasm v0.10 API)
  // Using settings optimized for QuickTime/Quick Look compatibility on macOS
  try {
    // Set up FFmpeg logging to catch any errors
    ffmpegInstance.setLogging(true);
    
    console.log('→ Starting FFmpeg encoding with parameters:');
    console.log(`  Input: frame_%04d.png (${frames.length} frames)`);
    console.log(`  Framerate: ${fps}`);
    console.log(`  Output: output.mp4`);
    
    // Try different FFmpeg command formats
    // Issue: FFmpeg completes but produces 0-byte file
    // This suggests the command syntax might be wrong for FFmpeg.wasm
    
    console.log('→ Starting FFmpeg encoding...');
    console.log(`  Input pattern: frame_%04d.png`);
    console.log(`  Frame count: ${frames.length}`);
    console.log(`  Framerate: ${fps} fps`);
    
    // Try with explicit start number and frame count
    // FFmpeg.wasm might need different syntax
    const ffmpegArgs = [
      '-framerate', String(fps),
      '-start_number', '0',
      '-i', 'frame_%04d.png',
      '-frames:v', String(frames.length),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-vf', `scale=trunc(iw/2)*2:trunc(ih/2)*2`, // Ensure even dimensions for H.264
      '-y',
      'output.mp4'
    ];
    
    console.log('FFmpeg command:', ffmpegArgs.join(' '));
    console.log('→ Executing FFmpeg (this may take 30-60 seconds)...');
    
    // Capture any FFmpeg output
    let ffmpegCompleted = false;
    let ffmpegError = null;
    
    // Run FFmpeg
    try {
      await ffmpegInstance.run(...ffmpegArgs);
      ffmpegCompleted = true;
      console.log('✓ FFmpeg run() completed without error');
    } catch (runError) {
      ffmpegError = runError;
      console.error('✗ FFmpeg run() threw error:', runError);
      console.error('Error message:', runError.message);
    }
    
    // Wait a bit for file to be fully written
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if output file exists and has content
    const files = ffmpegInstance.FS('readdir', '/');
    console.log('Files after encoding:', files.filter(f => f.includes('frame_') || f.includes('output')));
    
    if (!files.includes('output.mp4')) {
      throw new Error('FFmpeg did not create output.mp4 file');
    }
    
    const outputFile = ffmpegInstance.FS('readFile', 'output.mp4');
    console.log(`Output file size: ${outputFile.length} bytes`);
    
    if (outputFile.length === 0) {
      console.error('✗ Output file is 0 bytes - FFmpeg encoding failed silently');
      console.error('This usually means:');
      console.error('  1. FFmpeg command syntax issue');
      console.error('  2. Input frames are invalid');
      console.error('  3. FFmpeg.wasm version compatibility issue');
      throw new Error('FFmpeg completed but output file is 0 bytes. Encoding failed silently.');
    }
    
    console.log('✓ FFmpeg encoding completed successfully');
    progressCallback('Video encoding complete', 90);
    
    console.log('✓ FFmpeg encoding command completed');
  } catch (error) {
    console.error('FFmpeg encoding failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Try to get more info about what went wrong
    try {
      const files = ffmpegInstance.FS('readdir', '/');
      console.log('Files in FFmpeg filesystem after error:', files);
    } catch (e) {
      console.error('Could not list files:', e);
    }
    
    throw new Error(`Video encoding failed: ${error.message}. Check browser console for details.`);
  }
  
  console.log('✓ FFmpeg encoding completed');
  progressCallback('Reading encoded video...', 90);
  
  // Read the output file (FFmpeg.wasm v0.10 API)
  console.log('→ Reading output.mp4 from FFmpeg filesystem...');
  let data;
  
  // List all files first to see what FFmpeg created
  try {
    const files = ffmpegInstance.FS('readdir', '/');
    console.log('Files in FFmpeg filesystem after encoding:', files);
    
    // Check if output.mp4 exists
    if (!files.includes('output.mp4')) {
      console.error('✗ output.mp4 not found in filesystem!');
      console.error('Available files:', files.filter(f => !f.startsWith('.')));
      throw new Error('Output video file (output.mp4) was not created by FFmpeg. Check FFmpeg logs above for errors.');
    }
  } catch (e) {
    console.error('Could not list FFmpeg filesystem:', e);
  }
  
  try {
    // Check if file exists and get its size
    try {
      const stat = ffmpegInstance.FS('stat', 'output.mp4');
      console.log('Output file stats:', stat);
      if (stat.size === 0) {
        throw new Error('Output file exists but is 0 bytes - encoding failed');
      }
      console.log(`Output file size: ${stat.size} bytes (${(stat.size / 1024 / 1024).toFixed(2)}MB)`);
    } catch (e) {
      if (e.message.includes('0 bytes')) {
        throw e;
      }
      console.warn('Could not stat output file, but will try to read it:', e.message);
    }
    
    // Read the file
    data = ffmpegInstance.FS('readFile', 'output.mp4');
    
    // data is a Uint8Array in FFmpeg.wasm v0.10
    if (!data || data.length === 0) {
      throw new Error('Output video file is empty (0 bytes) - encoding may have failed. Check browser console for FFmpeg errors.');
    }
    
    console.log(`✓ Video file read: ${(data.length / 1024 / 1024).toFixed(2)}MB (${data.length} bytes)`);
    
    // Validate minimum size - even a 1-frame video should be at least a few KB
    if (data.length < 1000) {
      console.error('⚠ ERROR: Video file is suspiciously small (' + data.length + ' bytes)');
      console.error('This usually means encoding failed. Check FFmpeg logs above.');
      
      // Try to see if there's any content
      const firstBytes = Array.from(data.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.error('First 20 bytes (hex):', firstBytes);
      
      // MP4 files should start with specific bytes (ftyp box)
      if (!firstBytes.includes('66747970') && !firstBytes.includes('00 00 00')) {
        console.error('File does not appear to be a valid MP4 (should start with ftyp box)');
      }
      
      throw new Error(`Video file is too small (${data.length} bytes). Encoding likely failed. Check browser console for FFmpeg error messages.`);
    }
  } catch (error) {
    console.error('Failed to read output video:', error);
    
    // Try to list files in FFmpeg filesystem to debug
    try {
      const files = ffmpegInstance.FS('readdir', '/');
      console.log('Files in FFmpeg filesystem on error:', files);
    } catch (e) {
      console.error('Could not list FFmpeg filesystem:', e);
    }
    
    throw new Error(`Failed to read encoded video: ${error.message}`);
  }
  
  // Validate video file size before proceeding
  if (!data || data.length === 0) {
    throw new Error('Video encoding produced an empty file. Check browser console for FFmpeg errors.');
  }
  
  // Minimum expected size for a valid MP4 (should be at least a few KB)
  if (data.length < 1000) {
    console.error('Video file is suspiciously small:', data.length, 'bytes');
    throw new Error(`Video file is too small (${data.length} bytes). Encoding likely failed. Check browser console for FFmpeg errors.`);
  }
  
  // Convert to blob first (before cleanup, in case cleanup fails)
  // data is a Uint8Array in FFmpeg.wasm v0.10
  let videoBlob;
  try {
    videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
    
    if (videoBlob.size === 0) {
      throw new Error('Video blob is empty');
    }
    
    console.log(`✓ Video blob created: ${(videoBlob.size / 1024 / 1024).toFixed(2)}MB`);
  } catch (error) {
    console.error('Failed to create video blob:', error);
    throw new Error(`Failed to create video blob: ${error.message}`);
  }
  
  // Clean up FFmpeg filesystem
  progressCallback('Cleaning up...', 95);
  console.log('→ Cleaning up FFmpeg filesystem...');
  let cleanupErrors = 0;
  for (let i = 0; i < frames.length; i++) {
    const filename = `frame_${String(i).padStart(4, '0')}.png`;
    try {
      ffmpegInstance.FS('unlink', filename);
    } catch (e) {
      cleanupErrors++;
      // Ignore errors on cleanup (file might not exist)
    }
  }
  
  try {
    ffmpegInstance.FS('unlink', 'output.mp4');
  } catch (e) {
    // Ignore (file might not exist)
  }
  
  if (cleanupErrors > 0) {
    console.warn(`⚠ ${cleanupErrors} files could not be cleaned up (this is usually OK)`);
  }
  console.log('✓ Cleanup completed');
  
  progressCallback('Video encoded successfully!', 100);
  return videoBlob;
}

/**
 * Download video file to user's Downloads folder
 * @param {Blob} videoBlob - Video blob to download
 */
function downloadVideo(videoBlob) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `cube_turntable_${timestamp}.mp4`;
  
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
 * Main function to generate turntable animation video
 * @param {Object} options - Animation options
 * @param {number} options.startAngle - Start angle in degrees
 * @param {number} options.endAngle - End angle in degrees
 * @param {number} options.frameCount - Number of frames
 * @param {number} options.fps - Frames per second
 * @param {Function} options.onProgress - Progress callback(message, percent)
 * @param {Function} options.onComplete - Completion callback
 * @param {Function} options.onError - Error callback(error)
 */
export async function generateTurntableVideo(options) {
  const {
    startAngle,
    endAngle,
    frameCount,
    fps,
    onProgress,
    onComplete,
    onError,
    signal
  } = options;
  
  // Check for cancellation before starting
  if (videoGenerationCancelled || signal?.aborted) {
    throw new Error('Video generation cancelled by user');
  }
  
  // CRITICAL: Set global flag to prevent animation preview from starting
  isGeneratingVideo = true;
  window.__isGeneratingVideo = true; // Set on window for synchronous access
  
  // Disable the play preview button to prevent user from starting animation
  try {
    const playBtn = document.getElementById('playPreview');
    if (playBtn) {
      playBtn.disabled = true;
      playBtn.style.opacity = '0.5';
      playBtn.style.cursor = 'not-allowed';
    }
  } catch (e) {
    console.warn('⚠ Could not disable play button:', e);
  }
  
  // CRITICAL: Ensure animation preview is stopped and stays stopped
  // Do this at the start of video generation, not just when button is clicked
  try {
    const { stopAnimationPreview } = await import('../../3d-generator.js');
    stopAnimationPreview();
    // Wait multiple frames to ensure it's fully stopped
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (e) {
    console.warn('⚠ Could not stop animation preview at start:', e);
  }
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('🎬 TURNTABLE VIDEO GENERATION STARTED');
  console.log(`Parameters: ${startAngle}° → ${endAngle}° | ${frameCount} frames @ ${fps}fps`);
  console.log(`Expected duration: ${(frameCount / fps).toFixed(1)}s`);
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    // Generate frames (maps to 0-70% of total progress)
    console.log('\n[PHASE 1/3] Frame Generation');
    const startTime = performance.now();
    const frames = await generateFrames(
      startAngle,
      endAngle,
      frameCount,
      (msg, percent) => {
        // Map frame generation progress (0-100%) to overall progress (0-70%)
        const overallPercent = percent !== undefined ? (percent * 0.7) : undefined;
        onProgress(msg, overallPercent);
      }
    );
    const frameTime = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log(`✓ Phase 1 completed in ${frameTime}s\n`);
    
    // Encode video (maps to 70-100% of total progress)
    console.log('[PHASE 2/3] Video Encoding');
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
    console.log('[PHASE 3/3] Download');
    downloadVideo(videoBlob);
    console.log('✓ Phase 3 completed\n');
    
    // Complete
    const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🎉 VIDEO GENERATION COMPLETED in ${totalTime}s`);
    console.log(`Final video: ${(videoBlob.size / 1024 / 1024).toFixed(2)}MB`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Re-enable play button and clear generation flag
    isGeneratingVideo = false;
    window.__isGeneratingVideo = false;
    try {
      const playBtn = document.getElementById('playPreview');
      if (playBtn) {
        playBtn.disabled = false;
        playBtn.style.opacity = '';
        playBtn.style.cursor = '';
      }
    } catch (e) {
      console.warn('⚠ Could not re-enable play button:', e);
    }
    
    onComplete();
    
  } catch (error) {
    // Check if error is due to cancellation
    if (videoGenerationCancelled || error.message.includes('cancelled')) {
      console.log('Video generation cancelled by user');
      onError(new Error('Video generation cancelled by user'));
      return;
    }
    
    console.error('═══════════════════════════════════════════════════════');
    console.error('❌ VIDEO GENERATION FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('═══════════════════════════════════════════════════════\n');
    
    // Re-enable play button and clear generation flag even on error
    isGeneratingVideo = false;
    window.__isGeneratingVideo = false;
    try {
      const playBtn = document.getElementById('playPreview');
      if (playBtn) {
        playBtn.disabled = false;
        playBtn.style.opacity = '';
        playBtn.style.cursor = '';
      }
    } catch (e) {
      console.warn('⚠ Could not re-enable play button:', e);
    }
    
    onError(error);
  }
}

// Export the flag so animation preview can check it
export { isGeneratingVideo };

// Global cancellation flag for video generation
let videoGenerationCancelled = false;
let currentGenerationAbortController = null;

/**
 * Clean up modal and restore all UI interactions
 * This ensures the modal doesn't block clicks on collapsible sections
 */
function cleanupModal(modal, generateBtn) {
  if (modal) {
    // Hide modal completely - use multiple methods to ensure it's truly hidden
    modal.classList.add('hidden');
    
    // Set all blocking properties to ensure modal is completely out of the way
    // Use setProperty with important to override any other styles
    modal.style.setProperty('display', 'none', 'important');
    modal.style.setProperty('pointer-events', 'none', 'important');
    modal.style.setProperty('visibility', 'hidden', 'important');
    modal.style.setProperty('opacity', '0', 'important');
    modal.style.setProperty('z-index', '-1', 'important');
    modal.style.setProperty('position', 'fixed', 'important');
    
    // Also clean up modal content
    const modalContent = modal.querySelector('.video-export-modal-content');
    if (modalContent) {
      modalContent.style.setProperty('pointer-events', 'none', 'important');
      modalContent.style.setProperty('display', 'none', 'important');
    }
    
    // CRITICAL: Remove modal from tab order and accessibility tree
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('tabindex', '-1');
    
    // Force a repaint to ensure the modal is truly out of the way
    void modal.offsetHeight; // Trigger reflow
    
    // Double-check: ensure modal is not blocking by checking computed styles
    const computedStyle = window.getComputedStyle(modal);
    if (computedStyle.display !== 'none') {
      console.warn('⚠ Modal display is not none after cleanup, computed:', computedStyle.display);
      // Try one more time with even more force
      modal.style.cssText = 'display: none !important; pointer-events: none !important; visibility: hidden !important; opacity: 0 !important; z-index: -1 !important; position: fixed !important;';
    } else {
      console.log('✓ Modal is properly hidden (display: none)');
    }
    
    // Final verification: test if modal would block a click at (0,0)
    // If display is none, it shouldn't block anything
    const rect = modal.getBoundingClientRect();
    console.log('✓ Modal bounding rect after cleanup:', {
      width: rect.width,
      height: rect.height,
      display: computedStyle.display,
      pointerEvents: computedStyle.pointerEvents
    });
  }
  
  // Re-enable generate button
  if (generateBtn) {
    generateBtn.disabled = false;
  }
  
  // Remove any inline pointer-events styles from body
  document.body.style.removeProperty('pointer-events');
  
  // Remove any inline pointer-events from controls sidebar
  const controls = document.getElementById('controls');
  if (controls) {
    controls.style.removeProperty('pointer-events');
  }
  
  // Remove any inline pointer-events from ALL collapsible section headers
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.style.removeProperty('pointer-events');
    // Ensure cursor is still pointer
    header.style.cursor = 'pointer';
  });
  
  // Remove any inline pointer-events from all sections
  document.querySelectorAll('.collapsible-section').forEach(section => {
    section.style.removeProperty('pointer-events');
  });
  
  // Verify event listeners are still attached by testing one
  const animationHeader = document.querySelector('[data-section="animation"]');
  if (animationHeader) {
    // Check if click event listener exists by checking if it responds
    // We can't directly check, but we can ensure the element is clickable
    animationHeader.style.removeProperty('pointer-events');
    animationHeader.style.cursor = 'pointer';
    
    // Log for debugging
    console.log('✓ Animation header cleaned up:', {
      hasHiddenClass: modal?.classList.contains('hidden'),
      headerPointerEvents: window.getComputedStyle(animationHeader).pointerEvents,
      headerDisplay: window.getComputedStyle(animationHeader).display
    });
  }
  
  // Re-attach event listeners to collapsible sections WITHOUT changing their state
  // This is critical - we must preserve the current collapsed/expanded state
  try {
    // Re-setup collapsible sections but preserve their current state
    setupCollapsibleSections(true); // true = preserve state
    
    // Ensure all headers are clickable
    document.querySelectorAll('.collapsible-header').forEach(header => {
      header.style.removeProperty('pointer-events');
      header.style.cursor = 'pointer';
      
      const section = header.closest('.collapsible-section');
      if (section) {
        section.style.removeProperty('pointer-events');
        const sectionBody = section.querySelector('.section-body');
        if (sectionBody) {
          sectionBody.style.removeProperty('pointer-events');
        }
      }
    });
    
    // Test that the animation header is actually clickable
    const animationHeader = document.querySelector('[data-section="animation"]');
    if (animationHeader) {
      const computedStyle = window.getComputedStyle(animationHeader);
      const section = animationHeader.closest('.collapsible-section');
      const modalComputed = modal ? window.getComputedStyle(modal) : null;
      
      // Add a test click handler to verify clicks are received
      const testClickHandler = (e) => {
        console.log('✓ TEST: Animation header received click!', {
          target: e.target,
          currentTarget: e.currentTarget,
          sectionCollapsed: section?.classList.contains('collapsed')
        });
      };
      animationHeader.addEventListener('click', testClickHandler, { once: true });
      
      console.log('✓ Animation section state after cleanup:', {
        headerPointerEvents: computedStyle.pointerEvents,
        headerDisplay: computedStyle.display,
        headerCursor: computedStyle.cursor,
        headerZIndex: computedStyle.zIndex,
        sectionHasCollapsed: section?.classList.contains('collapsed'),
        modalHidden: modal?.classList.contains('hidden'),
        modalDisplay: modalComputed?.display,
        modalZIndex: modalComputed?.zIndex,
        modalPointerEvents: modalComputed?.pointerEvents,
        modalVisibility: modalComputed?.visibility
      });
    }
    
    console.log('✓ Collapsible sections re-setup complete (state preserved)');
  } catch (error) {
    console.error('✗ Failed to re-setup collapsible sections:', error);
  }
  
  console.log('✓ Modal cleanup complete - all UI interactions restored');
}

/**
 * Setup video export button and controls
 */
export function setupVideoExporter() {
  const generateBtn = document.getElementById('generateVideo');
  const cancelBtn = document.getElementById('cancelVideoExport');
  if (!generateBtn) return;
  
  // Setup cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      videoGenerationCancelled = true;
      if (currentGenerationAbortController) {
        currentGenerationAbortController.abort();
      }
    });
  }
  
  // Setup modal backdrop click handler (close modal when clicking outside)
  // Use a single handler that checks visibility before doing anything
  const modal = document.getElementById('videoExportModal');
  let modalBackdropHandler = null;
  
  if (modal) {
      modalBackdropHandler = (e) => {
        // CRITICAL: Check if modal is hidden FIRST - if so, do NOTHING
        // This prevents any interference with clicks on other elements
        const computedStyle = window.getComputedStyle(modal);
        const isHidden = modal.classList.contains('hidden') || 
                         computedStyle.display === 'none' ||
                         computedStyle.visibility === 'hidden' ||
                         computedStyle.opacity === '0' ||
                         computedStyle.pointerEvents === 'none';
        
        if (isHidden) {
          // Modal is hidden - completely ignore this event, don't interfere at all
          // Don't call stopPropagation, preventDefault, or anything else
          // Just return immediately to let the event continue normally
          return;
        }
        
        // Modal is visible - only handle backdrop clicks (not content clicks)
        // Check if click is on the backdrop (the modal itself, not its children)
        if (e.target === modal || e.target === modal) {
          // Only cancel if clicking the backdrop area, not the content
          const modalContent = modal.querySelector('.video-export-modal-content');
          if (!modalContent || !modalContent.contains(e.target)) {
            videoGenerationCancelled = true;
            if (currentGenerationAbortController) {
              currentGenerationAbortController.abort();
            }
          }
        }
      };
      
      // Use capture: false (bubble phase) - same as collapsible headers now
      // Both handlers check their conditions first, so order doesn't matter
      modal.addEventListener('click', modalBackdropHandler, { capture: false });
  }
  
  generateBtn.addEventListener('click', async () => {
    // Reset cancellation flag
    videoGenerationCancelled = false;
    currentGenerationAbortController = new AbortController();
    // Check browser compatibility first
    const compat = checkBrowserCompatibility();
    if (!compat.compatible) {
      alert('Browser compatibility issues:\n\n' + compat.issues.join('\n') + '\n\nPlease use a modern browser (Chrome, Firefox, Edge) or enable required features.');
      return;
    }
    
    // Note: We're using single-threaded FFmpeg to avoid CORS issues
    // Performance is still good for typical video generation tasks
    
    // Get parameters
    const startAngle = parseFloat(document.getElementById('animStartAngle')?.value || 0);
    const endAngle = parseFloat(document.getElementById('animEndAngle')?.value || 360);
    const frameCount = parseInt(document.getElementById('animFrameCount')?.value || 120);
    const fps = parseInt(document.getElementById('animFps')?.value || 30);
    
    // Validation
    if (frameCount < 12 || frameCount > 360) {
      alert('Frame count must be between 12 and 360');
      return;
    }
    
    if (startAngle === endAngle) {
      alert('Start and end angles must be different');
      return;
    }
    
    // Modal UI elements
    const modal = document.getElementById('videoExportModal');
    const modalProgressFill = document.getElementById('videoExportProgressFill');
    const modalProgressPercent = document.getElementById('videoExportProgressPercent');
    const modalStatus = document.getElementById('videoExportStatus');
    
    // Stop preview animation if playing - CRITICAL: Must be fully stopped before frame generation
    try {
      const { stopAnimationPreview } = await import('../../3d-generator.js');
      stopAnimationPreview();
      
      // Wait for any pending animation frames to complete
      // This ensures the animation loop is fully stopped
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Additional delay to ensure all renders are complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Force a final render at the start angle to ensure we're at the correct state
      const startAngle = parseFloat(document.getElementById('animStartAngle')?.value || 0);
      
      // Set orbit state and render
      try {
        const { setOrbitHorizontal } = await import('../ui/controls.js');
        setOrbitHorizontal(startAngle);
      } catch (e) {
        // If import fails, continue without setting orbit state
      }
      draw(startAngle);
      
      // Wait one more frame to ensure render is complete
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      console.log('✓ Animation preview stopped and state reset to start angle:', startAngle);
    } catch (e) {
      console.warn('⚠ Failed to stop animation preview:', e);
      // Continue anyway - frame generation will override
    }
    
    // Show modal and disable button
    generateBtn.disabled = true;
    if (modal) {
      // Remove hidden class first
      modal.classList.remove('hidden');
      
      // CRITICAL: Override all the !important styles from cleanup
      // We need to use setProperty with important to override the cleanup styles
      modal.style.setProperty('display', 'flex', 'important');
      modal.style.setProperty('pointer-events', 'auto', 'important');
      modal.style.setProperty('visibility', 'visible', 'important');
      modal.style.setProperty('opacity', '1', 'important');
      modal.style.setProperty('z-index', '10000', 'important');
      modal.style.setProperty('position', 'fixed', 'important');
      
      // Remove aria-hidden and restore tabindex
      modal.removeAttribute('aria-hidden');
      modal.removeAttribute('tabindex');
      
      // Ensure modal content can receive clicks
      const modalContent = modal.querySelector('.video-export-modal-content');
      if (modalContent) {
        modalContent.style.setProperty('display', 'block', 'important');
        modalContent.style.setProperty('pointer-events', 'auto', 'important');
      }
      
      // Force a repaint
      void modal.offsetHeight;
      
      console.log('✓ Modal shown:', {
        hasHiddenClass: modal.classList.contains('hidden'),
        display: window.getComputedStyle(modal).display,
        zIndex: window.getComputedStyle(modal).zIndex
      });
    }
    
    // Initialize progress to 0%
    const updateProgress = (message, percent) => {
      if (modalStatus) modalStatus.textContent = message || 'Initializing...';
      if (modalProgressFill && percent !== undefined) {
        modalProgressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
      }
      if (modalProgressPercent && percent !== undefined) {
        modalProgressPercent.textContent = `${Math.round(Math.max(0, Math.min(100, percent)))}%`;
      }
    };
    
    // Start at 0%
    updateProgress('Preparing video generation...', 0);
    
    // Start generation
    try {
      await generateTurntableVideo({
        startAngle,
        endAngle,
        frameCount,
        fps,
        onProgress: updateProgress,
        onComplete: () => {
          if (videoGenerationCancelled) {
            updateProgress('Video generation cancelled', 0);
            setTimeout(() => {
              cleanupModal(modal, generateBtn);
            }, 1000);
            return;
          }
          
          updateProgress('Video downloaded successfully!', 100);
          
          // Hide modal and re-enable button after delay
          setTimeout(() => {
            cleanupModal(modal, generateBtn);
            
            // Additional verification after a short delay to ensure everything is working
            setTimeout(() => {
              const animationHeader = document.querySelector('[data-section="animation"]');
              if (animationHeader) {
                const modalCheck = document.getElementById('videoExportModal');
                const modalComputed = modalCheck ? window.getComputedStyle(modalCheck) : null;
                console.log('✓ Post-cleanup verification:', {
                  modalHidden: modalCheck?.classList.contains('hidden'),
                  modalDisplay: modalComputed?.display,
                  modalZIndex: modalComputed?.zIndex,
                  headerClickable: window.getComputedStyle(animationHeader).pointerEvents !== 'none',
                  headerCursor: window.getComputedStyle(animationHeader).cursor
                });
              }
            }, 100);
          }, 2000);
        },
        onError: (error) => {
          // Don't show error alert if cancelled
          if (videoGenerationCancelled) {
            updateProgress('Video generation cancelled', 0);
            setTimeout(() => {
              cleanupModal(modal, generateBtn);
            }, 1000);
            return;
          }
          
          console.error('Video generation error:', error);
          
          updateProgress(`Error: ${error.message}`, 0);
          
          let errorMsg = `Failed to generate video:\n\n${error.message}`;
          
          // Add helpful troubleshooting tips
          if (error.message.includes('fetch') || error.message.includes('network')) {
            errorMsg += '\n\nTroubleshooting tips:\n';
            errorMsg += '1. Check your internet connection\n';
            errorMsg += '2. Make sure you\'re running the app with a local server (e.g., Live Server, Python http.server)\n';
            errorMsg += '3. Try refreshing the page and trying again\n';
            errorMsg += '4. Check browser console for more details';
          }
          
          alert(errorMsg);
          
          // Hide modal and re-enable button
          setTimeout(() => {
            cleanupModal(modal, generateBtn);
          }, 1000);
        },
        signal: currentGenerationAbortController.signal
      });
    } catch (error) {
      // Handle cancellation
      if (videoGenerationCancelled || error.name === 'AbortError') {
        updateProgress('Video generation cancelled', 0);
        setTimeout(() => {
          cleanupModal(modal, generateBtn);
        }, 1000);
      }
    } finally {
      currentGenerationAbortController = null;
    }
  });
}


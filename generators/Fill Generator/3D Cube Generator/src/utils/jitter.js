/* ============================================================
   LINE JITTER UTILITY
   Applies subtle, human-like waviness to lines (hand-drawn effect)
   Each line gets unique random deformation parameters
============================================================ */

/**
 * Simple hash function to generate a pseudo-random seed from coordinates
 * This ensures each line gets unique but consistent random parameters
 */
function hashCoordinates(x1, y1, x2, y2) {
  // Combine coordinates into a hash
  const str = `${x1.toFixed(2)}_${y1.toFixed(2)}_${x2.toFixed(2)}_${y2.toFixed(2)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Pseudo-random number generator using a seed
 * Returns a value between 0 and 1
 */
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Generate a wavy polyline path from a straight line
 * Creates subtle variations along the line to simulate hand-drawn appearance
 * Each line gets unique random parameters for independent deformation
 * @param {Number} x1 - Start X coordinate
 * @param {Number} y1 - Start Y coordinate
 * @param {Number} x2 - End X coordinate
 * @param {Number} y2 - End Y coordinate
 * @param {Number} jitterIntensity - Jitter intensity (0-100, where 100 = maximum subtle waviness)
 * @param {Number} waveFrequency - Wave frequency control (0-100, controls how many waves per line)
 * @param {Number} randomness - Randomness control (0-100, 0 = smooth waves, 100 = more random)
 * @returns {Array} Array of points [{x, y}, ...] forming a wavy path
 */
export function createWavyLine(x1, y1, x2, y2, jitterIntensity, waveFrequency = 50, randomness = 50) {
  if (jitterIntensity <= 0) {
    // No jitter - return just the endpoints
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  }
  
  // Calculate line properties
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  
  // If line is too short, just return endpoints
  if (length < 0.1) {
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  }
  
  // Normalized direction vector
  const dirX = dx / length;
  const dirY = dy / length;
  
  // Perpendicular vector (for perpendicular offsets)
  const perpX = -dirY;
  const perpY = dirX;
  
  // Maximum waviness amplitude in mm (subtle hand-drawn effect - max 0.52mm at 100%)
  const MAX_WAVINESS_MM = 0.52;
  
  // Scale jitter intensity (0-100) to actual waviness amount (0 to MAX_WAVINESS_MM)
  const wavinessAmount = (jitterIntensity / 100) * MAX_WAVINESS_MM;
  
  // Generate unique random parameters for this specific line
  // Use line coordinates as seed to ensure each line gets different parameters
  const lineSeed = hashCoordinates(x1, y1, x2, y2);
  
  // Generate unique wave parameters for this line
  const phase1 = seededRandom(lineSeed) * Math.PI * 2; // Random phase offset 1
  const phase2 = seededRandom(lineSeed + 1000) * Math.PI * 2; // Random phase offset 2
  const phase3 = seededRandom(lineSeed + 2000) * Math.PI * 2; // Random phase offset 3
  
  // Wave frequency control: 0-100 maps to frequency multiplier 0.3x to 2.5x
  // This controls how many waves appear along the line
  const frequencyMultiplier = 0.3 + (waveFrequency / 100) * 2.2; // 0.3 to 2.5
  
  // Vary frequencies per line, scaled by frequency control
  const baseFreq1 = 4 * frequencyMultiplier;
  const baseFreq2 = 2 * frequencyMultiplier;
  const baseFreq3 = 6 * frequencyMultiplier;
  
  const freq1 = baseFreq1 + (seededRandom(lineSeed + 3000) - 0.5) * baseFreq1 * 0.3; // Vary ±30%
  const freq2 = baseFreq2 + (seededRandom(lineSeed + 4000) - 0.5) * baseFreq2 * 0.3;
  const freq3 = baseFreq3 + (seededRandom(lineSeed + 5000) - 0.5) * baseFreq3 * 0.3;
  
  // Vary wave amplitudes per line (each wave gets different weight)
  const amp1 = 0.4 + (seededRandom(lineSeed + 6000) - 0.5) * 0.3; // Base 0.4, vary ±0.15
  const amp2 = 0.3 + (seededRandom(lineSeed + 7000) - 0.5) * 0.2; // Base 0.3, vary ±0.1
  const amp3 = 0.2 + (seededRandom(lineSeed + 8000) - 0.5) * 0.15; // Base 0.2, vary ±0.075
  
  // Randomness control: 0-100 maps to randomness factor 0.05 to 0.5
  // 0 = smooth waves (minimal randomness), 100 = very random
  const baseRandomness = 0.05 + (randomness / 100) * 0.45; // 0.05 to 0.5
  
  // Randomness factor varies per line, scaled by randomness control
  const randomnessFactor = baseRandomness + (seededRandom(lineSeed + 9000) - 0.5) * baseRandomness * 0.4;
  
  // Determine number of segments based on line length
  // Shorter segments = smoother curves, but more points
  // Aim for segments of about 2-3mm each
  const segmentLength = Math.max(1.5, Math.min(3.0, length / 8));
  const numSegments = Math.max(2, Math.ceil(length / segmentLength));
  
  // Generate points along the line with perpendicular waviness
  const points = [];
  
  // Always start with the first point (no offset at start)
  points.push({ x: x1, y: y1 });
  
  // Generate intermediate points with waviness
  for (let i = 1; i < numSegments; i++) {
    const t = i / numSegments; // 0 to 1 along the line
    
    // Base position along the line
    const baseX = x1 + t * dx;
    const baseY = y1 + t * dy;
    
    // Generate waviness using unique parameters for this line
    // Each line gets different frequencies, phases, and amplitudes
    const wave1 = Math.sin(t * Math.PI * freq1 + phase1) * amp1;
    const wave2 = Math.sin(t * Math.PI * freq2 + phase2) * amp2;
    const wave3 = Math.sin(t * Math.PI * freq3 + phase3) * amp3;
    
    // Add per-segment randomness (varies along the line)
    // Use a combination of the line seed and segment index for unique randomness
    const segmentSeed = lineSeed + i * 100;
    const random1 = (seededRandom(segmentSeed) - 0.5) * randomnessFactor;
    const random2 = (seededRandom(segmentSeed + 5000) - 0.5) * randomnessFactor * 0.5;
    const randomFactor = random1 + random2;
    
    // Combine waves with randomness
    const waveOffset = (wave1 + wave2 + wave3 + randomFactor) * wavinessAmount;
    
    // Apply perpendicular offset
    const offsetX = perpX * waveOffset;
    const offsetY = perpY * waveOffset;
    
    // Add slight variation along the line direction too (very subtle, also randomized)
    const alongRandom = (seededRandom(segmentSeed + 10000) - 0.5) * wavinessAmount * 0.2;
    const alongX = dirX * alongRandom;
    const alongY = dirY * alongRandom;
    
    points.push({
      x: baseX + offsetX + alongX,
      y: baseY + offsetY + alongY
    });
  }
  
  // Always end with the last point (no offset at end)
  points.push({ x: x2, y: y2 });
  
  return points;
}

/**
 * Apply jitter to a line's endpoints (legacy function for compatibility)
 * Now creates a wavy line instead
 * @param {Number} x1 - Start X coordinate
 * @param {Number} y1 - Start Y coordinate
 * @param {Number} x2 - End X coordinate
 * @param {Number} y2 - End Y coordinate
 * @param {Number} jitterIntensity - Jitter intensity (0-100)
 * @returns {Object} For compatibility, returns {x1, y1, x2, y2} but this is deprecated
 * @deprecated Use createWavyLine instead
 */
export function applyJitterToLine(x1, y1, x2, y2, jitterIntensity) {
  // For backward compatibility, return endpoints
  // But the actual waviness is applied when creating the polyline
  return { x1, y1, x2, y2 };
}

/**
 * Apply jitter to a point
 * @param {Number} x - X coordinate
 * @param {Number} y - Y coordinate
 * @param {Number} jitterIntensity - Jitter intensity (0-100)
 * @returns {Object} Jittered point {x, y}
 */
export function applyJitterToPoint(x, y, jitterIntensity) {
  if (jitterIntensity <= 0) {
    return { x, y };
  }
  
  // Maximum jitter distance in mm (very subtle - max 0.2mm at 100%)
  const MAX_JITTER_MM = 0.2;
  const jitterAmount = (jitterIntensity / 100) * MAX_JITTER_MM;
  
  return {
    x: x + (Math.random() - 0.5) * 2 * jitterAmount,
    y: y + (Math.random() - 0.5) * 2 * jitterAmount
  };
}

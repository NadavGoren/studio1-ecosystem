/**
 * Weaver.js - Core weaving pattern generation algorithm
 * Generates warp and weft threads with organic jitter and artistic effects
 * 
 * Coordinate System: Millimeters (A3 = 297mm x 420mm)
 * 
 * NEW FEATURES:
 * - Auto-density calculation from margins and spacing
 * - Weft angle rotation for Moiré effects
 * - Spacing modulation (sine wave bunching)
 * - Thread grouping (basket weave effect)
 */

// A3 dimensions in millimeters
export const A3_WIDTH = 297;
export const A3_HEIGHT = 420;

// Safety limits to prevent infinite loops
const MAX_THREADS_PER_AXIS = 300;

/**
 * Pseudo-random noise function using sine wave superposition
 * Creates organic, natural-looking variations without external libraries
 * 
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} frequency - How quickly the noise varies
 * @param {number} seed - Random seed for variation
 * @returns {number} Noise value between -1 and 1
 */
export function pseudoNoise(x, y, frequency, seed) {
    const f = frequency;
    return (
        Math.sin(x * f + seed) * 
        Math.cos(y * f * 1.3 + seed * 0.7) *
        Math.sin((x + y) * f * 0.5 + seed * 1.2)
    );
}

/**
 * Enhanced noise with multiple octaves for more natural look
 * 
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate  
 * @param {number} frequency - Base frequency
 * @param {number} seed - Random seed
 * @param {number} octaves - Number of noise layers (default 3)
 * @returns {number} Combined noise value
 */
export function layeredNoise(x, y, frequency, seed, octaves = 3) {
    let value = 0;
    let amplitude = 1;
    let freq = frequency;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        value += pseudoNoise(x, y, freq, seed + i * 100) * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        freq *= 2;
    }

    return value / maxValue;
}

/**
 * Generates a single line with optional jitter/organic effect
 * Subdivides the line into segments and applies perpendicular noise offset
 * 
 * @param {number} x1 - Start X coordinate (mm)
 * @param {number} y1 - Start Y coordinate (mm)
 * @param {number} x2 - End X coordinate (mm)
 * @param {number} y2 - End Y coordinate (mm)
 * @param {Object} options - Generation options
 * @param {number} options.amplitude - Jitter amplitude in mm (0 = straight line)
 * @param {number} options.frequency - Noise frequency (higher = more variation)
 * @param {number} options.segmentLength - Distance between points in mm
 * @param {number} options.seed - Random seed for this line
 * @returns {Array<{x: number, y: number}>} Array of points forming the line
 */
export function generateLine(x1, y1, x2, y2, options = {}) {
    const {
        amplitude = 0,
        frequency = 0.1,
        segmentLength = 5,
        seed = 0
    } = options;

    const points = [];
    const distance = Math.hypot(x2 - x1, y2 - y1);
    
    // For very short lines or no jitter, just return start and end
    if (distance < segmentLength || amplitude === 0) {
        return [
            { x: x1, y: y1 },
            { x: x2, y: y2 }
        ];
    }

    const segments = Math.ceil(distance / segmentLength);
    
    // Calculate perpendicular direction (90 degrees from line direction)
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        
        // Linear interpolation along the line
        const baseX = x1 + (x2 - x1) * t;
        const baseY = y1 + (y2 - y1) * t;
        
        // Apply noise offset perpendicular to line direction
        const noiseVal = layeredNoise(baseX, baseY, frequency, seed);
        let offset = noiseVal * amplitude;
        
        // Taper the offset at the ends for cleaner start/end points
        const taper = Math.sin(t * Math.PI);
        offset *= taper;

        points.push({
            x: baseX + perpX * offset,
            y: baseY + perpY * offset
        });
    }

    return points;
}

/**
 * Calculate thread positions that fill a given range
 * Auto-calculates density based on spacing to fill from start to end
 * 
 * @param {number} start - Start position (mm)
 * @param {number} end - End position (mm)
 * @param {number} baseSpacing - Base spacing between threads (mm)
 * @param {Object} options - Additional options
 * @param {number} options.variance - Random variance to apply (mm)
 * @param {number} options.modulationIntensity - Sine wave modulation intensity (0-1)
 * @param {number} options.modulationFrequency - Number of sine waves across the span
 * @param {string} options.grouping - Grouping mode: 'none', 'pairs', 'triplets'
 * @param {Function} options.random - Seeded random function
 * @returns {Array<number>} Array of thread positions
 */
export function calculateThreadPositions(start, end, baseSpacing, options = {}) {
    const {
        variance = 0,
        modulationIntensity = 0,
        modulationFrequency = 3,
        grouping = 'none',
        random = Math.random
    } = options;

    const positions = [];
    const totalLength = end - start;
    
    // Safety check
    if (totalLength <= 0 || baseSpacing <= 0) {
        return positions;
    }

    // Calculate number of threads that fit
    let threadCount = Math.floor(totalLength / baseSpacing) + 1;
    
    // Cap at maximum to prevent infinite loops
    threadCount = Math.min(threadCount, MAX_THREADS_PER_AXIS);
    
    // Handle grouping - adjust effective spacing
    const groupSize = grouping === 'pairs' ? 2 : grouping === 'triplets' ? 3 : 1;
    const groupGapMultiplier = groupSize > 1 ? 2.5 : 1; // Extra gap between groups
    
    let currentPos = start;
    let threadIndex = 0;
    
    while (currentPos <= end && positions.length < MAX_THREADS_PER_AXIS) {
        // Calculate base position with modulation
        let pos = currentPos;
        
        // Apply sine wave modulation
        if (modulationIntensity > 0) {
            const normalizedPos = (currentPos - start) / totalLength;
            const sineOffset = Math.sin(normalizedPos * Math.PI * 2 * modulationFrequency);
            // Modulation pushes threads together and apart
            pos += sineOffset * baseSpacing * modulationIntensity * 0.5;
        }
        
        // Apply random variance
        if (variance > 0) {
            pos += (random() - 0.5) * variance * 2;
        }
        
        // Clamp to valid range
        pos = Math.max(start, Math.min(end, pos));
        positions.push(pos);
        
        // Calculate next position based on grouping
        threadIndex++;
        
        if (groupSize > 1 && threadIndex % groupSize === 0) {
            // End of group - add extra gap
            currentPos += baseSpacing * groupGapMultiplier;
        } else {
            // Within group or no grouping - normal spacing
            currentPos += baseSpacing;
        }
    }

    return positions;
}

/**
 * Rotate a point around an origin by a given angle
 * 
 * @param {number} x - Point X coordinate
 * @param {number} y - Point Y coordinate
 * @param {number} originX - Origin X coordinate
 * @param {number} originY - Origin Y coordinate
 * @param {number} angleDegrees - Rotation angle in degrees
 * @returns {{x: number, y: number}} Rotated point
 */
function rotatePoint(x, y, originX, originY, angleDegrees) {
    const angleRad = angleDegrees * (Math.PI / 180);
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    
    const dx = x - originX;
    const dy = y - originY;
    
    return {
        x: originX + dx * cos - dy * sin,
        y: originY + dx * sin + dy * cos
    };
}

/**
 * Generates the complete weave pattern
 * 
 * @param {Object} config - Weave configuration
 * @param {number} config.margins - Margin from edges (mm)
 * @param {number} config.warpSpacing - Spacing between warp threads (mm)
 * @param {number} config.weftSpacing - Spacing between weft threads (mm)
 * @param {number} config.spacingVariance - Random variance in spacing (mm)
 * @param {number} config.warpJitter - Jitter amplitude for warp threads (mm)
 * @param {number} config.weftJitter - Jitter amplitude for weft threads (mm)
 * @param {number} config.jitterFrequency - Frequency of jitter noise
 * @param {number} config.segmentLength - Segment length for jitter (mm)
 * @param {number} config.weftAngle - Rotation angle for weft threads (degrees)
 * @param {string} config.grouping - Grouping mode: 'none', 'pairs', 'triplets'
 * @param {number} config.modulationIntensity - Spacing modulation intensity (0-100)
 * @param {number} config.modulationFrequency - Number of modulation waves
 * @param {number} config.seed - Master random seed
 * @returns {Object} Object containing warp and weft thread arrays
 */
export function generateWeave(config) {
    const {
        margins = 15,
        warpSpacing = 8,
        weftSpacing = 8,
        spacingVariance = 0,
        warpJitter = 2,
        weftJitter = 2,
        jitterFrequency = 0.1,
        segmentLength = 5,
        weftAngle = 0,
        grouping = 'none',
        modulationIntensity = 0,
        modulationFrequency = 3,
        seed = Date.now()
    } = config;

    // Seeded random number generator
    const seededRandom = createSeededRandom(seed);
    
    const warp = [];  // Vertical threads
    const weft = [];  // Horizontal threads

    // Calculate drawable area
    const drawStartX = margins;
    const drawEndX = A3_WIDTH - margins;
    const drawStartY = margins;
    const drawEndY = A3_HEIGHT - margins;

    // Convert modulation intensity from 0-100 to 0-1
    const modIntensity = modulationIntensity / 100;

    // ========================================
    // Generate WARP threads (Vertical)
    // ========================================
    const warpPositions = calculateThreadPositions(
        drawStartX,
        drawEndX,
        warpSpacing,
        {
            variance: spacingVariance,
            modulationIntensity: modIntensity,
            modulationFrequency: modulationFrequency,
            grouping: grouping,
            random: seededRandom
        }
    );

    warpPositions.forEach((x, index) => {
        const lineOptions = {
            amplitude: warpJitter,
            frequency: jitterFrequency,
            segmentLength: segmentLength,
            seed: seed + index * 17  // Unique seed per thread
        };

        const points = generateLine(
            x, drawStartY,
            x, drawEndY,
            lineOptions
        );

        warp.push({
            id: `warp-${index}`,
            points: points,
            index: index
        });
    });

    // ========================================
    // Generate WEFT threads (Horizontal, with angle)
    // ========================================
    const weftPositions = calculateThreadPositions(
        drawStartY,
        drawEndY,
        weftSpacing,
        {
            variance: spacingVariance,
            modulationIntensity: modIntensity,
            modulationFrequency: modulationFrequency,
            grouping: grouping,
            random: seededRandom
        }
    );

    // Calculate center point for rotation
    const centerX = A3_WIDTH / 2;
    const centerY = A3_HEIGHT / 2;

    weftPositions.forEach((y, index) => {
        // Start and end points for horizontal line
        let startX = drawStartX;
        let startY = y;
        let endX = drawEndX;
        let endY = y;

        // Apply weft angle rotation around center
        if (weftAngle !== 0) {
            const rotatedStart = rotatePoint(startX, startY, centerX, centerY, weftAngle);
            const rotatedEnd = rotatePoint(endX, endY, centerX, centerY, weftAngle);
            
            startX = rotatedStart.x;
            startY = rotatedStart.y;
            endX = rotatedEnd.x;
            endY = rotatedEnd.y;
        }

        const lineOptions = {
            amplitude: weftJitter,
            frequency: jitterFrequency,
            segmentLength: segmentLength,
            seed: seed + 10000 + index * 23  // Different seed space for weft
        };

        const points = generateLine(
            startX, startY,
            endX, endY,
            lineOptions
        );

        weft.push({
            id: `weft-${index}`,
            points: points,
            index: index
        });
    });

    return { warp, weft };
}

/**
 * Create a seeded pseudo-random number generator
 * Uses a simple mulberry32 algorithm
 * 
 * @param {number} seed - Initial seed value
 * @returns {Function} Random function returning 0-1
 */
function createSeededRandom(seed) {
    let state = seed;
    
    return function() {
        state |= 0;
        state = state + 0x6D2B79F5 | 0;
        let t = Math.imul(state ^ state >>> 15, 1 | state);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/**
 * Utility: Calculate total path length of a thread
 * Useful for estimating plot time
 * 
 * @param {Array<{x: number, y: number}>} points - Thread points
 * @returns {number} Total length in mm
 */
export function calculatePathLength(points) {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
        length += Math.hypot(
            points[i].x - points[i - 1].x,
            points[i].y - points[i - 1].y
        );
    }
    return length;
}

/**
 * Utility: Get statistics about a generated weave
 * 
 * @param {Object} weave - Generated weave object
 * @returns {Object} Statistics object
 */
export function getWeaveStats(weave) {
    const warpLength = weave.warp.reduce(
        (sum, thread) => sum + calculatePathLength(thread.points), 
        0
    );
    const weftLength = weave.weft.reduce(
        (sum, thread) => sum + calculatePathLength(thread.points), 
        0
    );

    return {
        warpCount: weave.warp.length,
        weftCount: weave.weft.length,
        totalThreads: weave.warp.length + weave.weft.length,
        warpLengthMm: Math.round(warpLength),
        weftLengthMm: Math.round(weftLength),
        totalLengthMm: Math.round(warpLength + weftLength),
        totalLengthM: ((warpLength + weftLength) / 1000).toFixed(2)
    };
}

/**
 * perlin.js
 * 
 * 2D Perlin noise implementation for flow field generation.
 * Based on Ken Perlin's improved noise algorithm.
 * Enhanced with octaves (fBm), curl noise, and flow control parameters.
 */

class PerlinNoise {
    constructor(seed = 0) {
        this.seed = seed;
        this.permutation = [];
        this.p = [];
        
        // Permutation table
        const p = [];
        for (let i = 0; i < 256; i++) {
            p[i] = i;
        }
        
        // Shuffle using seed - improved seeded random
        let s = seed;
        const seededRandom = () => {
            s = (s * 1103515245 + 12345) & 0x7fffffff;
            return s / 0x7fffffff;
        };
        
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(seededRandom() * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }
        
        // Duplicate the permutation array
        for (let i = 0; i < 512; i++) {
            this.p[i] = p[i % 256];
        }
    }
    
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    lerp(a, b, t) {
        return a + t * (b - a);
    }
    
    grad(hash, x, y) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : 0);
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    
    noise2D(x, y) {
        // Find unit grid cell containing point
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        // Get relative x, y coordinates of point within that cell
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        // Compute fade curves for each of x, y
        const u = this.fade(x);
        const v = this.fade(y);
        
        // Hash coordinates of the 4 square corners
        const A = this.p[X] + Y;
        const AA = this.p[A];
        const AB = this.p[A + 1];
        const B = this.p[X + 1] + Y;
        const BA = this.p[B];
        const BB = this.p[B + 1];
        
        // And add blended results from 4 corners of the square
        return this.lerp(
            this.lerp(
                this.grad(this.p[AA], x, y),
                this.grad(this.p[BA], x - 1, y),
                u
            ),
            this.lerp(
                this.grad(this.p[AB], x, y - 1),
                this.grad(this.p[BB], x - 1, y - 1),
                u
            ),
            v
        );
    }
    
    /**
     * Fractal Brownian Motion (fBm) - layered noise for more detail
     * Combines multiple octaves of noise at different frequencies
     * 
     * @param {number} x - X coordinate (already scaled)
     * @param {number} y - Y coordinate (already scaled)
     * @param {number} octaves - Number of noise layers (1-6)
     * @param {number} persistence - How much each octave contributes (0-1)
     * @returns {number} Noise value in range approximately [-1, 1]
     */
    fbm2D(x, y, octaves = 1, persistence = 0.5) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            total += this.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }
        
        return total / maxValue;
    }
    
    /**
     * Curl noise - creates divergence-free flow (no sources/sinks)
     * Results in more organic, swirling patterns
     * 
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate  
     * @param {number} scale - Noise scale
     * @param {number} octaves - Number of octaves for fBm
     * @param {number} persistence - Persistence for fBm
     * @returns {Array} Vector [vx, vy] derived from curl of noise field
     */
    getCurlVector(x, y, scale, octaves = 1, persistence = 0.5) {
        const eps = 0.0001; // Small epsilon for numerical derivative
        
        const sx = x * scale;
        const sy = y * scale;
        
        // Compute partial derivatives using central differences
        const dndx = (this.fbm2D(sx + eps, sy, octaves, persistence) - 
                      this.fbm2D(sx - eps, sy, octaves, persistence)) / (2 * eps);
        const dndy = (this.fbm2D(sx, sy + eps, octaves, persistence) - 
                      this.fbm2D(sx, sy - eps, octaves, persistence)) / (2 * eps);
        
        // Curl in 2D: rotate gradient by 90 degrees
        // curl = (dN/dy, -dN/dx)
        const vx = dndy;
        const vy = -dndx;
        
        // Normalize
        const len = Math.sqrt(vx * vx + vy * vy);
        if (len > 0.0001) {
            return [vx / len, vy / len];
        }
        return [1, 0];
    }
    
    /**
     * Get flow field vector at a given point.
     * 
     * "BY THE BOOK" IMPLEMENTATION:
     * Classic flow field uses a single noise sample mapped to an angle.
     * This creates smooth, continuous flow with natural convergence/divergence zones.
     * 
     * For gap-free flow, use curlAmount > 0 which creates divergence-free flow
     * (no sources or sinks, so lines don't bunch up or spread apart).
     * 
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} scale - Noise scale (default: 0.01)
     * @param {Object} options - Additional options
     * @param {number} options.octaves - Number of noise octaves (1-6)
     * @param {number} options.persistence - Octave persistence (0-1)
     * @param {number} options.angleOffset - Global angle offset in radians
     * @param {number} options.flowStrength - How much noise affects direction (0-1)
     * @param {number} options.curlAmount - Amount of curl noise (0-1). Higher = more uniform spacing
     * @returns {Array} Normalized vector [vx, vy]
     */
    getFlowVector(x, y, scale = 0.01, options = {}) {
        const {
            octaves = 1,
            persistence = 0.5,
            angleOffset = 0,
            flowStrength = 1.0,
            curlAmount = 0
        } = options;
        
        // Special case: when scale is very small or 0, return a default direction
        // This creates consistent straight lines when noise is effectively disabled
        const effectiveScale = scale * flowStrength;
        if (effectiveScale <= 0.0001 || flowStrength <= 0.0001) {
            return [Math.cos(angleOffset), Math.sin(angleOffset)];
        }
        
        let vx, vy;
        
        // Curl noise creates DIVERGENCE-FREE flow (no convergence zones = no gaps)
        // This is the key to getting "tight" results without weird gaps
        if (curlAmount >= 1.0) {
            // Pure curl noise - mathematically guarantees no convergence/divergence
            [vx, vy] = this.getCurlVector(x, y, scale, octaves, persistence);
        } else if (curlAmount > 0) {
            // Blend between angle-based and curl noise
            const [curlX, curlY] = this.getCurlVector(x, y, scale, octaves, persistence);
            
            // Classic angle-based flow
            const noiseValue = this.fbm2D(x * scale, y * scale, octaves, persistence);
            const clampedNoise = Math.max(-1, Math.min(1, noiseValue));
            const angle = clampedNoise * Math.PI * 2; // Use full 360° range
            const angleX = Math.cos(angle);
            const angleY = Math.sin(angle);
            
            // Blend: more curl = more uniform spacing
            vx = angleX * (1 - curlAmount) + curlX * curlAmount;
            vy = angleY * (1 - curlAmount) + curlY * curlAmount;
            
            // Renormalize after blending
            const len = Math.sqrt(vx * vx + vy * vy);
            if (len > 0.0001) {
                vx /= len;
                vy /= len;
            }
        } else {
            // CLASSIC "BY THE BOOK" FLOW FIELD:
            // Single noise sample → angle → unit vector
            // This is the standard approach used in most flow field implementations
            
            const noiseValue = this.fbm2D(x * scale, y * scale, octaves, persistence);
            
            // Clamp to [-1, 1] to ensure predictable angle range
            const clampedNoise = Math.max(-1, Math.min(1, noiseValue));
            
            // Map noise to angle across the full circle
            const angle = clampedNoise * Math.PI * 2;
            
            vx = Math.cos(angle);
            vy = Math.sin(angle);
        }
        
        // Apply angle offset (global rotation of entire flow field)
        if (angleOffset !== 0) {
            const cos = Math.cos(angleOffset);
            const sin = Math.sin(angleOffset);
            const newVx = vx * cos - vy * sin;
            const newVy = vx * sin + vy * cos;
            vx = newVx;
            vy = newVy;
        }
        
        // Apply flow strength (blend with uniform direction)
        // 0 = all uniform, 1 = all noise-driven
        if (flowStrength < 1.0) {
            const defaultX = Math.cos(angleOffset);
            const defaultY = Math.sin(angleOffset);
            
            vx = defaultX * (1 - flowStrength) + vx * flowStrength;
            vy = defaultY * (1 - flowStrength) + vy * flowStrength;
            
            // Renormalize
            const len = Math.sqrt(vx * vx + vy * vy);
            if (len > 0.0001) {
                vx /= len;
                vy /= len;
            }
        }
        
        return [vx, vy];
    }
}

// Create a default instance
const perlin = new PerlinNoise();


/**
 * Seedable random number generator using mulberry32 algorithm
 * Returns deterministic pseudo-random numbers in range [0, 1)
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /**
   * Returns a random number in range [0, 1)
   */
  random(): number {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  /**
   * Returns a random integer in range [min, max] (inclusive)
   */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Returns a random number in range [min, max)
   */
  randomRange(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }

  /**
   * Returns true with given probability (0-1)
   */
  chance(probability: number): boolean {
    return this.random() < probability;
  }

  /**
   * Returns a random element from an array
   */
  choice<T>(array: T[]): T {
    return array[Math.floor(this.random() * array.length)];
  }

  /**
   * Shuffles an array in place
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}







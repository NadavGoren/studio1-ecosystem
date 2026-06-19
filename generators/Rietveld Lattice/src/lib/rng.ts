// Deterministic, seedable RNG. Same seed → identical stream → identical piece.

/** mulberry32: fast 32-bit seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Mix an integer seed so small/adjacent seeds produce very different streams. */
export function hashSeed(seed: number): number {
  let h = seed >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 0x45d9f3b)
  h ^= h >>> 16
  h = Math.imul(h, 0x45d9f3b)
  h ^= h >>> 16
  return h >>> 0
}

export class Rng {
  private next: () => number
  constructor(seed: number) {
    this.next = mulberry32(hashSeed(seed))
  }
  /** float in [0, 1) */
  f(): number {
    return this.next()
  }
  /** float in [min, max) */
  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }
  /** integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(min + (max - min + 1) * this.next())
  }
  /** true with probability p */
  chance(p: number): boolean {
    return this.next() < p
  }
  /** pick one of items by parallel weights */
  weighted<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0)
    let r = this.next() * total
    for (let i = 0; i < items.length; i++) {
      r -= weights[i]
      if (r <= 0) return items[i]
    }
    return items[items.length - 1]
  }
}

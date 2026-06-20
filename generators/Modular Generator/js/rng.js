/* rng.js — seeded pseudo-random number generator + helpers.
   Everything is deterministic given a seed, so a seed value always
   reproduces the same artwork. */
(function () {
  window.MOD = window.MOD || {};

  // mulberry32 — small, fast, good-enough seeded PRNG returning [0,1).
  function makeRNG(seed) {
    let s = seed >>> 0;
    if (s === 0) s = 0x9e3779b9;
    return function () {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Convenience wrappers bound to a given rng.
  function rngHelpers(rng) {
    return {
      next: rng,
      range: (a, b) => a + (b - a) * rng(),
      int: (a, b) => Math.floor(a + (b - a + 1) * rng()),
      pick: (arr) => arr[Math.floor(rng() * arr.length)],
      chance: (p) => rng() < p,
      shuffle: (arr) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      },
    };
  }

  MOD.makeRNG = makeRNG;
  MOD.rngHelpers = rngHelpers;
})();

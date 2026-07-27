/**
 * Small deterministic hashing helpers.
 *
 * These are used by the mock provider and the local embedding fallback so that
 * evalgate produces stable, reproducible results without any network access.
 */

/** A fast, stable 32-bit string hash (FNV-1a). */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiplication using Math.imul to stay in range.
    hash = Math.imul(hash, 0x01000193);
  }
  // Force to unsigned 32-bit.
  return hash >>> 0;
}

/**
 * A tiny deterministic PRNG (mulberry32). Given the same seed it always yields
 * the same sequence, which keeps mock latencies and outputs reproducible.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

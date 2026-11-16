// Deterministic randomness. A random value is a pure function of (seed, keys), so the same
// event gives the same result whether time is simulated in one step or in many small steps.
// This is what lets offline catch-up (and later BOTs) be reproducible and testable.

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a 32-bit hash of a string, as an unsigned integer. */
export function hashString(text: string, seed = FNV_OFFSET): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}

/** Final avalanche step (from murmur3) so nearby keys give unrelated outputs. */
function mix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Uniform number in [0, 1) derived from a seed and a list of keys. */
export function randomFor(seed: number, ...keys: Array<string | number>): number {
  const h = mix(hashString(keys.join('|'), seed >>> 0));
  return h / 0x100000000;
}

/** Rounds a fractional amount up or down with probability equal to the fraction. */
export function stochasticRound(amount: number, seed: number, ...keys: Array<string | number>): number {
  const whole = Math.floor(amount);
  const frac = amount - whole;
  return whole + (randomFor(seed, ...keys) < frac ? 1 : 0);
}

/** A new 32-bit seed for a fresh profile. */
export function newSeed(entropy: number): number {
  return mix(hashString(String(entropy))) || 1;
}

/**
 * Deterministic pseudo-random generation for synthetic campus data (FR-12).
 *
 * Every generator derives its stream from (seed, ...context parts), e.g.
 * ('481-FALL-2026', 'cafeteria', '2026-11-16'). The same inputs always yield the
 * same values on every machine and every run; no Math.random() is used anywhere
 * in the connector tier.
 */

/** 32-bit FNV-1a hash of a string. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG: returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeededRandom {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] (inclusive). */
  intBetween(min: number, max: number): number;
  /** One element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** A new array with the same elements in a deterministic shuffled order. */
  shuffle<T>(items: readonly T[]): T[];
}

/** Creates a deterministic generator for the given seed and context parts. */
export function createSeededRandom(seed: string, ...parts: Array<string | number>): SeededRandom {
  const next = mulberry32(hashString([seed, ...parts].join('|')));
  const intBetween = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    intBetween,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error('Cannot pick from an empty list');
      }
      return items[intBetween(0, items.length - 1)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = intBetween(0, i);
        const tmp = copy[i] as T;
        copy[i] = copy[j] as T;
        copy[j] = tmp;
      }
      return copy;
    },
  };
}

/**
 * Seeded randomness.
 *
 * Every question in Overtone is generated from a seed, because three features
 * depend on it: the daily challenge gives everyone the same ten questions, an
 * async head-to-head replays the exact set the creator played, and the tests can
 * assert on generated output at all.
 *
 * So generators never call `Math.random()` — they take an `Rng`. The algorithm
 * is mulberry32: 32 bits of state, good enough statistically for picking
 * questions, and short enough to be obviously deterministic.
 */

export interface Rng {
  /** Next float in `[0, 1)`. */
  next(): number;
  /** Integer in `[min, max)`. */
  int(min: number, max: number): number;
  /** One item. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** `count` distinct items, or all of them if `count` exceeds the length. */
  pickMany<T>(items: readonly T[], count: number): T[];
  /** A new array, shuffled. Does not mutate the input. */
  shuffle<T>(items: readonly T[]): T[];
  /** True with probability `p` (default 0.5). */
  bool(p?: number): boolean;
  /**
   * An independent stream derived from this one and `label`.
   *
   * Use it to give each question its own stream, so that changing how one
   * question is built — or inserting a question — does not shift every question
   * after it. Forking does not disturb the parent.
   */
  fork(label: string): Rng;
}

/**
 * Mixes a string into a 32-bit seed (xmur3). Lets seeds be meaningful strings
 * like `daily-2026-10-12-scaleDegrees` instead of opaque numbers.
 */
export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function normaliseSeed(seed: number | string): number {
  return typeof seed === 'number' ? Math.abs(Math.trunc(seed)) >>> 0 : hashSeed(seed);
}

/** The raw generator: a function returning the next float in `[0, 1)`. */
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

export class SeededRandomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeededRandomError';
  }
}

/**
 * An `Rng` for a seed. The same seed always produces the same sequence, on any
 * platform — `Math.imul` and `>>>` are exact in JS, so there is no float drift.
 */
export function createRng(seed: number | string): Rng {
  const numeric = normaliseSeed(seed);
  const next = mulberry32(numeric);

  const rng: Rng = {
    next,

    int(min: number, max: number): number {
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        throw new SeededRandomError(`int(${min}, ${max}) needs finite bounds`);
      }
      const low = Math.ceil(min);
      const high = Math.floor(max);
      if (high <= low) return low;
      return low + Math.floor(next() * (high - low));
    },

    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new SeededRandomError('pick() on an empty array');
      const item = items[rng.int(0, items.length)];
      if (item === undefined) throw new SeededRandomError('pick() produced no item');
      return item;
    },

    pickMany<T>(items: readonly T[], count: number): T[] {
      return rng.shuffle(items).slice(0, Math.max(0, Math.min(count, items.length)));
    },

    shuffle<T>(items: readonly T[]): T[] {
      // Fisher-Yates, drawing from the same stream as everything else.
      const out = [...items];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = rng.int(0, i + 1);
        const a = out[i] as T;
        const b = out[j] as T;
        out[i] = b;
        out[j] = a;
      }
      return out;
    },

    bool(p = 0.5): boolean {
      return next() < p;
    },

    fork(label: string): Rng {
      // Mix the parent's current position with the label so the child stream is
      // reproducible but unrelated to its siblings.
      return createRng(hashSeed(`${numeric}:${label}:${Math.floor(next() * 4294967296)}`));
    },
  };

  return rng;
}

/**
 * A stable fork keyed only by seed and label — not by how far the parent has
 * advanced. Use it when a sub-stream must stay identical regardless of what
 * else has been generated, such as question *n* of a daily challenge.
 */
export function createSubRng(seed: number | string, label: string): Rng {
  return createRng(`${normaliseSeed(seed)}::${label}`);
}

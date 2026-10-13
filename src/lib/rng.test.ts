import { describe, expect, it } from 'vitest';

import {
  SeededRandomError,
  createRng,
  createSubRng,
  hashSeed,
  mulberry32,
  normaliseSeed,
} from './rng';

describe('mulberry32', () => {
  it('returns floats in [0, 1)', () => {
    const next = mulberry32(12345);
    for (let i = 0; i < 2000; i += 1) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is deterministic for a seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const left = Array.from({ length: 50 }, a);
    const right = Array.from({ length: 50 }, b);
    expect(left).toEqual(right);
  });

  it('gives different streams for different seeds', () => {
    const a = Array.from({ length: 20 }, mulberry32(1));
    const b = Array.from({ length: 20 }, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it('does not get stuck or repeat immediately', () => {
    const next = mulberry32(7);
    const values = Array.from({ length: 500 }, next);
    expect(new Set(values).size).toBeGreaterThan(490);
  });

  it('spreads roughly evenly across the unit interval', () => {
    const next = mulberry32(99);
    const buckets = new Array<number>(10).fill(0);
    const samples = 20000;
    for (let i = 0; i < samples; i += 1) {
      const bucket = Math.floor(next() * 10);
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    for (const count of buckets) {
      // Each tenth should hold ~2000; allow generous slack.
      expect(count).toBeGreaterThan(samples / 10 - 300);
      expect(count).toBeLessThan(samples / 10 + 300);
    }
  });

  it('is pinned to known output, so a refactor cannot silently change questions', () => {
    const next = mulberry32(1);
    const first = [next(), next(), next()].map((value) => Number(value.toFixed(10)));
    expect(first).toEqual([0.6270739406, 0.0027357212, 0.52744704]);
  });
});

describe('hashSeed', () => {
  it('is stable for a string', () => {
    expect(hashSeed('overtone')).toBe(hashSeed('overtone'));
  });

  it('separates similar strings', () => {
    expect(hashSeed('daily-2026-10-12')).not.toBe(hashSeed('daily-2026-10-13'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const seed of ['', 'a', 'overtone', 'daily-2026-10-12-scaleDegrees']) {
      const hash = hashSeed(seed);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('is pinned to known output', () => {
    expect(hashSeed('overtone')).toBe(3075268139);
  });
});

describe('normaliseSeed', () => {
  it('passes numbers through as unsigned integers', () => {
    expect(normaliseSeed(42)).toBe(42);
    expect(normaliseSeed(-42)).toBe(42);
    expect(normaliseSeed(4.9)).toBe(4);
  });

  it('hashes strings', () => {
    expect(normaliseSeed('overtone')).toBe(hashSeed('overtone'));
  });
});

describe('createRng: the same seed gives the same sequence', () => {
  it('for next()', () => {
    const a = createRng(2026);
    const b = createRng(2026);
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(
      Array.from({ length: 20 }, () => b.next()),
    );
  });

  it('for a string seed', () => {
    const a = createRng('daily-2026-10-12');
    const b = createRng('daily-2026-10-12');
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(
      Array.from({ length: 20 }, () => b.next()),
    );
  });

  it('for every method, interleaved', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const run = () => {
      const rng = createRng('mixed');
      return [
        rng.next(),
        rng.int(0, 100),
        rng.pick(items),
        rng.bool(),
        rng.shuffle(items),
        rng.pickMany(items, 3),
        rng.fork('child').next(),
      ];
    };
    expect(run()).toEqual(run());
  });
});

describe('int', () => {
  it('stays within [min, max)', () => {
    const rng = createRng(1);
    for (let i = 0; i < 5000; i += 1) {
      const value = rng.int(3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThan(7);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('reaches both ends of the range', () => {
    const rng = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i += 1) seen.add(rng.int(0, 4));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it('collapses an empty or inverted range to the low bound', () => {
    const rng = createRng(1);
    expect(rng.int(5, 5)).toBe(5);
    expect(rng.int(5, 2)).toBe(5);
  });

  it('rejects non-finite bounds rather than returning NaN', () => {
    const rng = createRng(1);
    expect(() => rng.int(0, Number.POSITIVE_INFINITY)).toThrow(SeededRandomError);
    expect(() => rng.int(Number.NaN, 3)).toThrow(SeededRandomError);
  });
});

describe('pick', () => {
  it('always returns a member of the array', () => {
    const rng = createRng(7);
    const items = ['x', 'y', 'z'];
    for (let i = 0; i < 1000; i += 1) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it('eventually returns every member', () => {
    const rng = createRng(11);
    const items = [1, 2, 3, 4, 5];
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i += 1) seen.add(rng.pick(items));
    expect(seen.size).toBe(items.length);
  });

  it('throws on an empty array instead of returning undefined', () => {
    const rng = createRng(1);
    expect(() => rng.pick([])).toThrow(SeededRandomError);
  });

  it('handles a single-item array', () => {
    const rng = createRng(1);
    expect(rng.pick(['only'])).toBe('only');
  });
});

describe('shuffle', () => {
  it('keeps every element exactly once', () => {
    const rng = createRng(3);
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = 0; i < 200; i += 1) {
      expect([...rng.shuffle(items)].sort((a, b) => a - b)).toEqual(items);
    }
  });

  it('does not mutate the input', () => {
    const rng = createRng(3);
    const items = [1, 2, 3, 4, 5];
    const copy = [...items];
    rng.shuffle(items);
    expect(items).toEqual(copy);
  });

  it('actually reorders', () => {
    const rng = createRng(3);
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffles = Array.from({ length: 20 }, () => rng.shuffle(items).join(','));
    expect(new Set(shuffles).size).toBeGreaterThan(1);
  });

  it('handles empty and single-item arrays', () => {
    const rng = createRng(1);
    expect(rng.shuffle([])).toEqual([]);
    expect(rng.shuffle([9])).toEqual([9]);
  });
});

describe('pickMany', () => {
  it('returns distinct items', () => {
    const rng = createRng(13);
    const items = [1, 2, 3, 4, 5, 6];
    for (let i = 0; i < 200; i += 1) {
      const picked = rng.pickMany(items, 3);
      expect(picked).toHaveLength(3);
      expect(new Set(picked).size).toBe(3);
      for (const item of picked) expect(items).toContain(item);
    }
  });

  it('clamps to the array length instead of padding', () => {
    const rng = createRng(1);
    expect(rng.pickMany([1, 2], 5)).toHaveLength(2);
    expect(rng.pickMany([1, 2], 0)).toHaveLength(0);
    expect(rng.pickMany([1, 2], -1)).toHaveLength(0);
  });
});

describe('bool', () => {
  it('respects the probability', () => {
    const rng = createRng(17);
    const trials = 10000;
    let trues = 0;
    for (let i = 0; i < trials; i += 1) if (rng.bool(0.25)) trues += 1;
    expect(trues / trials).toBeGreaterThan(0.22);
    expect(trues / trials).toBeLessThan(0.28);
  });

  it('is never true at p=0 and always true at p=1', () => {
    const rng = createRng(1);
    for (let i = 0; i < 100; i += 1) {
      expect(rng.bool(0)).toBe(false);
      expect(rng.bool(1)).toBe(true);
    }
  });
});

describe('fork', () => {
  it('is reproducible', () => {
    const makeChild = () => createRng('parent').fork('question-3').next();
    expect(makeChild()).toBe(makeChild());
  });

  it('gives unrelated streams to different labels', () => {
    const parent = createRng('parent');
    const a = parent.fork('a').next();
    const parent2 = createRng('parent');
    const b = parent2.fork('b').next();
    expect(a).not.toBe(b);
  });

  it('advances the parent, so sibling forks differ', () => {
    const parent = createRng('parent');
    const first = parent.fork('same').next();
    const second = parent.fork('same').next();
    expect(first).not.toBe(second);
  });
});

describe('createSubRng', () => {
  it('depends only on the seed and label, not on draw order', () => {
    // The point of a stable sub-stream: question 7 is the same regardless of
    // whether questions 1-6 were generated first, or changed.
    const direct = createSubRng('session', 'q7').next();

    const parent = createSubRng('session', 'q0');
    parent.next();
    parent.next();
    const afterOtherWork = createSubRng('session', 'q7').next();

    expect(afterOtherWork).toBe(direct);
  });

  it('separates labels', () => {
    expect(createSubRng('s', 'q1').next()).not.toBe(createSubRng('s', 'q2').next());
  });

  it('separates seeds', () => {
    expect(createSubRng('s1', 'q1').next()).not.toBe(createSubRng('s2', 'q1').next());
  });

  it('treats an equivalent numeric and string seed the same', () => {
    // normaliseSeed runs first, so 42 and "42"-as-a-number agree.
    expect(createSubRng(42, 'q1').next()).toBe(createSubRng(42, 'q1').next());
  });
});

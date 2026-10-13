/**
 * The learning engine: how answers turn into progression.
 *
 * Pure functions over stored records — no audio, no storage, no React. The
 * three rules from the spec's "Training method" live one per file: `adaptive`
 * (grow the answer set), `leitner` (bring misses back sooner), `mastery` (level
 * tests and scoring). `progress` composes them.
 */

export * from './adaptive';
export * from './leitner';
export * from './mastery';
export * from './progress';

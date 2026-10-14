/**
 * Keyboard shortcuts for scale-degree answers.
 *
 * The naive mapping — "the nth unlocked button" — breaks down the moment a
 * level puts `b3` and `3` on screen together: the numbers stop meaning anything
 * and the hint has to say something useless like "1-3 answer".
 *
 * So a number key means **that degree as written in the current key**, and
 * Shift means **the altered one**:
 *
 * | Key | In a major key | In a minor key    |
 * | --- | -------------- | ----------------- |
 * | `3` | `3` (Mi)       | `b3` (Me)         |
 * | `6` | `6` (La)       | `b6` (Le)         |
 * | `7` | `7` (Ti)       | `b7` (Te)         |
 * | `⇧3`| `b3` (Me)      | `3` (Mi)          |
 * | `⇧6`| `b6` (Le)      | `6` (La)          |
 * | `⇧7`| `b7` (Te)      | `7` (Ti)          |
 * | `⇧2`| `b2` (Ra)      | `b2` (Ra)         |
 * | `⇧4`| `#4` (Fi)      | `#4` (Fi)         |
 *
 * The rule underneath is "Shift reaches the degree **outside** that key's own
 * scale", which reads as lowering in major and raising in minor wherever both
 * directions exist. Two slots only have one direction available and so go the
 * same way in both modes: `⇧2` is always `b2` (a raised 2 would just be `b3`,
 * which the plain `3` key already answers) and `⇧4` is always `#4`.
 *
 * Both tables cover all twelve degrees with no collisions, which the tests assert.
 */

import { isDegree, type Degree } from '../theory/degrees';
import type { KeyMode } from '../theory/keys';

export interface DegreeShortcut {
  /** The number key, 1-7. */
  number: number;
  /** Whether Shift is part of the chord. */
  shift: boolean;
}

/** The seven degrees a major key writes plainly. */
const MAJOR_PLAIN: Readonly<Record<number, Degree>> = {
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
};

/** Shift in a major key lowers — except `#4`, which has nowhere down to go. */
const MAJOR_SHIFT: Readonly<Record<number, Degree>> = {
  2: 'b2',
  3: 'b3',
  4: '#4',
  6: 'b6',
  7: 'b7',
};

/** The seven degrees a natural minor key writes plainly. */
const MINOR_PLAIN: Readonly<Record<number, Degree>> = {
  1: '1',
  2: '2',
  3: 'b3',
  4: '4',
  5: '5',
  6: 'b6',
  7: 'b7',
};

/** Shift in a minor key raises — and `b2`/`#4` sit outside either scale. */
const MINOR_SHIFT: Readonly<Record<number, Degree>> = {
  2: 'b2',
  3: '3',
  4: '#4',
  6: '6',
  7: '7',
};

function tables(mode: KeyMode) {
  return mode === 'major'
    ? { plain: MAJOR_PLAIN, shifted: MAJOR_SHIFT }
    : { plain: MINOR_PLAIN, shifted: MINOR_SHIFT };
}

/**
 * The degree a key press means, or `null` if that combination is not a
 * shortcut (`⇧1` and `⇧5` have no altered degree to reach).
 */
export function degreeForShortcut(number: number, shift: boolean, mode: KeyMode): Degree | null {
  if (!Number.isInteger(number) || number < 1 || number > 7) return null;
  const { plain, shifted } = tables(mode);
  return (shift ? shifted[number] : plain[number]) ?? null;
}

/** The shortcut that answers a degree, for labelling its button. */
export function shortcutForDegree(degree: string, mode: KeyMode): DegreeShortcut | null {
  if (!isDegree(degree)) return null;
  const { plain, shifted } = tables(mode);

  for (let number = 1; number <= 7; number += 1) {
    if (plain[number] === degree) return { number, shift: false };
  }
  for (let number = 1; number <= 7; number += 1) {
    if (shifted[number] === degree) return { number, shift: true };
  }
  return null;
}

/** `3` or `⇧3`, for the corner of a button. */
export function shortcutLabel(shortcut: DegreeShortcut): string {
  return `${shortcut.shift ? '⇧' : ''}${shortcut.number}`;
}

/**
 * The number behind a `KeyboardEvent.code`, or `null`.
 *
 * Reads `code` rather than `key` because on most layouts Shift+3 arrives as
 * `#` — the digit is only recoverable from the physical key.
 */
export function numberFromKeyCode(code: string): number | null {
  const match = /^(?:Digit|Numpad)([1-7])$/.exec(code);
  return match?.[1] ? Number(match[1]) : null;
}

/** Every shortcut a mode defines, for documentation and tests. */
export function allShortcuts(mode: KeyMode): { degree: Degree; shortcut: DegreeShortcut }[] {
  const { plain, shifted } = tables(mode);
  const out: { degree: Degree; shortcut: DegreeShortcut }[] = [];

  for (let number = 1; number <= 7; number += 1) {
    const degree = plain[number];
    if (degree) out.push({ degree, shortcut: { number, shift: false } });
  }
  for (let number = 1; number <= 7; number += 1) {
    const degree = shifted[number];
    if (degree) out.push({ degree, shortcut: { number, shift: true } });
  }
  return out;
}

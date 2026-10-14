import { describe, expect, it } from 'vitest';

import {
  allShortcuts,
  degreeForShortcut,
  numberFromKeyCode,
  shortcutForDegree,
  shortcutLabel,
} from './degreeShortcuts';
import { levelDegrees } from './scaleDegrees';
import {
  CHROMATIC_DEGREES,
  DEGREE_SEMITONES,
  MAJOR_DEGREES,
  NATURAL_MINOR_DEGREES,
  type Degree,
} from '../theory/degrees';
import type { KeyMode } from '../theory/keys';

const MODES: KeyMode[] = ['major', 'minor'];

describe('a number key means the degree as the key writes it', () => {
  it('maps the plain numbers in a major key', () => {
    expect(degreeForShortcut(1, false, 'major')).toBe('1');
    expect(degreeForShortcut(2, false, 'major')).toBe('2');
    expect(degreeForShortcut(3, false, 'major')).toBe('3');
    expect(degreeForShortcut(4, false, 'major')).toBe('4');
    expect(degreeForShortcut(5, false, 'major')).toBe('5');
    expect(degreeForShortcut(6, false, 'major')).toBe('6');
    expect(degreeForShortcut(7, false, 'major')).toBe('7');
  });

  it('maps the plain numbers in a minor key to the minor scale', () => {
    // The whole point: in minor, 3 is Me, not Mi.
    expect(degreeForShortcut(1, false, 'minor')).toBe('1');
    expect(degreeForShortcut(2, false, 'minor')).toBe('2');
    expect(degreeForShortcut(3, false, 'minor')).toBe('b3');
    expect(degreeForShortcut(4, false, 'minor')).toBe('4');
    expect(degreeForShortcut(5, false, 'minor')).toBe('5');
    expect(degreeForShortcut(6, false, 'minor')).toBe('b6');
    expect(degreeForShortcut(7, false, 'minor')).toBe('b7');
  });

  it('gives each mode its own seven scale degrees', () => {
    const major = [1, 2, 3, 4, 5, 6, 7].map((n) => degreeForShortcut(n, false, 'major'));
    const minor = [1, 2, 3, 4, 5, 6, 7].map((n) => degreeForShortcut(n, false, 'minor'));
    expect(major).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(minor).toEqual(['1', '2', 'b3', '4', '5', 'b6', 'b7']);
  });
});

describe('Shift reaches the altered degree', () => {
  it('lowers in a major key', () => {
    expect(degreeForShortcut(2, true, 'major')).toBe('b2');
    expect(degreeForShortcut(3, true, 'major')).toBe('b3');
    expect(degreeForShortcut(6, true, 'major')).toBe('b6');
    expect(degreeForShortcut(7, true, 'major')).toBe('b7');
  });

  it('raises in a minor key', () => {
    expect(degreeForShortcut(6, true, 'minor')).toBe('6');
    expect(degreeForShortcut(7, true, 'minor')).toBe('7');
    expect(degreeForShortcut(3, true, 'minor')).toBe('3');
  });

  it('gives #4 in both modes, since a tritone has nowhere else to go', () => {
    expect(degreeForShortcut(4, true, 'major')).toBe('#4');
    expect(degreeForShortcut(4, true, 'minor')).toBe('#4');
  });

  it('reaches b2 in both modes — it is outside either scale', () => {
    expect(degreeForShortcut(2, true, 'major')).toBe('b2');
    expect(degreeForShortcut(2, true, 'minor')).toBe('b2');
  });

  it('has nothing for Shift+1 or Shift+5 in either mode', () => {
    for (const mode of MODES) {
      expect(degreeForShortcut(1, true, mode)).toBeNull();
      expect(degreeForShortcut(5, true, mode)).toBeNull();
    }
  });

  it('always lands on a different degree than the unshifted key', () => {
    for (const mode of MODES) {
      for (let number = 1; number <= 7; number += 1) {
        const plain = degreeForShortcut(number, false, mode);
        const shifted = degreeForShortcut(number, true, mode);
        if (shifted !== null) expect(shifted, `${mode} ${number}`).not.toBe(plain);
      }
    }
  });

  it('always moves exactly one semitone', () => {
    for (const mode of MODES) {
      for (let number = 1; number <= 7; number += 1) {
        const plain = degreeForShortcut(number, false, mode);
        const shifted = degreeForShortcut(number, true, mode);
        if (plain === null || shifted === null) continue;

        const delta = DEGREE_SEMITONES[shifted] - DEGREE_SEMITONES[plain];
        expect(Math.abs(delta), `${mode} shift+${number}`).toBe(1);
      }
    }
  });

  it('always lands outside the key’s own scale — that is what Shift means', () => {
    // Which usually reads as "lower in major, raise in minor", but the real rule is
    // reaching the chromatic degree in that slot: Shift+2 in minor is b2 (down),
    // because a raised 2 would just be b3, which the plain 3 key already covers.
    for (const mode of MODES) {
      const scale: readonly Degree[] = mode === 'major' ? MAJOR_DEGREES : NATURAL_MINOR_DEGREES;

      for (let number = 1; number <= 7; number += 1) {
        const shifted = degreeForShortcut(number, true, mode);
        if (shifted === null) continue;
        expect(scale, `${mode} shift+${number} gave ${shifted}`).not.toContain(shifted);
      }
    }
  });

  it('lowers in major and raises in minor wherever both directions exist', () => {
    // The cases the rule was specified with: 3, 6 and 7.
    for (const number of [3, 6, 7]) {
      const majorDelta =
        DEGREE_SEMITONES[degreeForShortcut(number, true, 'major')!] -
        DEGREE_SEMITONES[degreeForShortcut(number, false, 'major')!];
      const minorDelta =
        DEGREE_SEMITONES[degreeForShortcut(number, true, 'minor')!] -
        DEGREE_SEMITONES[degreeForShortcut(number, false, 'minor')!];

      expect(majorDelta, `major shift+${number}`).toBe(-1);
      expect(minorDelta, `minor shift+${number}`).toBe(1);
    }
  });
});

describe('the mapping covers everything without collisions', () => {
  it('reaches all twelve degrees in each mode', () => {
    for (const mode of MODES) {
      const reached = new Set<string>();
      for (let number = 1; number <= 7; number += 1) {
        for (const shift of [false, true]) {
          const degree = degreeForShortcut(number, shift, mode);
          if (degree) reached.add(degree);
        }
      }
      expect([...reached].sort(), mode).toEqual([...CHROMATIC_DEGREES].sort());
    }
  });

  it('never maps two key presses to the same degree', () => {
    for (const mode of MODES) {
      const shortcuts = allShortcuts(mode);
      const degrees = shortcuts.map((entry) => entry.degree);
      expect(new Set(degrees).size, mode).toBe(degrees.length);
      expect(degrees).toHaveLength(12);
    }
  });

  it('rejects numbers off the keypad', () => {
    for (const mode of MODES) {
      for (const number of [0, 8, 9, -1, 1.5, Number.NaN]) {
        expect(degreeForShortcut(number, false, mode), `${mode} ${number}`).toBeNull();
        expect(degreeForShortcut(number, true, mode)).toBeNull();
      }
    }
  });
});

describe('shortcutForDegree', () => {
  it('inverts degreeForShortcut for every degree in both modes', () => {
    for (const mode of MODES) {
      for (const degree of CHROMATIC_DEGREES) {
        const shortcut = shortcutForDegree(degree, mode);
        expect(shortcut, `${mode} ${degree}`).not.toBeNull();
        expect(degreeForShortcut(shortcut!.number, shortcut!.shift, mode)).toBe(degree);
      }
    }
  });

  it('labels the scale degrees without Shift', () => {
    expect(shortcutForDegree('3', 'major')).toEqual({ number: 3, shift: false });
    expect(shortcutForDegree('b3', 'minor')).toEqual({ number: 3, shift: false });
  });

  it('labels the altered degrees with Shift', () => {
    expect(shortcutForDegree('b3', 'major')).toEqual({ number: 3, shift: true });
    expect(shortcutForDegree('3', 'minor')).toEqual({ number: 3, shift: true });
    expect(shortcutForDegree('#4', 'major')).toEqual({ number: 4, shift: true });
  });

  it('returns null for anything that is not a degree', () => {
    expect(shortcutForDegree('P5', 'major')).toBeNull();
    expect(shortcutForDegree('', 'minor')).toBeNull();
    expect(shortcutForDegree('b9', 'major')).toBeNull();
  });
});

describe('shortcutLabel', () => {
  it('writes the plain number bare and the altered one with the Shift glyph', () => {
    expect(shortcutLabel({ number: 3, shift: false })).toBe('3');
    expect(shortcutLabel({ number: 3, shift: true })).toBe('⇧3');
  });
});

describe('numberFromKeyCode', () => {
  it('reads the digit row', () => {
    expect(numberFromKeyCode('Digit1')).toBe(1);
    expect(numberFromKeyCode('Digit7')).toBe(7);
  });

  it('reads the numeric keypad', () => {
    expect(numberFromKeyCode('Numpad4')).toBe(4);
  });

  it('ignores digits with no degree', () => {
    expect(numberFromKeyCode('Digit0')).toBeNull();
    expect(numberFromKeyCode('Digit8')).toBeNull();
    expect(numberFromKeyCode('Digit9')).toBeNull();
  });

  it('ignores everything else', () => {
    expect(numberFromKeyCode('KeyC')).toBeNull();
    expect(numberFromKeyCode('Space')).toBeNull();
    expect(numberFromKeyCode('Enter')).toBeNull();
    expect(numberFromKeyCode('')).toBeNull();
  });

  it('reads the physical key, not the shifted character', () => {
    // Shift+3 arrives as "#" in event.key on a US layout, so the digit is only
    // recoverable from event.code — which is the whole reason this exists.
    expect(numberFromKeyCode('Digit3')).toBe(3);
  });
});

describe('every degree on screen has a shortcut', () => {
  it('holds for all eight levels', () => {
    for (let level = 1; level <= 8; level += 1) {
      const degrees = levelDegrees(level);
      const mode: KeyMode = level === 7 ? 'minor' : 'major';

      for (const degree of degrees) {
        expect(shortcutForDegree(degree, mode), `level ${level} ${degree}`).not.toBeNull();
      }

      // And no two buttons on the same screen share a shortcut.
      const labels = degrees.map((degree) => shortcutLabel(shortcutForDegree(degree, mode)!));
      expect(new Set(labels).size, `level ${level}`).toBe(labels.length);
    }
  });

  it('distinguishes b3 from 3 and b7 from 7 on the chromatic level', () => {
    // Level 6 puts both on screen at once, which is what broke the old
    // "nth unlocked button" mapping.
    const pairs: [Degree, Degree][] = [
      ['b3', '3'],
      ['b7', '7'],
      ['b6', '6'],
    ];
    for (const [altered, plain] of pairs) {
      expect(levelDegrees(6)).toContain(altered);
      expect(levelDegrees(6)).toContain(plain);
      expect(shortcutLabel(shortcutForDegree(altered, 'major')!)).not.toBe(
        shortcutLabel(shortcutForDegree(plain, 'major')!),
      );
    }
  });

  it('distinguishes the minor level’s b6/6 and b7/7 pairs', () => {
    // Level 7 holds b6, 6, b7 and 7 together.
    for (const [plain, altered] of [
      ['b6', '6'],
      ['b7', '7'],
    ] as [Degree, Degree][]) {
      expect(levelDegrees(7)).toContain(plain);
      expect(levelDegrees(7)).toContain(altered);
      expect(shortcutForDegree(plain, 'minor')).toEqual({
        number: altered === '6' ? 6 : 7,
        shift: false,
      });
      expect(shortcutForDegree(altered, 'minor')).toEqual({
        number: altered === '6' ? 6 : 7,
        shift: true,
      });
    }
  });
});

describe('grid ordering', () => {
  it('orders every level by pitch, so minor reads 1 2 b3 4 5 b6 6 b7 7', () => {
    expect(levelDegrees(7)).toEqual(['1', '2', 'b3', '4', '5', 'b6', '6', 'b7', '7']);

    for (let level = 1; level <= 8; level += 1) {
      const semitones = levelDegrees(level).map((degree) => DEGREE_SEMITONES[degree]);
      expect(semitones, `level ${level}`).toEqual([...semitones].sort((a, b) => a - b));
    }
  });
});

import { describe, expect, it } from 'vitest';
import { greetingFor, mockHome } from './home';

describe('greetingFor', () => {
  it('greets by time of day', () => {
    expect(greetingFor(new Date(2026, 9, 12, 7, 0))).toBe('Good morning');
    expect(greetingFor(new Date(2026, 9, 12, 13, 30))).toBe('Good afternoon');
    expect(greetingFor(new Date(2026, 9, 12, 21, 15))).toBe('Good evening');
  });

  it('switches on the hour boundaries', () => {
    expect(greetingFor(new Date(2026, 9, 12, 11, 59))).toBe('Good morning');
    expect(greetingFor(new Date(2026, 9, 12, 12, 0))).toBe('Good afternoon');
    expect(greetingFor(new Date(2026, 9, 12, 17, 59))).toBe('Good afternoon');
    expect(greetingFor(new Date(2026, 9, 12, 18, 0))).toBe('Good evening');
  });
});

describe('mockHome', () => {
  it('covers all five v1 training modes', () => {
    expect(mockHome.skills.map((skill) => skill.mode)).toEqual([
      'scaleDegrees',
      'intervals',
      'chords',
      'progressions',
      'dictation',
    ]);
  });

  it('keeps every progress value in the 0-100 range', () => {
    for (const skill of mockHome.skills) {
      expect(skill.progress).toBeGreaterThanOrEqual(0);
      expect(skill.progress).toBeLessThanOrEqual(100);
    }
  });

  it('matches the spec: the daily challenge is 10 questions', () => {
    expect(mockHome.daily.questionCount).toBe(10);
  });
});

import { describe, expect, it } from 'vitest';

import {
  applyAnswer,
  applyLevelTest,
  isLevelMastered,
  isLevelUnlocked,
  newSkillProgress,
  setLevel,
} from './progress';
import { STARTING_CHOICES } from './adaptive';

const NOW = new Date('2026-10-13T12:00:00.000Z');
const LATER = new Date('2026-10-13T12:30:00.000Z');

function answers(n: number, correct: number, responseMs = 1200) {
  return Array.from({ length: n }, (_, index) => ({
    correct: index < correct,
    responseMs,
  }));
}

describe('newSkillProgress', () => {
  it('starts at level 1 with the first two choices', () => {
    const progress = newSkillProgress('scaleDegrees', NOW);
    expect(progress.level).toBe(1);
    expect(progress.unlockedChoices).toBe(STARTING_CHOICES);
    expect(progress.highestUnlockedLevel).toBe(1);
    expect(progress.masteredLevels).toEqual([]);
  });
});

describe('applyAnswer', () => {
  it('moves the item up a box on a correct answer', () => {
    const result = applyAnswer({
      progress: newSkillProgress('scaleDegrees', NOW),
      stat: null,
      itemKey: 'scaleDegrees:5',
      correct: true,
      answersSinceUnlock: answers(1, 1),
      totalChoices: 7,
      now: NOW,
    });
    expect(result.stat.box).toBe(2);
    expect(result.stat.seen).toBe(1);
    expect(result.unlockedChoice).toBe(false);
  });

  it('creates review state for an item never seen before', () => {
    const result = applyAnswer({
      progress: newSkillProgress('scaleDegrees', NOW),
      stat: null,
      itemKey: 'scaleDegrees:b3',
      correct: false,
      answersSinceUnlock: [],
      totalChoices: 7,
      now: NOW,
    });
    expect(result.stat.itemKey).toBe('scaleDegrees:b3');
    expect(result.stat.box).toBe(1);
  });

  it('earns a choice when the window qualifies', () => {
    const result = applyAnswer({
      progress: newSkillProgress('scaleDegrees', NOW),
      stat: null,
      itemKey: 'scaleDegrees:5',
      correct: true,
      answersSinceUnlock: answers(20, 20, 1000),
      totalChoices: 7,
      now: LATER,
    });
    expect(result.unlockedChoice).toBe(true);
    expect(result.progress.unlockedChoices).toBe(3);
  });

  it('resets the adaptive window when a choice is earned', () => {
    // Otherwise the next choice would ride on the same twenty answers.
    const result = applyAnswer({
      progress: newSkillProgress('scaleDegrees', NOW),
      stat: null,
      itemKey: 'scaleDegrees:5',
      correct: true,
      answersSinceUnlock: answers(20, 20, 1000),
      totalChoices: 7,
      now: LATER,
    });
    expect(result.progress.choicesUnlockedAt).toBe(LATER.toISOString());
  });

  it('leaves the window alone when nothing is earned', () => {
    const start = newSkillProgress('scaleDegrees', NOW);
    const result = applyAnswer({
      progress: start,
      stat: null,
      itemKey: 'scaleDegrees:5',
      correct: true,
      answersSinceUnlock: answers(5, 5),
      totalChoices: 7,
      now: LATER,
    });
    expect(result.progress.choicesUnlockedAt).toBe(start.choicesUnlockedAt);
  });

  it('does not mutate the progress it was given', () => {
    const start = newSkillProgress('scaleDegrees', NOW);
    const snapshot = { ...start };
    applyAnswer({
      progress: start,
      stat: null,
      itemKey: 'scaleDegrees:5',
      correct: true,
      answersSinceUnlock: answers(20, 20, 1000),
      totalChoices: 7,
      now: LATER,
    });
    expect(start).toEqual(snapshot);
  });

  it('never unlocks past the level total over many answers', () => {
    let progress = newSkillProgress('scaleDegrees', NOW);
    for (let i = 0; i < 40; i += 1) {
      const result = applyAnswer({
        progress,
        stat: null,
        itemKey: 'scaleDegrees:1',
        correct: true,
        answersSinceUnlock: answers(20, 20, 800),
        totalChoices: 4,
        now: NOW,
      });
      progress = result.progress;
    }
    expect(progress.unlockedChoices).toBe(4);
  });
});

describe('applyLevelTest', () => {
  it('marks the level mastered and opens the next one on a pass', () => {
    const result = applyLevelTest({
      progress: newSkillProgress('scaleDegrees', NOW),
      level: 1,
      answers: answers(15, 14),
      maxLevel: 8,
      now: NOW,
    });
    expect(result.passed).toBe(true);
    expect(result.progress.masteredLevels).toEqual([1]);
    expect(result.progress.highestUnlockedLevel).toBe(2);
    expect(result.unlockedLevel).toBe(2);
  });

  it('changes nothing on a fail — no demotion, no lost choices', () => {
    const start = {
      ...newSkillProgress('scaleDegrees', NOW),
      unlockedChoices: 5,
      highestUnlockedLevel: 3,
    };
    const result = applyLevelTest({
      progress: start,
      level: 3,
      answers: answers(15, 10),
      maxLevel: 8,
      now: LATER,
    });
    expect(result.passed).toBe(false);
    expect(result.unlockedLevel).toBeNull();
    expect(result.progress.unlockedChoices).toBe(5);
    expect(result.progress.highestUnlockedLevel).toBe(3);
    expect(result.progress.masteredLevels).toEqual([]);
  });

  it('does not lower highestUnlockedLevel when retaking an earlier level', () => {
    const start = {
      ...newSkillProgress('scaleDegrees', NOW),
      highestUnlockedLevel: 5,
      masteredLevels: [1, 2],
    };
    const result = applyLevelTest({
      progress: start,
      level: 1,
      answers: answers(15, 15),
      maxLevel: 8,
      now: NOW,
    });
    expect(result.progress.highestUnlockedLevel).toBe(5);
    expect(result.unlockedLevel).toBeNull();
  });

  it('does not duplicate a level already mastered', () => {
    const start = { ...newSkillProgress('scaleDegrees', NOW), masteredLevels: [1] };
    const result = applyLevelTest({
      progress: start,
      level: 1,
      answers: answers(15, 15),
      maxLevel: 8,
      now: NOW,
    });
    expect(result.progress.masteredLevels).toEqual([1]);
  });

  it('keeps mastered levels sorted', () => {
    let progress = { ...newSkillProgress('scaleDegrees', NOW), masteredLevels: [3] };
    progress = applyLevelTest({
      progress,
      level: 1,
      answers: answers(15, 15),
      maxLevel: 8,
      now: NOW,
    }).progress;
    expect(progress.masteredLevels).toEqual([1, 3]);
  });

  it('stops at the top of the ladder', () => {
    const start = {
      ...newSkillProgress('scaleDegrees', NOW),
      level: 8,
      highestUnlockedLevel: 8,
    };
    const result = applyLevelTest({
      progress: start,
      level: 8,
      answers: answers(15, 15),
      maxLevel: 8,
      now: NOW,
    });
    expect(result.passed).toBe(true);
    expect(result.progress.highestUnlockedLevel).toBe(8);
    expect(result.unlockedLevel).toBeNull();
    expect(result.progress.masteredLevels).toEqual([8]);
  });

  it('climbs the whole ladder with eight passes', () => {
    let progress = newSkillProgress('scaleDegrees', NOW);
    for (let level = 1; level <= 8; level += 1) {
      progress = applyLevelTest({
        progress,
        level,
        answers: answers(15, 15),
        maxLevel: 8,
        now: NOW,
      }).progress;
    }
    expect(progress.highestUnlockedLevel).toBe(8);
    expect(progress.masteredLevels).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('setLevel', () => {
  it('resets choices to the starter count it is handed, not a flat two', () => {
    const start = { ...newSkillProgress('scaleDegrees', NOW), unlockedChoices: 7 };
    const moved = setLevel(start, 6, 8, LATER);
    expect(moved.level).toBe(6);
    expect(moved.unlockedChoices).toBe(8);
    expect(moved.choicesUnlockedAt).toBe(LATER.toISOString());
  });

  it('never drops below the two-choice floor, whatever it is handed', () => {
    const start = newSkillProgress('scaleDegrees', NOW);
    expect(setLevel(start, 4, 0, LATER).unlockedChoices).toBe(STARTING_CHOICES);
    expect(setLevel(start, 4, 1, LATER).unlockedChoices).toBe(STARTING_CHOICES);
  });

  it('is a no-op when already on that level, so progress is not lost', () => {
    const start = { ...newSkillProgress('scaleDegrees', NOW), unlockedChoices: 5 };
    const same = setLevel(start, 1, 2, LATER);
    expect(same).toBe(start);
    expect(same.unlockedChoices).toBe(5);
  });

  it('keeps mastery and unlock history', () => {
    const start = {
      ...newSkillProgress('scaleDegrees', NOW),
      masteredLevels: [1, 2],
      highestUnlockedLevel: 3,
    };
    const moved = setLevel(start, 3, 4, LATER);
    expect(moved.masteredLevels).toEqual([1, 2]);
    expect(moved.highestUnlockedLevel).toBe(3);
  });
});

describe('level gating', () => {
  const progress = {
    ...newSkillProgress('scaleDegrees', NOW),
    highestUnlockedLevel: 3,
    masteredLevels: [1, 2],
  };

  it('reports which levels are unlocked', () => {
    expect(isLevelUnlocked(progress, 1)).toBe(true);
    expect(isLevelUnlocked(progress, 3)).toBe(true);
    expect(isLevelUnlocked(progress, 4)).toBe(false);
  });

  it('reports which levels are mastered', () => {
    expect(isLevelMastered(progress, 2)).toBe(true);
    expect(isLevelMastered(progress, 3)).toBe(false);
  });
});

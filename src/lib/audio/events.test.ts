import { describe, expect, it } from 'vitest';

import {
  concatEvents,
  eventNotes,
  sequenceDuration,
  shiftEvents,
  withInstrument,
  type AudioEvent,
  type NoteEvent,
} from './events';

// Typed as NoteEvent, not AudioEvent, so tests can spread it and add the
// pitched-only fields without TypeScript widening to the whole union.
const note = (name: string, time: number, duration = 1): NoteEvent => ({
  kind: 'note',
  note: name,
  duration,
  time,
});

describe('eventNotes', () => {
  it('collects notes and chord tones in order', () => {
    const events: AudioEvent[] = [
      note('C4', 0),
      { kind: 'chord', notes: ['E4', 'G4'], duration: 1, time: 1 },
      note('B4', 2),
    ];
    expect(eventNotes(events)).toEqual(['C4', 'E4', 'G4', 'B4']);
  });

  it('ignores noise and rests, which have no pitch', () => {
    const events: AudioEvent[] = [
      { kind: 'noise', ms: 300, time: 0 },
      { kind: 'rest', ms: 1500, time: 0.3 },
    ];
    expect(eventNotes(events)).toEqual([]);
  });

  it('returns an empty list for an empty sequence', () => {
    expect(eventNotes([])).toEqual([]);
  });
});

describe('sequenceDuration', () => {
  it('measures to the end of the last event, not its start', () => {
    expect(sequenceDuration([note('C4', 0, 1), note('D4', 2, 0.5)])).toBe(2.5);
  });

  it('handles events that finish out of order', () => {
    // A long early note can outlast a short later one.
    expect(sequenceDuration([note('C4', 0, 5), note('D4', 1, 0.5)])).toBe(5);
  });

  it('converts noise and rest milliseconds to seconds', () => {
    expect(sequenceDuration([{ kind: 'rest', ms: 1500, time: 0 }])).toBe(1.5);
    expect(sequenceDuration([{ kind: 'noise', ms: 400, time: 1 }])).toBe(1.4);
  });

  it('is zero for an empty sequence', () => {
    expect(sequenceDuration([])).toBe(0);
  });
});

describe('shiftEvents', () => {
  it('moves everything by the offset, preserving relative timing', () => {
    const shifted = shiftEvents([note('C4', 0), note('D4', 1)], 2);
    expect(shifted.map((event) => event.time)).toEqual([2, 3]);
  });

  it('does not mutate the input', () => {
    const events = [note('C4', 0)];
    shiftEvents(events, 5);
    expect(events[0]!.time).toBe(0);
  });

  it('keeps every other field', () => {
    const [shifted] = shiftEvents([{ ...note('C4', 0), velocity: 0.5, instrument: 'cello' }], 1);
    expect(shifted).toMatchObject({ note: 'C4', velocity: 0.5, instrument: 'cello', time: 1 });
  });
});

describe('concatEvents', () => {
  it('starts the second sequence after the first finishes', () => {
    const result = concatEvents([note('C4', 0, 1)], [note('D4', 0, 1)]);
    expect(result.map((event) => event.time)).toEqual([0, 1]);
  });

  it('inserts a gap when asked', () => {
    const result = concatEvents([note('C4', 0, 1)], [note('D4', 0, 1)], 0.5);
    expect(result.map((event) => event.time)).toEqual([0, 1.5]);
  });

  it('accounts for a trailing rest in the first sequence', () => {
    const first: AudioEvent[] = [note('C4', 0, 1), { kind: 'rest', ms: 500, time: 1 }];
    const result = concatEvents(first, [note('D4', 0)]);
    expect(result[2]!.time).toBe(1.5);
  });

  it('handles either side being empty', () => {
    expect(concatEvents([], [note('C4', 0)])).toHaveLength(1);
    expect(concatEvents([note('C4', 0)], [])).toHaveLength(1);
    expect(concatEvents([], [])).toEqual([]);
  });
});

describe('withInstrument', () => {
  it('retags pitched events', () => {
    const events: AudioEvent[] = [
      note('C4', 0),
      { kind: 'chord', notes: ['E4'], duration: 1, time: 1 },
    ];
    const retagged = withInstrument(events, 'flute');
    expect(retagged.every((event) => 'instrument' in event && event.instrument === 'flute')).toBe(
      true,
    );
  });

  it('leaves noise and rests untagged, since they have no instrument', () => {
    const retagged = withInstrument([{ kind: 'noise', ms: 300, time: 0 }], 'flute');
    expect(retagged[0]).toEqual({ kind: 'noise', ms: 300, time: 0 });
  });

  it('overrides an instrument that was already set', () => {
    const [event] = withInstrument([{ ...note('C4', 0), instrument: 'piano' }], 'cello');
    expect(event?.kind === 'note' && event.instrument).toBe('cello');
  });

  it('does not mutate the input', () => {
    const events: AudioEvent[] = [note('C4', 0)];
    withInstrument(events, 'flute');
    expect('instrument' in events[0]! && events[0]!.instrument).toBeFalsy();
  });
});

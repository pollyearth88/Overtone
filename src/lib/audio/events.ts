/**
 * The audio event list: a plain-data description of something to play.
 *
 * Questions and cadences are built as `AudioEvent[]` by pure functions in
 * `src/lib/theory` and `src/lib/modes`, then handed to an `AudioEngine`. Keeping
 * them data (rather than engine calls) is what makes question generation
 * testable without a Web Audio context, and what lets the engine be swapped.
 *
 * `time` is always seconds from the start of the sequence, so an event list is
 * self-contained and can be replayed, delayed or concatenated.
 */

import type { InstrumentId } from './instruments';

export interface NoteEvent {
  kind: 'note';
  note: string;
  /** Seconds of sound, before the instrument's release tail. */
  duration: number;
  /** Seconds from the start of the sequence. */
  time: number;
  /** 0-1. Defaults to the engine's default velocity. */
  velocity?: number;
  /** Overrides the engine's current instrument. */
  instrument?: InstrumentId;
}

export interface ChordEvent {
  kind: 'chord';
  notes: string[];
  duration: number;
  time: number;
  velocity?: number;
  instrument?: InstrumentId;
}

/** A short burst of noise, to wipe the pitch memory between questions. */
export interface NoiseEvent {
  kind: 'noise';
  ms: number;
  time: number;
}

/** Silence. Only exists to extend a sequence's duration. */
export interface RestEvent {
  kind: 'rest';
  ms: number;
  time: number;
}

export type AudioEvent = NoteEvent | ChordEvent | NoiseEvent | RestEvent;

/** Every pitch an event list will sound, in the order they appear. */
export function eventNotes(events: readonly AudioEvent[]): string[] {
  const notes: string[] = [];
  for (const event of events) {
    if (event.kind === 'note') notes.push(event.note);
    else if (event.kind === 'chord') notes.push(...event.notes);
  }
  return notes;
}

/** Seconds from the start of the sequence until the last event has finished. */
export function sequenceDuration(events: readonly AudioEvent[]): number {
  let end = 0;
  for (const event of events) {
    const length =
      event.kind === 'note' || event.kind === 'chord' ? event.duration : event.ms / 1000;
    end = Math.max(end, event.time + length);
  }
  return end;
}

/** Moves every event later by `seconds`, preserving relative timing. */
export function shiftEvents(events: readonly AudioEvent[], seconds: number): AudioEvent[] {
  return events.map((event) => ({ ...event, time: event.time + seconds }));
}

/** Plays `b` after `a` finishes, with an optional gap in seconds. */
export function concatEvents(
  a: readonly AudioEvent[],
  b: readonly AudioEvent[],
  gap = 0,
): AudioEvent[] {
  return [...a, ...shiftEvents(b, sequenceDuration(a) + gap)];
}

/** Rewrites every pitched event to play on `instrument`. */
export function withInstrument(
  events: readonly AudioEvent[],
  instrument: InstrumentId,
): AudioEvent[] {
  return events.map((event) =>
    event.kind === 'note' || event.kind === 'chord' ? { ...event, instrument } : { ...event },
  );
}

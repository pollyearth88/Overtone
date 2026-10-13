/**
 * The audio engine contract.
 *
 * One of the three interfaces the spec keeps swappable (the others being the
 * question generators and the data layer). Components and generators only ever
 * see this type, never Tone.js — so the implementation can change without
 * touching anything else.
 */

import type { AudioEvent } from './events';
import type { InstrumentId } from './instruments';

export interface PlayOptions {
  /** Overrides the engine's current instrument for this call only. */
  instrument?: InstrumentId;
  /** 0-1. */
  velocity?: number;
}

export interface AudioEngine {
  /**
   * Starts the audio context. iOS only allows this from inside a user gesture,
   * so it must be called synchronously from a tap handler — in practice the
   * first play button in the UI.
   *
   * Safe to call repeatedly; it resolves immediately once unlocked.
   */
  unlock(): Promise<void>;

  /** Whether the audio context is running. Nothing will sound until it is. */
  isUnlocked(): boolean;

  /**
   * Fetches and decodes an instrument's samples. Called automatically by the
   * play methods, but worth calling ahead of time to avoid a silent first note.
   * Concurrent and repeat calls share one load.
   */
  loadInstrument(id: InstrumentId): Promise<void>;

  isInstrumentLoaded(id: InstrumentId): boolean;

  /** The instrument used when an event or call does not name one. */
  setInstrument(id: InstrumentId): void;
  getInstrument(): InstrumentId;

  /**
   * Plays one note. `when` is seconds from now.
   *
   * Resolves when the note has finished sounding, so sequences can be awaited.
   */
  playNote(note: string, duration: number, when?: number, options?: PlayOptions): Promise<void>;

  /** Plays notes together. `when` is seconds from now. */
  playChord(
    notes: readonly string[],
    duration: number,
    when?: number,
    options?: PlayOptions,
  ): Promise<void>;

  /**
   * Plays a whole event list, using each event's own `time` as an offset from
   * now. Resolves when the last event has finished.
   */
  playSequence(events: readonly AudioEvent[], when?: number): Promise<void>;

  /**
   * A short burst of filtered noise. Played between questions so the previous
   * note can't be used as a pitch reference — the spec's "vary the sound" rule.
   */
  playNoiseBurst(ms: number, when?: number): Promise<void>;

  /** Silences everything immediately and cancels anything scheduled. */
  stopAll(): void;

  /** Master volume, 0-1. */
  setVolume(volume: number): void;
  getVolume(): number;

  /** Releases all audio nodes. For teardown and tests. */
  dispose(): void;
}

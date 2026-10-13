/**
 * `AudioEngine` backed by Tone.js `Sampler`s over real recorded samples.
 *
 * Two things shape this file:
 *
 * 1. **Tone.js is imported lazily.** It touches `window` at module scope, so a
 *    static import would break SSR and would also put ~200 KB of audio code in
 *    the initial bundle for users who never start a drill. The module is
 *    prefetched on construction (client only) so that by the time a user taps
 *    play, `await` on it is a resolved microtask — which matters, because iOS
 *    only honours `AudioContext.resume()` while the user-activation flag is
 *    still set, and a real network round-trip inside the handler would lose it.
 *
 * 2. **Instruments load on first use.** Each `Sampler` is built and fetched the
 *    first time something asks for it, and concurrent requests share one load.
 */

// Type-only import: erased at compile time, so Tone stays out of the bundle
// and off the server. The runtime copy arrives via `import('tone')` below.
import type * as Tone from 'tone';

import { sequenceDuration, type AudioEvent } from './events';
import { DEFAULT_INSTRUMENT, getInstrument, type InstrumentId } from './instruments';
import type { AudioEngine, PlayOptions } from './types';

type ToneModule = typeof Tone;

/** Default note velocity, and the master volume a fresh engine starts at. */
const DEFAULT_VELOCITY = 0.8;
const DEFAULT_VOLUME = 0.8;

/** Noise bursts are a palate cleanser, not an event — keep them well under the music. */
const NOISE_GAIN = 0.07;
const NOISE_CUTOFF_HZ = 2200;

export interface ToneAudioEngineOptions {
  /** Where the sample folders live. */
  baseUrl?: string;
  /** Master volume, 0-1. */
  volume?: number;
  instrument?: InstrumentId;
}

interface LoadedInstrument {
  sampler: Tone.Sampler;
  output: Tone.Volume;
}

export class ToneAudioEngine implements AudioEngine {
  private readonly baseUrl: string;
  private tonePromise: Promise<ToneModule> | null = null;
  private tone: ToneModule | null = null;

  private master: Tone.Volume | null = null;
  private readonly instruments = new Map<InstrumentId, LoadedInstrument>();
  private readonly loading = new Map<InstrumentId, Promise<void>>();

  private current: InstrumentId;
  private volume: number;
  private disposed = false;

  /** Timers backing the promises returned by the play methods. */
  private pending = new Set<{ timer: ReturnType<typeof setTimeout>; resolve: () => void }>();

  constructor(options: ToneAudioEngineOptions = {}) {
    this.baseUrl = options.baseUrl ?? '/samples';
    this.volume = options.volume ?? DEFAULT_VOLUME;
    this.current = options.instrument ?? DEFAULT_INSTRUMENT;

    // Warm the module so `unlock()` does not have to wait on the network.
    if (typeof window !== 'undefined') void this.loadTone();
  }

  private loadTone(): Promise<ToneModule> {
    this.tonePromise ??= import('tone').then((mod) => {
      this.tone = mod;
      return mod;
    });
    return this.tonePromise;
  }

  private async getMaster(): Promise<Tone.Volume> {
    const tone = this.tone ?? (await this.loadTone());
    if (!this.master) {
      this.master = new tone.Volume(this.volumeToDb(this.volume)).toDestination();
    }
    return this.master;
  }

  private volumeToDb(volume: number): number {
    if (volume <= 0) return -Infinity;
    const tone = this.tone;
    const clamped = Math.min(1, volume);
    return tone ? tone.gainToDb(clamped) : 20 * Math.log10(clamped);
  }

  async unlock(): Promise<void> {
    if (this.disposed) return;
    const tone = this.tone ?? (await this.loadTone());
    await tone.start();
    await this.getMaster();
  }

  isUnlocked(): boolean {
    if (!this.tone) return false;
    return this.tone.getContext().state === 'running';
  }

  isInstrumentLoaded(id: InstrumentId): boolean {
    return this.instruments.has(id);
  }

  setInstrument(id: InstrumentId): void {
    this.current = id;
  }

  getInstrument(): InstrumentId {
    return this.current;
  }

  loadInstrument(id: InstrumentId): Promise<void> {
    if (this.instruments.has(id)) return Promise.resolve();

    const existing = this.loading.get(id);
    if (existing) return existing;

    const load = this.buildInstrument(id)
      .then((loaded) => {
        if (this.disposed) {
          loaded.sampler.dispose();
          loaded.output.dispose();
          return;
        }
        this.instruments.set(id, loaded);
      })
      .finally(() => {
        this.loading.delete(id);
      });

    this.loading.set(id, load);
    return load;
  }

  private async buildInstrument(id: InstrumentId): Promise<LoadedInstrument> {
    const tone = this.tone ?? (await this.loadTone());
    const spec = getInstrument(id);
    const master = await this.getMaster();

    const urls: Record<string, string> = {};
    for (const note of spec.samples) {
      // Sampler keys accept scientific pitch; the files spell sharps with "s".
      urls[note] = `${note.replace('#', 's')}.mp3`;
    }

    const output = new tone.Volume(spec.gainDb).connect(master);

    return new Promise<LoadedInstrument>((resolve, reject) => {
      const sampler = new tone.Sampler({
        urls,
        baseUrl: `${this.baseUrl}/${id}/`,
        release: spec.release,
        onload: () => resolve({ sampler, output }),
        onerror: (error: Error) => {
          sampler.dispose();
          output.dispose();
          reject(new Error(`Failed to load samples for "${id}": ${error.message}`));
        },
      }).connect(output);
    });
  }

  private async samplerFor(id: InstrumentId): Promise<Tone.Sampler> {
    await this.loadInstrument(id);
    const loaded = this.instruments.get(id);
    if (!loaded) throw new Error(`Instrument "${id}" is not loaded`);
    return loaded.sampler;
  }

  /**
   * Resolves after `seconds`, or early if `stopAll()` is called. Lets callers
   * `await` playback without leaving a dangling promise when the user bails out
   * of a question.
   */
  private wait(seconds: number): Promise<void> {
    if (seconds <= 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const entry = { resolve, timer: setTimeout(() => {}, 0) };
      entry.timer = setTimeout(() => {
        this.pending.delete(entry);
        resolve();
      }, seconds * 1000);
      this.pending.add(entry);
    });
  }

  async playNote(
    note: string,
    duration: number,
    when = 0,
    options: PlayOptions = {},
  ): Promise<void> {
    if (this.disposed) return;
    const tone = this.tone ?? (await this.loadTone());
    const sampler = await this.samplerFor(options.instrument ?? this.current);
    sampler.triggerAttackRelease(
      note,
      duration,
      tone.now() + when,
      options.velocity ?? DEFAULT_VELOCITY,
    );
    await this.wait(when + duration);
  }

  async playChord(
    notes: readonly string[],
    duration: number,
    when = 0,
    options: PlayOptions = {},
  ): Promise<void> {
    if (this.disposed || notes.length === 0) return;
    const tone = this.tone ?? (await this.loadTone());
    const sampler = await this.samplerFor(options.instrument ?? this.current);
    sampler.triggerAttackRelease(
      [...notes],
      duration,
      tone.now() + when,
      options.velocity ?? DEFAULT_VELOCITY,
    );
    await this.wait(when + duration);
  }

  async playSequence(events: readonly AudioEvent[], when = 0): Promise<void> {
    if (this.disposed || events.length === 0) return;
    const tone = this.tone ?? (await this.loadTone());

    // Load every instrument the sequence needs before scheduling anything, so
    // the timings stay true instead of drifting as samples arrive.
    const needed = new Set<InstrumentId>();
    for (const event of events) {
      if (event.kind === 'note' || event.kind === 'chord') {
        needed.add(event.instrument ?? this.current);
      }
    }
    await Promise.all([...needed].map((id) => this.loadInstrument(id)));
    if (this.disposed) return;

    const start = tone.now() + when;

    for (const event of events) {
      if (event.kind === 'rest') continue;

      if (event.kind === 'noise') {
        this.scheduleNoise(tone, event.ms, start + event.time);
        continue;
      }

      const loaded = this.instruments.get(event.instrument ?? this.current);
      if (!loaded) continue;

      const notes = event.kind === 'note' ? event.note : [...event.notes];
      loaded.sampler.triggerAttackRelease(
        notes,
        event.duration,
        start + event.time,
        event.velocity ?? DEFAULT_VELOCITY,
      );
    }

    await this.wait(when + sequenceDuration(events));
  }

  async playNoiseBurst(ms: number, when = 0): Promise<void> {
    if (this.disposed) return;
    const tone = this.tone ?? (await this.loadTone());
    await this.getMaster();
    this.scheduleNoise(tone, ms, tone.now() + when);
    await this.wait(when + ms / 1000);
  }

  /**
   * Builds a one-shot noise chain and disposes it once it has rung out. Cheap
   * enough to do per burst, and avoids holding an always-on noise source.
   */
  private scheduleNoise(tone: ToneModule, ms: number, at: number): void {
    const master = this.master;
    if (!master) return;

    const seconds = Math.max(0, ms) / 1000;
    const gain = new tone.Gain(NOISE_GAIN).connect(master);
    const filter = new tone.Filter(NOISE_CUTOFF_HZ, 'lowpass').connect(gain);
    const envelope = new tone.AmplitudeEnvelope({
      attack: 0.015,
      decay: 0.01,
      sustain: 1,
      release: 0.06,
    }).connect(filter);
    const noise = new tone.Noise('pink').connect(envelope);

    const tail = 0.2;
    noise.start(at);
    envelope.triggerAttackRelease(seconds, at);
    noise.stop(at + seconds + tail);

    const disposeAt = (at - tone.now() + seconds + tail + 0.1) * 1000;
    setTimeout(
      () => {
        noise.dispose();
        envelope.dispose();
        filter.dispose();
        gain.dispose();
      },
      Math.max(0, disposeAt),
    );
  }

  stopAll(): void {
    const now = this.tone?.now();
    for (const { sampler } of this.instruments.values()) sampler.releaseAll(now);

    // Resolve anything being awaited rather than leaving it hanging.
    for (const entry of this.pending) {
      clearTimeout(entry.timer);
      entry.resolve();
    }
    this.pending.clear();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master) this.master.volume.value = this.volumeToDb(this.volume);
  }

  getVolume(): number {
    return this.volume;
  }

  dispose(): void {
    this.disposed = true;
    this.stopAll();
    for (const { sampler, output } of this.instruments.values()) {
      sampler.dispose();
      output.dispose();
    }
    this.instruments.clear();
    this.master?.dispose();
    this.master = null;
  }
}

let shared: ToneAudioEngine | null = null;

/**
 * The app's one engine. A single audio context is both cheaper and what the
 * browsers want — Safari caps how many you may create per page.
 */
export function getAudioEngine(): ToneAudioEngine {
  shared ??= new ToneAudioEngine();
  return shared;
}

/** Test seam: drops the shared engine so the next call builds a fresh one. */
export function resetAudioEngine(): void {
  shared?.dispose();
  shared = null;
}

'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CheckIcon, PlayIcon, XIcon } from '@/components/ui/icons';
import { getAudioEngine } from '@/lib/audio/ToneAudioEngine';
import { concatEvents, type AudioEvent } from '@/lib/audio/events';
import { ALL_INSTRUMENTS, type InstrumentId } from '@/lib/audio/instruments';
import { scaleDegreesGenerator } from '@/lib/modes/scaleDegrees';
import { REFERENCE_INSTRUMENT } from '@/lib/modes/sound';
import { buildCadence, cadenceChords } from '@/lib/theory/cadence';
import {
  TRIAD_QUALITIES,
  SEVENTH_QUALITIES,
  chordNotes,
  chordSymbol,
  inversionLabel,
  maxInversion,
  type ChordQuality,
  type Inversion,
} from '@/lib/theory/chords';
import { degreeLabel, degreeToNote, degreesForMode, solfege } from '@/lib/theory/degrees';
import { MAJOR_TONICS, MINOR_TONICS, keyLabel, makeKey, type KeyMode } from '@/lib/theory/keys';
import { noteLabel, simplifyNote } from '@/lib/theory/notes';

const CHORD_CHOICES: readonly ChordQuality[] = [...TRIAD_QUALITIES, ...SEVENTH_QUALITIES];

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function SoundLab() {
  const [instrument, setInstrument] = useState<InstrumentId>('piano');
  const [mode, setMode] = useState<KeyMode>('major');
  const [tonic, setTonic] = useState<string>('C');
  const [octave, setOctave] = useState(4);
  const [quality, setQuality] = useState<ChordQuality>('maj');
  const [inversion, setInversion] = useState<Inversion>(0);
  const [volume, setVolume] = useState(0.8);

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastPlayed, setLastPlayed] = useState<string | null>(null);
  // Mirrored into state rather than read from the engine during render: the
  // engine is mutable and impure, so asking it questions mid-render is exactly
  // what the React Compiler rules forbid.
  const [unlocked, setUnlocked] = useState(false);
  const [loaded, setLoaded] = useState<readonly InstrumentId[]>([]);
  const [questionSeed, setQuestionSeed] = useState(0);

  const tonics = mode === 'major' ? MAJOR_TONICS : MINOR_TONICS;
  const key = makeKey(tonics.includes(tonic) ? tonic : (tonics[0] ?? 'C'), mode);
  const degrees = degreesForMode(mode);

  useEffect(() => () => getAudioEngine().stopAll(), []);

  /**
   * Every control routes through here. The `unlock()` happens inside the tap
   * that triggered it — that is the iOS rule the whole engine is shaped around,
   * and this page is where it gets exercised first.
   */
  const play = useCallback(
    async (label: string, events: AudioEvent[], instruments: readonly InstrumentId[]) => {
      const engine = getAudioEngine();
      setError(null);
      setLastPlayed(label);
      try {
        await engine.unlock();
        setUnlocked(engine.isUnlocked());

        const missing = instruments.filter((id) => !engine.isInstrumentLoaded(id));
        if (missing.length > 0) {
          setStatus('loading');
          await Promise.all(missing.map((id) => engine.loadInstrument(id)));
        }
        setLoaded(ALL_INSTRUMENTS.filter((s) => engine.isInstrumentLoaded(s.id)).map((s) => s.id));
        setStatus('ready');

        engine.stopAll();
        await engine.playSequence(events);
      } catch (cause) {
        setStatus('error');
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [],
  );

  const playCadence = () =>
    play(`Cadence in ${keyLabel(key)}`, buildCadence(key, { instrument: REFERENCE_INSTRUMENT }), [
      REFERENCE_INSTRUMENT,
    ]);

  const playDegree = (degreeIndex: number) => {
    const degree = degrees[degreeIndex];
    if (!degree) return;
    const note = degreeToNote(key, degree, octave);
    return play(
      `${degreeLabel(degree)} — ${solfege(degree)} — ${noteLabel(note)}`,
      [{ kind: 'note', note, duration: 1.4, time: 0, instrument }],
      [instrument],
    );
  };

  /** Cadence, then the degree — the real shape of a scale-degree question. */
  const playDegreeInContext = (degreeIndex: number) => {
    const degree = degrees[degreeIndex];
    if (!degree) return;
    const note = degreeToNote(key, degree, octave);
    const events = concatEvents(
      buildCadence(key, { instrument: REFERENCE_INSTRUMENT }),
      [{ kind: 'note', note, duration: 1.4, time: 0, instrument }],
      0.2,
    );
    return play(`Cadence then ${degreeLabel(degree)} (${noteLabel(note)})`, events, [
      REFERENCE_INSTRUMENT,
      instrument,
    ]);
  };

  const playScale = () => {
    const events: AudioEvent[] = degrees.map((degree, index) => ({
      kind: 'note',
      note: degreeToNote(key, degree, octave),
      duration: 0.55,
      time: index * 0.45,
      instrument,
    }));
    // Finish on the octave so it resolves.
    events.push({
      kind: 'note',
      note: degreeToNote(key, '1', octave + 1),
      duration: 0.9,
      time: degrees.length * 0.45,
      instrument,
    });
    return play(`${keyLabel(key)} scale`, events, [instrument]);
  };

  const playChord = () => {
    const notes = chordNotes({ root: key.tonic, quality, octave, inversion });
    return play(
      `${chordSymbol(key.tonic, quality)} — ${inversionLabel(inversion)} — ${notes.map(simplifyNote).join(' ')}`,
      [{ kind: 'chord', notes, duration: 1.8, time: 0, instrument }],
      [instrument],
    );
  };

  const playArpeggio = () => {
    const notes = chordNotes({ root: key.tonic, quality, octave, inversion });
    const events: AudioEvent[] = notes.map((note, index) => ({
      kind: 'note',
      note,
      duration: 0.6,
      time: index * 0.32,
      instrument,
    }));
    return play(`${chordSymbol(key.tonic, quality)} arpeggiated`, events, [instrument]);
  };

  const playNoise = () => play('Noise burst', [{ kind: 'noise', ms: 400, time: 0 }], []);

  /**
   * One real generated question, to hear the contract end to end. The seed is a
   * counter rather than a clock, so repeated presses walk a reproducible list —
   * handy when something sounds wrong and you want to hear it again.
   */
  const playGeneratedQuestion = () => {
    setQuestionSeed(questionSeed + 1);
    const [question] = scaleDegreesGenerator.generate({
      seed: `lab-${questionSeed}`,
      level: 4, // all seven major degrees, one octave
      count: 1,
      settings: { instruments: [instrument], fixedKey: key },
    }).questions;

    if (!question) return;
    const events = concatEvents(question.reference, question.audio, 0.2);
    return play(
      `Generated: degree ${question.correctChoiceId} in ${keyLabel(question.voicing.key)} on ${question.voicing.instrument}`,
      events,
      [REFERENCE_INSTRUMENT, question.voicing.instrument],
    );
  };

  const changeVolume = (next: number) => {
    setVolume(next);
    getAudioEngine().setVolume(next);
  };

  const chordPreview = chordNotes({ root: key.tonic, quality, octave, inversion })
    .map(simplifyNote)
    .map(noteLabel)
    .join(' · ');

  return (
    <main id="main" className="pt-2 pb-4">
      <h1 className="text-2xl font-semibold tracking-tight">Sound lab</h1>
      <p className="text-muted mt-1 text-sm">
        Phase 2 bench — audition instruments, cadences, degrees and chords. Not linked from the app.
      </p>

      <Card className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted font-mono text-xs tracking-wide uppercase">Status</span>
          <StatusChip status={status} unlocked={unlocked} />
        </div>
        {lastPlayed && (
          <p className="mt-2 font-mono text-xs break-words" aria-live="polite">
            {lastPlayed}
          </p>
        )}
        {error && (
          <p className="text-danger mt-2 flex items-start gap-1.5 text-xs" role="alert">
            <XIcon className="mt-0.5 size-3.5 shrink-0" />
            <span className="break-words">{error}</span>
          </p>
        )}
      </Card>

      <Section title="Instrument">
        <div className="flex flex-wrap gap-2">
          {ALL_INSTRUMENTS.map((spec) => (
            <Button
              key={spec.id}
              variant={instrument === spec.id ? 'primary' : 'outline'}
              onClick={() => setInstrument(spec.id)}
              aria-pressed={instrument === spec.id}
            >
              {spec.label}
            </Button>
          ))}
        </div>
        <p className="text-muted mt-2 font-mono text-xs">
          range {instrumentRangeLabel(instrument)} · loaded: {loaded.length}/
          {ALL_INSTRUMENTS.length}
        </p>
      </Section>

      <Section title="Key">
        <div className="flex gap-2">
          {(['major', 'minor'] as const).map((value) => (
            <Button
              key={value}
              variant={mode === value ? 'primary' : 'outline'}
              onClick={() => {
                setMode(value);
                const next = value === 'major' ? MAJOR_TONICS : MINOR_TONICS;
                if (!next.includes(tonic)) setTonic(next[0] ?? 'C');
              }}
              aria-pressed={mode === value}
            >
              {value}
            </Button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-6 gap-2">
          {tonics.map((value) => (
            <Button
              key={value}
              variant={key.tonic === value ? 'primary' : 'outline'}
              className="px-0 font-mono"
              onClick={() => setTonic(value)}
              aria-pressed={key.tonic === value}
              aria-label={`Key of ${value}`}
            >
              {noteLabel(value)}
            </Button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-muted font-mono text-xs">octave</span>
          {[3, 4, 5].map((value) => (
            <Button
              key={value}
              variant={octave === value ? 'primary' : 'outline'}
              className="font-mono"
              onClick={() => setOctave(value)}
              aria-pressed={octave === value}
              aria-label={`Octave ${value}`}
            >
              {value}
            </Button>
          ))}
        </div>

        <p className="text-muted mt-2 font-mono text-xs">
          {keyLabel(key)} · cadence{' '}
          {cadenceChords(key)
            .map((chord) => chord.symbol)
            .join(' – ')}
        </p>
      </Section>

      <Section title="Cadence and scale">
        <div className="flex flex-wrap gap-2">
          <Button onClick={playCadence}>
            <PlayIcon className="size-4" /> Cadence
          </Button>
          <Button variant="outline" onClick={playScale}>
            Scale up
          </Button>
          <Button variant="outline" onClick={playGeneratedQuestion}>
            Generated question
          </Button>
          <Button variant="outline" onClick={playNoise}>
            Noise burst
          </Button>
        </div>
        <p className="text-muted mt-2 text-xs">
          The cadence always plays on the {REFERENCE_INSTRUMENT}; only the question rotates.
        </p>
      </Section>

      <Section title="Scale degrees">
        <div className="grid grid-cols-4 gap-2">
          {degrees.map((degree, index) => (
            <Button
              key={degree}
              variant="outline"
              className="h-auto flex-col gap-0.5 py-2"
              onClick={() => playDegree(index)}
              aria-label={`Play degree ${degree}, ${solfege(degree)}`}
            >
              <span className="font-mono text-base">{degreeLabel(degree)}</span>
              <span className="text-muted text-[11px]">{solfege(degree)}</span>
              <span className="text-muted font-mono text-[10px]">
                {noteLabel(simplifyNote(degreeToNote(key, degree, octave)))}
              </span>
            </Button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-4 gap-2">
          {degrees.map((degree, index) => (
            <Button
              key={degree}
              variant="ghost"
              className="px-0 font-mono text-xs"
              onClick={() => playDegreeInContext(index)}
              aria-label={`Play cadence then degree ${degree}`}
            >
              +{degreeLabel(degree)}
            </Button>
          ))}
        </div>
        <p className="text-muted mt-1 text-xs">
          Top row plays the degree alone. Bottom row plays the cadence first — that is what a real
          question sounds like.
        </p>
      </Section>

      <Section title="Chords">
        <div className="grid grid-cols-3 gap-2">
          {CHORD_CHOICES.map((value) => (
            <Button
              key={value}
              variant={quality === value ? 'primary' : 'outline'}
              className="px-0 font-mono text-xs"
              onClick={() => {
                setQuality(value);
                if (inversion > maxInversion(value)) setInversion(0);
              }}
              aria-pressed={quality === value}
            >
              {value}
            </Button>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-muted font-mono text-xs">inv</span>
          {Array.from({ length: maxInversion(quality) + 1 }, (_, index) => index as Inversion).map(
            (value) => (
              <Button
                key={value}
                variant={inversion === value ? 'primary' : 'outline'}
                className="font-mono"
                onClick={() => setInversion(value)}
                aria-pressed={inversion === value}
                aria-label={inversionLabel(value)}
              >
                {value}
              </Button>
            ),
          )}
        </div>

        <p className="text-muted mt-2 font-mono text-xs">
          {chordSymbol(key.tonic, quality)} · {chordPreview}
        </p>

        <div className="mt-2 flex gap-2">
          <Button onClick={playChord}>
            <PlayIcon className="size-4" /> Chord
          </Button>
          <Button variant="outline" onClick={playArpeggio}>
            Arpeggiate
          </Button>
        </div>
      </Section>

      <Section title="Volume">
        <label className="flex items-center gap-3">
          <span className="text-muted font-mono text-xs">{Math.round(volume * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => changeVolume(Number(event.target.value))}
            className="accent-primary h-11 flex-1"
            aria-label="Master volume"
          />
        </label>
        <Button variant="outline" className="mt-2" onClick={() => getAudioEngine().stopAll()}>
          Stop all
        </Button>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="text-muted mb-2 font-mono text-xs tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  );
}

function StatusChip({ status, unlocked }: { status: Status; unlocked: boolean }) {
  if (status === 'error') {
    return (
      <Chip className="bg-danger-tint text-danger">
        <XIcon className="size-3" /> error
      </Chip>
    );
  }
  if (status === 'loading') return <Chip>loading samples…</Chip>;
  if (status === 'ready' && unlocked) {
    return (
      <Chip className="bg-success-tint text-success">
        <CheckIcon className="size-3" /> ready
      </Chip>
    );
  }
  return <Chip>tap to start audio</Chip>;
}

function instrumentRangeLabel(id: InstrumentId): string {
  const spec = ALL_INSTRUMENTS.find((candidate) => candidate.id === id);
  return spec ? `${noteLabel(spec.range.low)}–${noteLabel(spec.range.high)}` : '';
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { getAudioEngine } from '@/lib/audio/ToneAudioEngine';
import { concatEvents, type AudioEvent } from '@/lib/audio/events';
import { REFERENCE_INSTRUMENT } from '@/lib/modes/sound';
import { buildKeyReference, levelDegrees, levelSpec } from '@/lib/modes/scaleDegrees';
import { DEGREE_FEEL, degreeLabel, degreeToNote, solfege, type Degree } from '@/lib/theory/degrees';
import { MAJOR_KEYS, MINOR_KEYS, keyLabel, type Key } from '@/lib/theory/keys';
import { createRng } from '@/lib/rng';
import { noteLabel, simplifyNote } from '@/lib/theory/notes';

export interface ListenModeProps {
  level: number;
}

/** Octave the tonic sits in. Comfortable for every instrument we ship. */
const TONIC_OCTAVE = 4;
const NOTE_DURATION = 1.3;
/** Breathing room between the label appearing and the next item. */
const GAP_MS = 900;

interface Step {
  degree: Degree;
  key: Key;
  note: string;
  /** Whether this step re-establishes the key first. */
  withCadence: boolean;
}

/**
 * Listen mode: hands-free, labelled exposure.
 *
 * > A hands-free "just listen" mode plays labelled examples, because practice
 * > plus passive listening beat practice alone in a 2018 study.
 *
 * The label is shown *before* the note sounds, not after — this is exposure,
 * not a quiz, and the point is to hear "this is what 6 sounds like" rather than
 * to guess and check.
 */
export function ListenMode({ level }: ListenModeProps) {
  const spec = levelSpec(level);
  const degrees = levelDegrees(level);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [cycle, setCycle] = useState(0);

  // `playing` is read inside an async loop that outlives a render, so the loop
  // reads the ref while the UI reads the state.
  const playingRef = useRef(false);
  const keyRef = useRef<Key | null>(null);

  useEffect(
    () => () => {
      playingRef.current = false;
      getAudioEngine().stopAll();
    },
    [],
  );

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    getAudioEngine().stopAll();
    setStep(null);
  }, []);

  const run = useCallback(async () => {
    const engine = getAudioEngine();
    playingRef.current = true;
    setPlaying(true);

    try {
      await engine.unlock();
      await engine.loadInstrument(REFERENCE_INSTRUMENT);

      const keys = spec.keys.length > 0 ? spec.keys : [...MAJOR_KEYS, ...MINOR_KEYS];
      const rng = createRng(`listen-${level}-${cycle}`);

      let pass = 0;
      while (playingRef.current) {
        // A fresh key every pass through the degrees, so the ear is following
        // function rather than memorising absolute pitches.
        const key = keys[pass % keys.length] ?? keys[0];
        if (!key) break;
        keyRef.current = key;

        // Recomputed here rather than closed over: a fresh array each render
        // would make this callback unstable and restart the loop.
        const order = rng.shuffle(levelDegrees(level));

        for (let i = 0; i < order.length; i += 1) {
          if (!playingRef.current) break;
          const degree = order[i];
          if (!degree) continue;

          const note = degreeToNote(key, degree, TONIC_OCTAVE);
          const withCadence = i === 0;

          setStep({ degree, key, note, withCadence });

          const target: AudioEvent[] = [
            {
              kind: 'note',
              note,
              duration: NOTE_DURATION,
              time: 0,
              instrument: REFERENCE_INSTRUMENT,
            },
          ];

          const events = withCadence ? concatEvents(buildKeyReference(key), target, 0.25) : target;

          await engine.playSequence(events);
          if (!playingRef.current) break;
          await new Promise((resolve) => setTimeout(resolve, GAP_MS));
        }

        pass += 1;
      }
    } catch {
      // Losing audio should stop the loop quietly, not throw into the UI.
    } finally {
      playingRef.current = false;
      setPlaying(false);
    }
  }, [spec, level, cycle]);

  const togglePlay = () => {
    if (playing) {
      stop();
      setCycle((value) => value + 1);
    } else {
      void run();
    }
  };

  return (
    <main id="main" className="flex flex-col gap-5 pt-2">
      <header>
        <p className="text-muted font-mono text-xs tracking-wide uppercase">
          Listen · level {level}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Just listen</h1>
        <p className="text-muted mt-1 text-sm">
          Labelled degrees, hands-free. Passive listening alongside practice beats practice alone —
          put it on while you do something else.
        </p>
      </header>

      <Card className="flex min-h-44 flex-col items-center justify-center gap-2 text-center">
        {step ? (
          <>
            <p className="font-mono text-5xl leading-none font-medium">
              {degreeLabel(step.degree)}
            </p>
            <p className="text-lg">{solfege(step.degree)}</p>
            <p className="text-muted font-mono text-xs">
              {noteLabel(simplifyNote(step.note))} · {keyLabel(step.key)}
            </p>
            <p className="text-muted mt-1 max-w-xs text-sm">{DEGREE_FEEL[step.degree]}</p>
          </>
        ) : (
          <p className="text-muted text-sm">
            {playing ? 'Setting the key…' : 'Press play to start listening.'}
          </p>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Chip>{spec.label}</Chip>
        <Chip>{degrees.length} degrees</Chip>
        {step?.withCadence ? <Chip tone="accent">cadence</Chip> : null}
      </div>

      <Button size="lg" fullWidth onClick={togglePlay}>
        {playing ? 'Stop' : 'Play'}
      </Button>

      <Link
        href="/learn"
        className="text-muted rounded-control hover:bg-track/60 flex min-h-11 items-center justify-center text-sm"
      >
        Back to Learn
      </Link>
    </main>
  );
}

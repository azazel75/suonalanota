/**
 * :Project:  suona-la-nota -- what the listening does with a signal we control
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * Synthetic signals, for the same reason as tests/detect.test.ts: a microphone
 * is not available to a test runner. What is checked here is the bookkeeping of
 * the listener — when a colpo is read, what it carries, what is kept out — and
 * not the acoustics, which are the spike's job.
 *
 * These tests also say the module has no page under it: they run in node, where
 * there is no DOM to touch and no microphone to ask.
 */
import { describe, expect, test } from 'vitest';

import { rms, toDecibels } from '../src/audio/fft';
import {
  ANALYSIS_INTERVAL_MS,
  DB_FLOOR,
  FFT_SIZE,
  ONSET_WINDOW,
  createListener,
  measureFrame,
  type Listener,
  type ListenerFrame,
} from '../src/audio/listener';
import { midiToHz } from '../src/audio/notes';

const SAMPLE_RATE = 48_000;
const A4 = 69;

interface Partial {
  hz: number;
  amplitude: number;
}

/** A sum of sinusoids, the shape a struck string starts from. */
function synthesise(partials: Partial[], length = FFT_SIZE): Float32Array {
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    let value = 0;
    for (const partial of partials) {
      value += partial.amplitude * Math.sin((2 * Math.PI * partial.hz * index) / SAMPLE_RATE);
    }
    samples[index] = value;
  }
  return samples;
}

function pianoTone(midi: number, count = 8): Partial[] {
  return Array.from({ length: count }, (_, index) => ({
    hz: midiToHz(midi) * (index + 1),
    amplitude: 1 / (index + 1),
  }));
}

function silence(length = FFT_SIZE): Float32Array {
  return new Float32Array(length);
}

/** Feed the same buffer for `frames` frames, one ANALYSIS_INTERVAL_MS apart. */
function feed(
  listener: Listener,
  samples: Float32Array,
  frames: number,
  fromMs: number,
): ListenerFrame[] {
  const heard: ListenerFrame[] = [];
  for (let index = 0; index < frames; index++) {
    heard.push(listener.push(samples, SAMPLE_RATE, fromMs + index * ANALYSIS_INTERVAL_MS));
  }
  return heard;
}

/** A room that has been quiet long enough for the onset detector to trust its median. */
function arm(listener: Listener): void {
  feed(listener, silence(), 10, 0);
}

function colpiOf(frames: ListenerFrame[]) {
  return frames.flatMap((frame) => frame.colpi);
}

describe('one frame of the microphone', () => {
  test('reads the level, both spectra and the key', () => {
    const samples = synthesise(pianoTone(A4));
    const measurement = measureFrame(samples, SAMPLE_RATE, { withPitch: true });

    expect(measurement.detection.best.midi).toBe(A4);
    expect(measurement.spectrum.length).toBe(FFT_SIZE / 2);
    // The attack is heard on its own window: 43 ms, not the 341 ms of the pitch.
    expect(measurement.attackSpectrum.length).toBe(ONSET_WINDOW / 2);
    expect(measurement.levelDb).toBeCloseTo(toDecibels(rms(samples), DB_FLOOR), 9);
  });

  test('silence has a level, not an infinity', () => {
    const measurement = measureFrame(silence(), SAMPLE_RATE, { withPitch: true });
    expect(measurement.levelDb).toBe(DB_FLOOR);
  });

  test('a frame that does not pay for the pitch still hears the attack', () => {
    // The probes read the short window on every frame and the long one every
    // other frame: the expensive half has to be askable.
    const measurement = measureFrame(synthesise(pianoTone(A4)), SAMPLE_RATE, { withPitch: false });
    expect(measurement.spectrum).toBeNull();
    expect(measurement.detection).toBeNull();
    expect(measurement.attackSpectrum.length).toBe(ONSET_WINDOW / 2);
  });
});

describe('the listener', () => {
  test('reads the pitch after the note has settled, and stamps the attack', () => {
    const listener = createListener();
    arm(listener);

    const tone = synthesise(pianoTone(A4));
    const attack = listener.push(tone, SAMPLE_RATE, 400);
    expect(attack.struck).toBe(true);
    expect(attack.reading).toBe(true);
    // The long window is still filling with the silence before the attack.
    expect(attack.colpi).toHaveLength(0);

    const later = feed(listener, tone, 5, 440);
    const colpi = colpiOf(later);
    expect(colpi).toHaveLength(1);
    expect(colpi[0].midi).toBe(A4);
    expect(colpi[0].at).toBe(400);
    expect(colpi[0].credibility).toBeGreaterThan(1);
    expect(colpi[0].levelDb).toBeLessThan(0);
    expect(colpi[0].levelDb).toBeGreaterThan(DB_FLOOR);
  });

  test('a key held down is one colpo, not one per frame', () => {
    const listener = createListener();
    arm(listener);
    const tone = synthesise(pianoTone(A4));
    listener.push(tone, SAMPLE_RATE, 400);
    expect(colpiOf(feed(listener, tone, 25, 440))).toHaveLength(1);
  });

  test('below the gate a colpo is noise and does not enter', () => {
    const listener = createListener({ minCredibility: 1e9 });
    arm(listener);
    const tone = synthesise(pianoTone(A4));
    listener.push(tone, SAMPLE_RATE, 400);
    expect(colpiOf(feed(listener, tone, 5, 440))).toHaveLength(0);

    // The measure button is a deliberate act: it does not ask the gate.
    const colpo = listener.capture(600);
    expect(colpo).not.toBeNull();
    expect(colpo?.midi).toBe(A4);
    expect(colpo?.credibility).toBeLessThan(1e9);
  });

  test('there is nothing to capture before the first frame', () => {
    expect(createListener().capture(0)).toBeNull();
  });

  test('a colpo keeps a key the exercise range allows, and no other', () => {
    const listener = createListener({ lowMidi: 48, highMidi: 72 });
    arm(listener);
    const tone = synthesise(pianoTone(30));
    listener.push(tone, SAMPLE_RATE, 400);
    const colpi = colpiOf(feed(listener, tone, 5, 440));

    expect(colpi).toHaveLength(1);
    expect(colpi[0].midi).toBeGreaterThanOrEqual(48);
    expect(colpi[0].midi).toBeLessThanOrEqual(72);
  });

  test('dropping a pending colpo means nothing of the old sound is judged', () => {
    const listener = createListener();
    arm(listener);
    const tone = synthesise(pianoTone(A4));
    listener.push(tone, SAMPLE_RATE, 400);
    expect(listener.pending).toBe(true);

    listener.clearPending();
    expect(listener.pending).toBe(false);
    expect(colpiOf(feed(listener, tone, 5, 440))).toHaveLength(0);
  });

  test('a new range is a new search: the onset and the stability start over', () => {
    const listener = createListener({ lowMidi: 35, highMidi: 86 });
    arm(listener);
    const tone = synthesise(pianoTone(A4));
    const attack = listener.push(tone, SAMPLE_RATE, 400);
    expect(attack.stability).toBe(1);

    listener.setRange(48, 72);
    expect(listener.range).toEqual({ low: 48, high: 72 });
    expect(listener.push(tone, SAMPLE_RATE, 440).stability).toBe(1);
  });
});

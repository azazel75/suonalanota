/**
 * :Project:  suona-la-nota -- what the detector does with a signal we control
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * Synthetic signals, because a microphone is not available to a test runner:
 * what is checked here is the arithmetic of the harmonic sum and of the onset
 * detector, not the acoustics of a room. The acoustics are the spike's job.
 */
import { describe, expect, test } from 'vitest';

import { analyseSpectrum, isOctaveApart } from '../src/audio/detect';
import { amplitudeSpectrum, rms, toDecibels } from '../src/audio/fft';
import { createOnsetDetector, median, spectralFlux } from '../src/audio/onset';
import { midiToHz, midiToName, HIGHEST_MIDI, LOWEST_MIDI } from '../src/audio/notes';

const SAMPLE_RATE = 48_000;
const FFT_SIZE = 16_384;
const MIDDLE_C = 60;
const A4 = 69;
const A2 = 45;

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

interface ToneOptions {
  /** Amplitude of k = 1. Below ~0.3 is the bass of a real piano. */
  fundamental?: number;
  count?: number;
  /** String stiffness: stretches the partials sharp, as a piano does. */
  inharmonicity?: number;
  /** Detuning in cents, as a school piano that nobody has tuned. */
  cents?: number;
}

function pianoTone(midi: number, options: ToneOptions = {}): Partial[] {
  const fundamental = options.fundamental ?? 1;
  const count = options.count ?? 8;
  const stiffness = options.inharmonicity ?? 0;
  const stretch = Math.pow(2, (options.cents ?? 0) / 1200);
  const f0 = midiToHz(midi) * stretch;

  const partials: Partial[] = [];
  for (let k = 1; k <= count; k++) {
    const hz = k * f0 * Math.sqrt(1 + stiffness * k * k);
    partials.push({ hz, amplitude: k === 1 ? fundamental : 1 / k });
  }
  return partials;
}

function detect(partials: Partial[]) {
  return analyseSpectrum(amplitudeSpectrum(synthesise(partials)), SAMPLE_RATE);
}

describe('the harmonic sum', () => {
  test('reads back the note that was played', () => {
    const detection = detect(pianoTone(A4));
    expect(detection.best.midi).toBe(A4);
    expect(midiToName(detection.best.midi)).toBe('A4');
  });

  test('reads the bass even when the fundamental is weaker than the second partial', () => {
    const detection = detect(pianoTone(A2, { fundamental: 0.15 }));
    expect(detection.best.midi).toBe(A2);
  });

  test('survives the stretched partials of a real string', () => {
    const detection = detect(pianoTone(MIDDLE_C, { inharmonicity: 0.0004 }));
    expect(detection.best.midi).toBe(MIDDLE_C);
  });

  test('survives a piano tuned 30 cents flat', () => {
    const detection = detect(pianoTone(A4, { cents: -30 }));
    expect(detection.best.midi).toBe(A4);
  });

  test('canary: the octave below stays within a few dB, so the margin is the number to watch', () => {
    // Not an assertion of correctness: a measurement. Every note's partials are
    // the even partials of the note an octave below it, so the runner-up is
    // structurally close, and a quiet room is what keeps the two apart.
    const detection = detect(pianoTone(A2, { fundamental: 0.15 }));
    const octave = detection.best.midi - 12;
    expect(isOctaveApart(octave, detection.best.midi)).toBe(true);
    expect(detection.octaveMarginDb).toBeLessThan(10);
    expect(detection.octaveMarginDb).toBeGreaterThan(0);
  });

  test('a silent room produces no score worth reading', () => {
    const silence = synthesise([], FFT_SIZE);
    const detection = analyseSpectrum(amplitudeSpectrum(silence), SAMPLE_RATE);
    expect(detection.best.score).toBeLessThan(1e-4);
    expect(toDecibels(rms(silence))).toBe(-120);
  });

  test('covers the whole keyboard of the piano', () => {
    for (const midi of [LOWEST_MIDI, 45, 60, 84, HIGHEST_MIDI]) {
      const detection = detect(pianoTone(midi, { count: 6 }));
      expect(detection.best.midi).toBe(midi);
    }
  });
});

describe('the onset detector', () => {
  test('an attack after a silent room is an attack', () => {
    const detector = createOnsetDetector();
    const silence = amplitudeSpectrum(synthesise([], 4096));
    const note = amplitudeSpectrum(synthesise(pianoTone(A4), 4096));

    let armedAfter = 0;
    for (let frame = 0; frame < 12; frame++) {
      if (!detector.push(silence, frame * 40)) armedAfter++;
    }
    expect(armedAfter).toBe(12);

    expect(detector.push(note, 12 * 40)).toBe(true);
  });

  test('a sustained note is not a second attack', () => {
    const detector = createOnsetDetector({ cooldownMs: 0 });
    const silence = amplitudeSpectrum(synthesise([], 4096));
    const note = amplitudeSpectrum(synthesise(pianoTone(A4), 4096));

    for (let frame = 0; frame < 12; frame++) detector.push(silence, frame * 40);
    expect(detector.push(note, 480)).toBe(true);
    let extra = 0;
    for (let frame = 1; frame < 10; frame++) {
      if (detector.push(note, 480 + frame * 40)) extra++;
    }
    expect(extra).toBe(0);
  });

  test('two attacks on the same key are two attacks', () => {
    const detector = createOnsetDetector({ cooldownMs: 0 });
    const silence = amplitudeSpectrum(synthesise([], 4096));
    const note = amplitudeSpectrum(synthesise(pianoTone(A4), 4096));
    // A release is not an attack: what a second strike looks like is a decayed
    // spectrum that rises again, not a note that stops.
    const decayed = Float32Array.from(note, (value) => value * 0.25);

    for (let frame = 0; frame < 12; frame++) detector.push(silence, frame * 40);
    expect(detector.push(note, 480)).toBe(true);
    for (let frame = 0; frame < 4; frame++) detector.push(decayed, 520 + frame * 40);
    expect(detector.push(note, 700)).toBe(true);
  });

  test('flux ignores what does not rise', () => {
    const loud = Float32Array.from([0, 1, 1, 1]);
    const quiet = Float32Array.from([0, 0.5, 0.5, 0.5]);
    expect(spectralFlux(quiet, loud)).toBe(0);
    expect(spectralFlux(loud, quiet)).toBeGreaterThan(0);
  });

  test('the median of an even and of an odd list', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

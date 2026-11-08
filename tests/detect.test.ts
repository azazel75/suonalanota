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

import { analyseSpectrum, binWidth, isOctaveApart, peakAt } from '../src/audio/detect';
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

/** A long signal, cut into overlapping windows the way an analyser would. */
function framesOf(
  partials: Partial[],
  seconds: number,
  window: number,
  hop: number,
  envelope: (t: number) => number,
): Float32Array[] {
  const total = Math.round(seconds * SAMPLE_RATE);
  const signal = new Float32Array(total);
  for (let index = 0; index < total; index++) {
    const t = index / SAMPLE_RATE;
    let value = 0;
    for (const partial of partials) {
      value += partial.amplitude * Math.sin(2 * Math.PI * partial.hz * t);
    }
    signal[index] = value * envelope(t);
  }

  const frames: Float32Array[] = [];
  for (let start = 0; start + window <= total; start += hop) {
    frames.push(amplitudeSpectrum(signal.slice(start, start + window)));
  }
  return frames;
}

describe('the onset detector against a real-shaped note', () => {
  const WINDOW = 2048;
  const HOP = 1920;
  const silence = amplitudeSpectrum(new Float32Array(WINDOW));

  function arm(detector: ReturnType<typeof createOnsetDetector>): void {
    for (let frame = 0; frame < 12; frame++) detector.push(silence, frame * 40);
  }

  test('a note held for two seconds, decaying and beating, is exactly one attack', () => {
    // This is the defect the first spike measured: eleven colpi for three presses,
    // at 133 and 150 ms from each other, on a tone that was still ringing.
    const detector = createOnsetDetector();
    arm(detector);

    const frames = framesOf(
      pianoTone(A4),
      2,
      WINDOW,
      HOP,
      (t) => Math.exp(-t / 0.6) * (1 + 0.12 * Math.sin(2 * Math.PI * 4 * t)),
    );

    let attacks = 0;
    frames.forEach((frame, index) => {
      if (detector.push(frame, 1000 + index * 40)) attacks++;
    });
    expect(attacks).toBe(1);
  });

  test('an attack that lands on a sound that has not died away is still an attack', () => {
    // Emilia lifts the finger between presses, but the note is still ringing:
    // the second press must not be missed, and must not be counted twice.
    const detector = createOnsetDetector({ cooldownMs: 0 });
    arm(detector);

    const residue = amplitudeSpectrum(synthesise(pianoTone(A4).map(
      (partial) => ({ hz: partial.hz, amplitude: partial.amplitude * 0.4 }),
    ), WINDOW));
    const attack = amplitudeSpectrum(synthesise(pianoTone(A4), WINDOW));

    let attacks = 0;
    for (let frame = 0; frame < 4; frame++) {
      if (detector.push(residue, 1000 + frame * 40)) attacks++;
    }
    for (let frame = 0; frame < 4; frame++) {
      if (detector.push(attack, 1200 + frame * 40)) attacks++;
    }
    expect(attacks).toBe(2);
  });

  test('a release is not an attack', () => {
    const detector = createOnsetDetector({ cooldownMs: 0 });
    arm(detector);
    const attack = amplitudeSpectrum(synthesise(pianoTone(A4), WINDOW));
    detector.push(attack, 1000);
    expect(detector.push(amplitudeSpectrum(new Float32Array(WINDOW)), 1100)).toBe(false);
  });
});

describe('the octave rule', () => {
  // Only the even partials, with a fundamental much weaker than the second: the
  // shape a bass note takes when the microphone barely hears its fundamental.
  // Without the rule the sum prefers the octave above.
  function weakFundamental(fundamental: number): Partial[] {
    return [
      { hz: midiToHz(A2), amplitude: fundamental },
      { hz: midiToHz(A2) * 2, amplitude: 1 },
      { hz: midiToHz(A2) * 4, amplitude: 0.5 },
      { hz: midiToHz(A2) * 6, amplitude: 0.25 },
    ];
  }

  test('the octave below is chosen when its fundamental carries a share of the energy', () => {
    const magnitudes = amplitudeSpectrum(synthesise(weakFundamental(0.2)));

    const withoutRule = analyseSpectrum(magnitudes, SAMPLE_RATE);
    const withRule = analyseSpectrum(magnitudes, SAMPLE_RATE, { octaveEvidence: true });

    // Canary: without the rule this is what the detector says, and why the rule
    // exists. It is off by default on the measured evidence of ADR 0006.
    expect(withoutRule.best.midi).toBe(A2 + 12);
    expect(withRule.best.midi).toBe(A2);
    expect(withRule.octaveFlipped).toBe(true);
  });

  test('but it refuses to guess when the fundamental is only a trace', () => {
    // Calibrated on a grand piano (docs/adr/0006): the flips that were right had
    // the lower fundamental at 0.07 of the frame's RMS, the wrong ones — a string
    // resonating by sympathy — at 0.004. At 2% the rule must stay its hand.
    const magnitudes = amplitudeSpectrum(synthesise(weakFundamental(0.02)));
    const detection = analyseSpectrum(magnitudes, SAMPLE_RATE, { octaveEvidence: true });
    expect(detection.best.midi).toBe(A2 + 12);
    expect(detection.octaveFlipped).toBe(false);
  });

  test('a note played on its own is not dragged down an octave', () => {
    // The octave below always scores close, because every note's partials are
    // the even partials of the note an octave below. It must not be chosen when
    // its own fundamental carries no energy.
    const detection = detect(pianoTone(A4));
    expect(detection.best.midi).toBe(A4);
    expect(detection.octaveFlipped).toBe(false);
  });
});

describe('the search range', () => {
  test('a note outside the range is never named', () => {
    // A knock in the low end of the piano is a perfect harmonic series: unbounded,
    // it is named C1. The exercise range must exclude it.
    const knock = synthesise([
      { hz: midiToHz(24), amplitude: 0.9 },
      { hz: midiToHz(24) * 2, amplitude: 0.5 },
      { hz: midiToHz(24) * 3, amplitude: 0.3 },
    ]);

    const detection = analyseSpectrum(amplitudeSpectrum(knock), SAMPLE_RATE, {
      lowMidi: 35,
      highMidi: 86,
    });
    expect(detection.best.midi).toBeGreaterThanOrEqual(35);
    expect(detection.best.midi).toBeLessThanOrEqual(86);
  });
});

describe('the ambiguity of the octave', () => {
  test('a note whose octave scores within 3 dB is not judged, it is asked again', () => {
    // Exactly the shape that produced the octave errors on the grand piano: the
    // winner and its octave differ by a couple of dB, and no rule can tell them
    // apart. The answer is not to guess: it is to make the player repeat.
    const partials: Partial[] = [
      { hz: midiToHz(A2), amplitude: 0.2 },
      { hz: midiToHz(A2) * 2, amplitude: 1 },
      { hz: midiToHz(A2) * 4, amplitude: 0.5 },
      { hz: midiToHz(A2) * 6, amplitude: 0.25 },
    ];
    const detection = analyseSpectrum(amplitudeSpectrum(synthesise(partials)), SAMPLE_RATE);
    expect(detection.octaveMarginDb).toBeLessThan(3);
    expect(detection.ambiguous).toBe(true);
  });

  test('a note that wins clearly is judged', () => {
    const detection = detect(pianoTone(A4));
    expect(detection.octaveMarginDb).toBeGreaterThan(3);
    expect(detection.ambiguous).toBe(false);
  });
});

describe('the measured frequency', () => {
  test('is the frequency that was played, not the nominal one', () => {
    const flat = detect(pianoTone(A4, { cents: -30 }));
    expect(flat.best.midi).toBe(A4);
    const expected = 440 * Math.pow(2, -30 / 1200);
    expect(flat.measuredHz).toBeGreaterThan(expected - 2);
    expect(flat.measuredHz).toBeLessThan(expected + 2);
  });
});

describe('the parabolic refinement of a peak', () => {
  // A flat spectrum with a small wobble is where the unguarded parabola used to
  // explode: the denominator goes to zero, the offset reaches tens of bins, and
  // the peak is reported both at an absurd frequency and at an inflated
  // amplitude. The second spike log is full of 182 Hz readings for 116 Hz notes.
  function noisySpectrum(seed: number): Float32Array {
    const values = new Float32Array(8192);
    let state = seed;
    for (let bin = 1; bin < values.length; bin++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      values[bin] = 1e-5 * (0.9 + 0.2 * ((state >>> 8) / 0xffffff));
    }
    return values;
  }

  test('cannot report a frequency outside its own search window', () => {
    const magnitudes = noisySpectrum(1);
    const width = binWidth(SAMPLE_RATE, magnitudes);
    for (const midi of [46, 43, 60, 84]) {
      const expected = midiToHz(midi) / width;
      const peak = peakAt(magnitudes, expected, 1);
      expect(Math.abs(peak.bin - expected)).toBeLessThan(1.5);
      expect(peak.magnitude).toBeLessThan(2e-5);
    }
  });

  test('cannot clear the gate with an inflated amplitude', () => {
    const detection = analyseSpectrum(noisySpectrum(7), SAMPLE_RATE, { lowMidi: 35, highMidi: 86 });
    expect(detection.best.score).toBeLessThan(0.002);
    // The search window is ±2% of the partial (at least one bin), so that is how
    // far the measured frequency may sit from the nominal one — and no further.
    const width = binWidth(SAMPLE_RATE, noisySpectrum(7));
    const tolerance = Math.max(width * 1.5, detection.best.hz * 0.02) + width;
    expect(Math.abs(detection.measuredHz - detection.best.hz)).toBeLessThan(tolerance);
  });
});



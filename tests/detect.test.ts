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
import { bandEnergy, halfRiseMs, partialProfile, riseDelayMs } from '../src/audio/profile';
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
    // This is the defect the first spike measured: eleven pressioni for three presses,
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
  /** The rule's real input is a spectrum: build one from the measured shape of B1. */
  function spectrumWith(peaks: { hz: number; amplitude: number }[]): Float32Array {
    const size = 8192;
    const width = SAMPLE_RATE / (size * 2);
    const magnitudes = new Float32Array(size);
    for (const peak of peaks) {
      const bin = Math.round(peak.hz / width);
      magnitudes[bin] = peak.amplitude;
      magnitudes[bin - 1] = peak.amplitude / 2;
      magnitudes[bin + 1] = peak.amplitude / 2;
    }
    return magnitudes;
  }

  /** Si1 as the measurements saw it: fundamental lost, partials 2..8 around 0.1. */
  function bassNote(odd: number): Float32Array {
    const f0 = midiToHz(35);
    return spectrumWith([
      { hz: f0 * 1, amplitude: 0.005 },
      { hz: f0 * 2, amplitude: 0.2 },
      { hz: f0 * 3, amplitude: odd },
      { hz: f0 * 4, amplitude: 0.13 },
      { hz: f0 * 5, amplitude: odd },
      { hz: f0 * 6, amplitude: 0.13 },
      { hz: f0 * 7, amplitude: odd },
      { hz: f0 * 8, amplitude: 0.13 },
    ]);
  }

  test('the octave below is chosen when it has its odd partials', () => {
    // Measured ratio for a string that was really pressed: 0.38-0.60 of what the
    // octave above carries on its fundamental. Without the rule the sum prefers
    // the octave above, because the fundamental of Si1 is lost in the microphone.
    const magnitudes = bassNote(0.08);
    const withoutRule = analyseSpectrum(magnitudes, SAMPLE_RATE, { octaveEvidence: false });
    const withRule = analyseSpectrum(magnitudes, SAMPLE_RATE, { octaveEvidence: true });

    expect(withoutRule.best.midi).toBe(35 + 12);
    expect(withRule.best.midi).toBe(35);
    expect(withRule.octaveFlipped).toBe(true);
  });

  test('but not when it has only the even ones, which is what a resonance has', () => {
    // The same spectrum with partials 3, 5 and 7 silent: a string vibrating in its
    // even mode. Measured ratio for those: at most 0.214, below the threshold.
    const magnitudes = bassNote(0);
    const detection = analyseSpectrum(magnitudes, SAMPLE_RATE, { octaveEvidence: true });
    expect(detection.best.midi).toBe(35 + 12);
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
  /** The same shape as the octave-rule tests: Si1 with partials 3 5 7 at a chosen level. */
  function bassSpectrum(odd: number): Float32Array {
    const size = 8192;
    const width = SAMPLE_RATE / (size * 2);
    const magnitudes = new Float32Array(size);
    const f0 = midiToHz(35);
    for (const [k, amplitude] of [[1, 0.005], [2, 0.2], [3, odd], [4, 0.13], [5, odd], [6, 0.13], [7, odd], [8, 0.13]] as [number, number][]) {
      const bin = Math.round((f0 * k) / width);
      magnitudes[bin] = amplitude;
      magnitudes[bin - 1] = amplitude / 2;
      magnitudes[bin + 1] = amplitude / 2;
    }
    return magnitudes;
  }

  test('inside the measured overlap the pressione is asked again, not judged', () => {
    // Odd partials at 0.3 of the winner's fundamental: between the highest value
    // measured on a resonance (0.214) and the lowest on a pressed string (0.38).
    const detection = analyseSpectrum(bassSpectrum(0.06), SAMPLE_RATE, { octaveEvidence: true });
    expect(detection.octaveMarginDb).toBeLessThan(3);
    expect(detection.octaveEvidenceRatio).toBeCloseTo(0.3, 1);
    expect(detection.ambiguous).toBe(true);
  });

  test('outside it the detector decides, and the pressione is judged', () => {
    const decisive = analyseSpectrum(bassSpectrum(0.1), SAMPLE_RATE, { octaveEvidence: true });
    expect(decisive.ambiguous).toBe(false);
    // Con abbastanza parziali dispari la nota grave vince già da sola: qui conta che
    // il verdetto sia quello giusto e che non si chieda di ripetere.
    expect(decisive.best.midi).toBe(35);
  });

  test('a note that wins clearly is judged', () => {
    const detection = detect(pianoTone(A4));
    expect(detection.octaveMarginDb).toBeGreaterThan(3);
    expect(detection.ambiguous).toBe(false);
  });
});

describe('the two octave discriminants', () => {
  // The physics both probes are built on. A pressed string has its odd partials;
  // a string resonating in its even mode, driven by the octave above, does not.
  function evenOnly(midi: number): Partial[] {
    return [2, 4, 6].map((k) => ({ hz: midiToHz(midi) * k, amplitude: 1 / k }));
  }

  function allPartials(midi: number): Partial[] {
    return Array.from({ length: 8 }, (_, index) => ({
      hz: midiToHz(midi) * (index + 1),
      amplitude: 1 / (index + 1),
    }));
  }

  test('a string resonating in its even mode has no odd partials', () => {
    const magnitudes = amplitudeSpectrum(synthesise(evenOnly(A2)));
    const profile = partialProfile(magnitudes, SAMPLE_RATE, A2);
    expect(profile.odd).toBeLessThan(profile.even * 0.05);
    expect(profile.oddToEven).toBeLessThan(0.05);
  });

  test('a pressed string has them', () => {
    const magnitudes = amplitudeSpectrum(synthesise(allPartials(A2)));
    const profile = partialProfile(magnitudes, SAMPLE_RATE, A2);
    expect(profile.oddToEven).toBeGreaterThan(0.4);
  });

  test('a band sits where the frequency is and is empty an octave below', () => {
    const magnitudes = amplitudeSpectrum(synthesise(allPartials(A4)));
    expect(bandEnergy(magnitudes, SAMPLE_RATE, midiToHz(A4))).toBeGreaterThan(0.5);
    expect(bandEnergy(magnitudes, SAMPLE_RATE, midiToHz(A4) / 2)).toBeLessThan(0.05);
  });

  test('half rise is the frame where the band reaches half of its own peak', () => {
    expect(halfRiseMs([0, 0, 0, 1, 2, 3], 20)).toBe(80);
    expect(halfRiseMs([0, 0, 0], 20)).toBe(-1);
  });

  test('a band that rises two frames later is a resonance, in milliseconds', () => {
    const upper = [0, 1, 2, 3, 3, 3];
    const lower = [0, 0, 0, 1, 2, 3];
    expect(riseDelayMs(lower, upper, 20)).toBe(40);
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



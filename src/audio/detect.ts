/**
 * :Project:  suona-la-nota -- which key the room is sounding
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * Harmonic sum over every key of the piano: a candidate scores the mean
 * amplitude of its first partials, weighted 1/sqrt(k) so that the fundamental
 * counts more than the seventh harmonic without disappearing from the sum.
 *
 * Each partial is searched for in a window of 2% around its nominal frequency.
 * Two reasons, both real: the upper partials of a piano are stretched sharp by
 * the stiffness of the string, and a school piano is routinely 20 or 30 cents
 * out of tune. A semitone is 5.9%, so a 2% window cannot reach the neighbour.
 *
 * Known fragility, measured by the spike and pinned by a test: the octave below
 * every note collects that note's partials as its own even harmonics, so the
 * margin between the winner and its octave is only a few dB. Do not "fix" that
 * by penalising sub-octaves: it trades the error for the opposite one.
 */
import { HIGHEST_MIDI, LOWEST_MIDI, midiToHz, pitchClass } from './notes';

/** How many partials a candidate is scored on. */
export const HARMONICS = 8;

/** Search window around each partial, as a fraction of its frequency. */
export const PARTIAL_TOLERANCE = 0.02;

const HARMONIC_WEIGHTS: number[] = Array.from(
  { length: HARMONICS },
  (_, index) => 1 / Math.sqrt(index + 1),
);

const WEIGHT_SUM = HARMONIC_WEIGHTS.reduce((total, weight) => total + weight, 0);

/** Partials are ignored above this fraction of the Nyquist frequency. */
const NYQUIST_MARGIN = 0.9;

export interface Candidate {
  midi: number;
  hz: number;
  /** Mean weighted amplitude of the partials, in the units of the spectrum. */
  score: number;
}

export interface Detection {
  /** The winning key. Always present: the search covers all 88 keys. */
  best: Candidate;
  /** Runner-up, or null when the search had a single candidate. */
  second: Candidate | null;
  /** Every key, best first. */
  candidates: Candidate[];
  /** Distance of the winner from the runner-up, as an amplitude ratio in dB. */
  marginDb: number;
  /** Distance of the winner from the strongest of its two octaves, in dB. */
  octaveMarginDb: number;
}

/** Width of one spectrum bin, in Hz. The spectrum is half of the FFT. */
export function binWidth(sampleRate: number, magnitudes: Float32Array): number {
  return sampleRate / (magnitudes.length * 2);
}

/**
 * Amplitude of a partial that may not sit exactly on a bin: the largest of the
 * `radius` neighbours, refined by a parabola through the three around it.
 */
export function peakMagnitude(
  magnitudes: Float32Array,
  bin: number,
  radius = 1,
): number {
  const centre = Math.round(bin);
  if (centre >= magnitudes.length - 1) return 0;

  const from = Math.max(1, centre - radius);
  const to = Math.min(magnitudes.length - 2, centre + radius);

  let bestIndex = from;
  let best = magnitudes[from];
  for (let k = from + 1; k <= to; k++) {
    if (magnitudes[k] > best) {
      best = magnitudes[k];
      bestIndex = k;
    }
  }
  if (best <= 0) return 0;

  const left = magnitudes[bestIndex - 1];
  const right = magnitudes[bestIndex + 1];
  const curvature = left - 2 * best + right;
  if (curvature === 0) return best;

  const offset = (0.5 * (left - right)) / curvature;
  return Math.max(0, best - 0.25 * (left - right) * offset);
}

/** Harmonic sum of one key of the piano. */
export function scoreKey(
  magnitudes: Float32Array,
  sampleRate: number,
  midi: number,
): number {
  const width = binWidth(sampleRate, magnitudes);
  const fundamental = midiToHz(midi);
  const limit = (sampleRate / 2) * NYQUIST_MARGIN;

  let total = 0;
  for (let k = 1; k <= HARMONICS; k++) {
    const partial = fundamental * k;
    if (partial >= limit) break;
    const radius = Math.max(1, Math.round((partial * PARTIAL_TOLERANCE) / width));
    total += HARMONIC_WEIGHTS[k - 1] * peakMagnitude(magnitudes, partial / width, radius);
  }
  return total / WEIGHT_SUM;
}

/** Whether two MIDI numbers are the same key of the piano. */
export function sameKey(a: number, b: number): boolean {
  return Math.round(a) === Math.round(b);
}

/** Whether two MIDI numbers are the same note name in different octaves. */
export function isOctaveApart(a: number, b: number): boolean {
  return pitchClass(a) === pitchClass(b) && !sameKey(a, b);
}

function decibelsRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 99;
  if (numerator <= 0) return 0;
  return 20 * Math.log10(numerator / denominator);
}

/** Score every key of the piano and rank them. */
export function analyseSpectrum(
  magnitudes: Float32Array,
  sampleRate: number,
): Detection {
  const candidates: Candidate[] = [];
  const byMidi = new Map<number, number>();

  for (let midi = LOWEST_MIDI; midi <= HIGHEST_MIDI; midi++) {
    const score = scoreKey(magnitudes, sampleRate, midi);
    byMidi.set(midi, score);
    candidates.push({ midi, hz: midiToHz(midi), score });
  }
  candidates.sort((left, right) => right.score - left.score);

  const best = candidates[0];
  const second = candidates.length > 1 ? candidates[1] : null;

  const octaveScores = [byMidi.get(best.midi - 12) ?? 0, byMidi.get(best.midi + 12) ?? 0];
  const strongestOctave = Math.max(...octaveScores);

  return {
    best,
    second,
    candidates,
    marginDb: second ? decibelsRatio(best.score, second.score) : 99,
    octaveMarginDb: decibelsRatio(best.score, strongestOctave),
  };
}

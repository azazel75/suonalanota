/**
 * :Project:  suona-la-nota -- which key the room is sounding
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * Harmonic sum over the keys the exercise can ask for: a candidate scores the
 * mean amplitude of its first partials, weighted 1/sqrt(k) so that the
 * fundamental counts more than the seventh harmonic without disappearing.
 *
 * Each partial is searched for in a window of 2% around its nominal frequency.
 * Two reasons, both real: the upper partials of a piano are stretched sharp by
 * the stiffness of the string, and a school piano is routinely 20 or 30 cents
 * out of tune. A semitone is 5.9%, so a 2% window cannot reach the neighbour.
 *
 * Two rules keep the octave in place, and both were written after measuring a
 * real instrument (docs/adr/0004, docs/adr/0006):
 *
 *  - the search is bounded to the range of the exercise. Searching all 88 keys
 *    hands a plausible name to every knock, to a chair and to a rumble;
 *  - every note's partials are the *even* partials of the note an octave below,
 *    so the octave below always scores close: measured margins between a real
 *    winner and its octave were 0.5-3.3 dB. The octave rule below prefers the
 *    octave below when it is that close AND its fundamental carries a real share
 *    of the frame's energy — a real string does, a sympathetically resonant one
 *    does not.
 *
 * The octave rule is **off by default**, and that is a measurement, not caution:
 * on 245 colpi of a grand piano it was neutral overall — it repaired the bass,
 * where the fundamental is inaudible, and broke the treble, where the string an
 * octave below resonates — and it was harmful on unsettled frames, where it
 * dragged room noise down an octave. Its inputs are still logged, so the
 * decision can be re-taken on data instead of opinion.
 */
import { HIGHEST_MIDI, LOWEST_MIDI, midiToHz, pitchClass } from './notes';

/** How many partials a candidate is scored on. */
export const HARMONICS = 8;

/** Search window around each partial, as a fraction of its frequency. */
export const PARTIAL_TOLERANCE = 0.02;

/** Beyond this margin the winner is not a tie with its octave: leave it alone. */
export const OCTAVE_TIE_DB = 6;

/** The octave below is chosen only when its fundamental is at least this share of
 * the frame's RMS.
 *
 * Calibrated on a grand piano, 245 colpi (docs/adr/0006): the flips that were
 * right had a lower fundamental at a median 0.072 of the frame RMS; the flips
 * that were wrong — a string of the octave below resonating by sympathy, which
 * is what a piano does — sat at 0.004. A share of the energy is scale-free, so
 * it does not move when the microphone gain changes; an absolute amplitude does.
 */
export const OCTAVE_EVIDENCE_SHARE = 0.06;

/** A fundamental counts as present when it stands this far above the noise floor. */
export const NOISE_FACTOR = 20;

/** ... and when it is above this amplitude at all, whatever the floor says. */
export const ABSOLUTE_PRESENCE = 1e-4;

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

export interface DetectionOptions {
  /** Lowest key the exercise can ask for. */
  lowMidi?: number;
  /** Highest key the exercise can ask for. */
  highMidi?: number;
  /** When false the octave rule is skipped. Off by default: see below. */
  octaveEvidence?: boolean;
  /** RMS of the analysed frame; derived from the spectrum when not given. */
  frameRms?: number;
}

export interface Detection {
  /** The winning key. Always present: the search covers the whole range. */
  best: Candidate;
  /** Runner-up, or null when the search had a single candidate. */
  second: Candidate | null;
  /** Every key of the range, best first. */
  candidates: Candidate[];
  /** Distance of the winner from the runner-up, as an amplitude ratio in dB. */
  marginDb: number;
  /** Distance of the winner from the strongest of its two octaves, in dB. */
  octaveMarginDb: number;
  /** The frequency actually measured near the winner's fundamental, in Hz. */
  measuredHz: number;
  /** Whether the winner's fundamental stands above the noise floor. */
  fundamentalPresent: boolean;
  /** Amplitude of the winner's fundamental. */
  fundamentalMagnitude: number;
  /** Amplitude where the octave below would have its fundamental, 0 if out of range. */
  octaveBelowMagnitude: number;
  /** Winner's score over the median score of the whole range: how much it stands out. */
  credibility: number;
  /** True when the octave rule moved the winner one octave down. */
  octaveFlipped: boolean;
}

interface Peak {
  magnitude: number;
  /** Interpolated position, in bins. */
  bin: number;
}

/** Width of one spectrum bin, in Hz. The spectrum is half of the FFT. */
export function binWidth(sampleRate: number, magnitudes: Float32Array): number {
  return sampleRate / (magnitudes.length * 2);
}

/**
 * The largest of the `radius` neighbours of a bin, refined by a parabola through
 * the three around it: a partial rarely sits exactly on a bin.
 *
 * The parabola is only valid on a *concave* peak, and its offset is at most half
 * a bin. Without those two guards the arithmetic explodes on a flat, noisy
 * region: the denominator goes to zero, the offset reaches tens of bins, and the
 * "peak" is reported both at an absurd frequency (182 Hz for a 116 Hz note) and
 * at an inflated amplitude — which is how room noise used to clear the gate and
 * become a colpo. Measured, not imagined: the second spike log is full of them.
 */
export function peakAt(magnitudes: Float32Array, bin: number, radius = 1): Peak {
  const centre = Math.round(bin);
  if (centre >= magnitudes.length - 1) return { magnitude: 0, bin: centre };

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
  if (best <= 0) return { magnitude: 0, bin: bestIndex };

  const left = magnitudes[bestIndex - 1];
  const right = magnitudes[bestIndex + 1];

  // Not a local maximum: nothing to interpolate, and the plain bin is the answer.
  if (!(left < best && best > right)) return { magnitude: best, bin: bestIndex };

  const curvature = left - 2 * best + right;
  if (curvature >= 0) return { magnitude: best, bin: bestIndex };

  const offset = (0.5 * (left - right)) / curvature;
  if (!Number.isFinite(offset) || Math.abs(offset) > 0.5) return { magnitude: best, bin: bestIndex };

  return {
    magnitude: Math.max(best, best - 0.25 * (left - right) * offset),
    bin: bestIndex + offset,
  };
}

/** Amplitude of a partial, without its position. */
export function peakMagnitude(magnitudes: Float32Array, bin: number, radius = 1): number {
  return peakAt(magnitudes, bin, radius).magnitude;
}

/** The region around a note's fundamental: how loud it is, and where it actually sits. */
export function fundamentalOf(
  magnitudes: Float32Array,
  sampleRate: number,
  midi: number,
): Peak & { hz: number } {
  const width = binWidth(sampleRate, magnitudes);
  const nominal = midiToHz(midi);
  const radius = Math.max(1, Math.round((nominal * PARTIAL_TOLERANCE) / width));
  const peak = peakAt(magnitudes, nominal / width, radius);
  return { ...peak, hz: peak.bin * width };
}

/** Robust noise floor of a spectrum: the median of its bins, over a subsample. */
export function noiseFloor(magnitudes: Float32Array, stride = 4): number {
  const values: number[] = [];
  for (let bin = 8; bin < magnitudes.length; bin += stride) values.push(magnitudes[bin]);
  if (values.length === 0) return 0;
  values.sort((left, right) => left - right);
  return values[values.length >> 1];
}

/**
 * RMS of the frame, recovered from the amplitude spectrum (Parseval), for callers
 * that do not have the time-domain buffer at hand. A Hann window spreads each
 * partial over a few bins, so this overestimates the true RMS by about 20%: fine
 * as a fallback, but pass `frameRms` when you have it.
 */
export function spectrumRms(magnitudes: Float32Array): number {
  let power = 0;
  for (let bin = 1; bin < magnitudes.length; bin++) power += magnitudes[bin] * magnitudes[bin];
  return Math.sqrt(power / 2);
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[sorted.length >> 1];
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

/** Score every key of the range and rank them. */
export function analyseSpectrum(
  magnitudes: Float32Array,
  sampleRate: number,
  options: DetectionOptions = {},
): Detection {
  const lowMidi = options.lowMidi ?? LOWEST_MIDI;
  const highMidi = options.highMidi ?? HIGHEST_MIDI;
  const useOctaveEvidence = options.octaveEvidence ?? false;

  const candidates: Candidate[] = [];
  const byMidi = new Map<number, number>();

  for (let midi = lowMidi; midi <= highMidi; midi++) {
    const score = scoreKey(magnitudes, sampleRate, midi);
    byMidi.set(midi, score);
    candidates.push({ midi, hz: midiToHz(midi), score });
  }
  candidates.sort((left, right) => right.score - left.score);

  const floor = noiseFloor(magnitudes);
  const present = (magnitude: number): boolean =>
    magnitude > ABSOLUTE_PRESENCE && magnitude > floor * NOISE_FACTOR;

  const frameRms = options.frameRms ?? spectrumRms(magnitudes);

  let best = candidates[0];
  let octaveFlipped = false;

  if (useOctaveEvidence && frameRms > 0) {
    const lowerMidi = best.midi - 12;
    const lowerScore = byMidi.get(lowerMidi);
    if (lowerScore !== undefined) {
      const tie = decibelsRatio(best.score, lowerScore) <= OCTAVE_TIE_DB;
      const lowerFundamental = fundamentalOf(magnitudes, sampleRate, lowerMidi);
      // A share of the frame's energy, not an absolute amplitude: a real string
      // puts a real part of the sound on its fundamental, a sympathetic resonance
      // puts a trace. An absolute threshold would move with the microphone gain.
      const evidence = lowerFundamental.magnitude >= OCTAVE_EVIDENCE_SHARE * frameRms;
      if (tie && evidence) {
        const lower = candidates.find((candidate) => candidate.midi === lowerMidi);
        if (lower !== undefined) {
          best = lower;
          octaveFlipped = true;
        }
      }
    }
  }

  const second = candidates.find((candidate) => candidate.midi !== best.midi) ?? null;
  const octaveScores = [byMidi.get(best.midi - 12) ?? 0, byMidi.get(best.midi + 12) ?? 0];
  const strongestOctave = Math.max(...octaveScores);
  const fundamental = fundamentalOf(magnitudes, sampleRate, best.midi);
  const below = best.midi - 12 >= lowMidi
    ? fundamentalOf(magnitudes, sampleRate, best.midi - 12)
    : null;
  const typical = medianOf(candidates.map((candidate) => candidate.score));

  return {
    best,
    second,
    candidates,
    marginDb: second ? decibelsRatio(best.score, second.score) : 99,
    octaveMarginDb: decibelsRatio(best.score, strongestOctave),
    measuredHz: fundamental.magnitude > 0 ? fundamental.hz : 0,
    fundamentalPresent: present(fundamental.magnitude),
    fundamentalMagnitude: fundamental.magnitude,
    octaveBelowMagnitude: below?.magnitude ?? 0,
    credibility: typical > 0 ? best.score / typical : 99,
    octaveFlipped,
  };
}

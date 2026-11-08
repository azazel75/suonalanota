/**
 * :Project:  suona-la-nota -- two questions for the next measurement
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The octave question, put as physics instead of thresholds.
 *
 * 1. A string resonating by sympathy, driven by the octave above, vibrates in
 *    its *even* mode: it produces the partials 2, 4, 6 of the lower note and not
 *    the odd ones. A key that was really pressed produces 3, 5, 7 as well. So the
 *    odd partials of the octave below are evidence that the octave below was
 *    played, and their absence is evidence that it was not.
 *
 * 2. A struck string starts in a few milliseconds; a sympathetic resonance builds
 *    over tens. So the two bands do not rise together.
 *
 * Both are measured, neither is decided: the pages under /spike collect the data.
 */
import { PARTIAL_TOLERANCE, peakMagnitude, binWidth } from './detect';
import { midiToHz } from './notes';

export interface Profile {
  /** Amplitude at the fundamental. */
  fundamental: number;
  /** Mean amplitude of partials 3, 5 and 7. */
  odd: number;
  /** Mean amplitude of partials 2, 4 and 6. */
  even: number;
  /** Odd over even: near zero for a string resonating in its even mode. */
  oddToEven: number;
}

const ODD = [3, 5, 7];
const EVEN = [2, 4, 6];

function partial(magnitudes: Float32Array, sampleRate: number, midi: number, k: number): number {
  const width = binWidth(sampleRate, magnitudes);
  const hz = midiToHz(midi) * k;
  if (hz >= sampleRate / 2) return 0;
  const radius = Math.max(1, Math.round((hz * PARTIAL_TOLERANCE) / width));
  return peakMagnitude(magnitudes, hz / width, radius);
}

/** The partial structure of one key: fundamental, odd partials, even partials. */
export function partialProfile(
  magnitudes: Float32Array,
  sampleRate: number,
  midi: number,
): Profile {
  const fundamental = partial(magnitudes, sampleRate, midi, 1);
  const odd = ODD.reduce((total, k) => total + partial(magnitudes, sampleRate, midi, k), 0) / ODD.length;
  const even = EVEN.reduce((total, k) => total + partial(magnitudes, sampleRate, midi, k), 0) / EVEN.length;
  return {
    fundamental,
    odd,
    even,
    oddToEven: even > 0 ? odd / even : 0,
  };
}

/** Energy in a narrow band around a frequency: what rises, and when. */
export function bandEnergy(
  magnitudes: Float32Array,
  sampleRate: number,
  hz: number,
  tolerance = 0.03,
): number {
  const width = binWidth(sampleRate, magnitudes);
  const centre = Math.round(hz / width);
  const radius = Math.max(1, Math.round((hz * tolerance) / width));
  let total = 0;
  for (let bin = Math.max(1, centre - radius); bin <= Math.min(magnitudes.length - 1, centre + radius); bin++) {
    total += magnitudes[bin];
  }
  return total;
}

/**
 * When a band reached half of its own maximum, in milliseconds from the first
 * frame. -1 when it never got there: a band that stays silent has no rise.
 */
export function halfRiseMs(series: number[], hopMs: number): number {
  const peak = Math.max(...series);
  if (!(peak > 0)) return -1;
  const half = peak / 2;
  const index = series.findIndex((value) => value >= half);
  return index < 0 ? -1 : index * hopMs;
}

/**
 * Milliseconds by which the lower band rises *after* the upper one. Positive is
 * the signature of a resonance (the upper note started first), near zero of a
 * note that was really played.
 */
export function riseDelayMs(lower: number[], upper: number[], hopMs: number): number {
  const lowerAt = halfRiseMs(lower, hopMs);
  const upperAt = halfRiseMs(upper, hopMs);
  if (lowerAt < 0 || upperAt < 0) return Number.NaN;
  return lowerAt - upperAt;
}

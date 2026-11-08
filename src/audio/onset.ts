/**
 * :Project:  suona-la-nota -- when a key was struck, not just which one
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * A colpo is an attack: the harmonic sum says *which* key sounds, this says
 * *when it started sounding*. Without it a held key would answer every target
 * and two identical notes in a row would count as one.
 *
 * Spectral flux against its own recent median, so that a room with a hum or a
 * fan does not keep the detector open, plus a minimum interval between attacks.
 */

/** How many past frames the median of the flux is taken over. */
const HISTORY = 43;

/** Frames needed before the median means anything: before that, nothing triggers. */
const MIN_HISTORY = 8;

/** Flux below this is never an attack, whatever the median says. */
const FLOOR = 0.02;


/** Flux must exceed the median by this factor to be an attack. */
const DEFAULT_RATIO = 3;

/** Two attacks closer than this are one attack. */
const DEFAULT_COOLDOWN_MS = 120;

export interface OnsetOptions {
  ratio?: number;
  cooldownMs?: number;
}

export interface OnsetDetector {
  /** Feed one spectrum; returns true when it contains an attack. */
  push(magnitudes: Float32Array, nowMs: number): boolean;
  /** The flux of the last frame, for display. */
  readonly flux: number;
  /** The trigger level the last frame was compared against, for display. */
  readonly threshold: number;
  reset(): void;
}

/** Sum of the positive differences between two spectra, relative to the energy. */
export function spectralFlux(current: Float32Array, previous: Float32Array): number {
  let rise = 0;
  let energy = 0;
  const length = Math.min(current.length, previous.length);
  for (let k = 1; k < length; k++) {
    const delta = current[k] - previous[k];
    if (delta > 0) rise += delta;
    energy += current[k];
  }
  return energy > 0 ? rise / energy : 0;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function createOnsetDetector(options: OnsetOptions = {}): OnsetDetector {
  const ratio = options.ratio ?? DEFAULT_RATIO;
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;

  let previous: Float32Array | null = null;
  let history: number[] = [];
  let lastAttackMs = -Infinity;
  let flux = 0;
  let threshold = 0;

  function reset(): void {
    previous = null;
    history = [];
    lastAttackMs = -Infinity;
    flux = 0;
    threshold = 0;
  }

  function push(magnitudes: Float32Array, nowMs: number): boolean {
    const current = Float32Array.from(magnitudes);

    if (previous === null) {
      previous = current;
      return false;
    }

    flux = spectralFlux(current, previous);
    previous = current;

    // The median needs a filled history before it means anything: until then
    // nothing is an attack, and the first notes of a session are the price.
    threshold = history.length >= MIN_HISTORY
      ? Math.max(median(history) * ratio, FLOOR)
      : Infinity;
    history.push(flux);
    if (history.length > HISTORY) history.shift();

    if (!Number.isFinite(threshold)) return false;
    if (flux < threshold) return false;
    if (nowMs - lastAttackMs < cooldownMs) return false;

    lastAttackMs = nowMs;
    return true;
  }

  return {
    push,
    reset,
    get flux() {
      return flux;
    },
    get threshold() {
      return threshold;
    },
  };
}

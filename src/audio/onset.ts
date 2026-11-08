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
 * fan does not keep the detector open, plus a minimum interval between attacks
 * and — the part that matters — a state machine: **one attack per rise**. After
 * firing, the detector stays disarmed until the flux falls back below half the
 * threshold. Without that, a single attack on a decaying, beating piano tone
 * re-triggers every `cooldown + hop`: the first spike measured gaps of 133 and
 * 150 ms against a 120 ms cooldown and a 40 ms hop, and up to eleven colpi for
 * three presses.
 *
 * This module sees the *attack* spectrum: a short window (2048 samples), not the
 * 341 ms one the pitch needs. Using the long window here is what produced three
 * or four detections per keystroke in the first place.
 */

/** How many past frames the median of the flux is taken over. */
const HISTORY = 43;

/** Frames needed before the median means anything: before that, nothing triggers. */
const MIN_HISTORY = 8;

/** Flux below this is never an attack, whatever the median says.
 *
 * A rise from silence gives a flux of about 1, and an attack over a residue that
 * is still at 40% gives about 0.6. A *beating* piano unison raises the spectrum by
 * a few percent per frame: measured at about 0.05 on a synthetic tone with a 12%
 * beat. The floor has to sit between the two, or every beat of a held note is an
 * attack — the first version used 0.02 and produced eight attacks on a single
 * two-second note.
 */
const FLOOR = 0.15;

/** Flux must exceed the median by this factor to be an attack. */
const DEFAULT_RATIO = 3;

/** The detector re-arms when the flux falls below this share of the threshold. */
const DEFAULT_RELEASE = 0.5;

/** Two attacks closer than this are one attack: a backstop, not the brake. */
const DEFAULT_COOLDOWN_MS = 120;

export interface OnsetOptions {
  ratio?: number;
  cooldownMs?: number;
  release?: number;
}

export interface OnsetDetector {
  /** Feed one spectrum; returns true when it contains an attack. */
  push(magnitudes: Float32Array, nowMs: number): boolean;
  /** The flux of the last frame, for display. */
  readonly flux: number;
  /** The trigger level the last frame was compared against, for display. */
  readonly threshold: number;
  /** True when the detector may fire again: it has heard the sound fall back. */
  readonly armed: boolean;
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
  const release = options.release ?? DEFAULT_RELEASE;

  let previous: Float32Array | null = null;
  let history: number[] = [];
  let lastAttackMs = -Infinity;
  let flux = 0;
  let threshold = 0;
  let armed = true;

  function reset(): void {
    previous = null;
    history = [];
    lastAttackMs = -Infinity;
    flux = 0;
    threshold = 0;
    armed = true;
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

    // One attack per rise: the sound has to come back down before the detector
    // is allowed to fire again. This is the brake; the cooldown is the backstop.
    if (flux < threshold * release) armed = true;
    if (!armed) return false;
    if (flux < threshold) return false;
    if (nowMs - lastAttackMs < cooldownMs) return false;

    lastAttackMs = nowMs;
    armed = false;
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
    get armed() {
      return armed;
    },
  };
}

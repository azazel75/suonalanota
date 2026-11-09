/**
 * :Project:  suona-la-nota -- the listening, with no page around it
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The microphone side of the application: a stream of samples in, pressioni out.
 * No DOM, no AudioContext, no getUserMedia — the caller owns the analyser and
 * hands over one buffer per frame, because that is the only thing the spike
 * pages and the exercise have in common.
 *
 * Two pieces, because the pages ask different questions of the same
 * measurement:
 *
 *  - `measureFrame` reads one buffer: the level, the short spectrum the attack
 *    is heard on, and — when asked — the long spectrum and the key it names;
 *  - `createListener` keeps the state a session needs: when an attack happened,
 *    when to read the pitch of that attack, whether the pressione is credible enough
 *    to enter, and how long the winner has been the same key.
 *
 * Nothing here is tuned. The FFT size, the onset window, the read delay and the
 * gate were measured in the spikes and argued in docs/adr/0004-0009; this module
 * moves them, it does not re-tune them.
 */
import { analyseSpectrum, type Detection } from './detect';
import { amplitudeSpectrum, rms, toDecibels } from './fft';
import { HIGHEST_MIDI, LOWEST_MIDI } from './notes';
import { createOnsetDetector } from './onset';

/**
 * The pitch needs 341 ms at 48 kHz. The bass cannot be read on less: a semitone
 * is 5.9% and a school piano is routinely 20 or 30 cents out of tune, so the
 * resolution has to be paid for in samples.
 */
export const FFT_SIZE = 16_384;

/** The attack is measured on a short window: 43 ms, not the 341 ms the pitch needs. */
export const ONSET_WINDOW = 2_048;

/**
 * How long to wait after an attack before reading the pitch.
 *
 * The long window needs 341 ms to fill: read at the attack and it still holds
 * the silence before it. Measured on the third run, accuracy at that instant was
 * 46%, and 93% once the note had settled for five frames. 150 ms buys four
 * frames and stays inside the 400 ms attack-to-verdict criterion.
 */
export const READ_DELAY_MS = 150;

/** How often a page feeds a frame: 25 per second, throttled from rAF. */
export const ANALYSIS_INTERVAL_MS = 40;

/**
 * Below this credibility a pressione is noise and does not enter. Four is the number
 * the spike measured, not a preference (docs/adr/0004): the exercise and the
 * soundcheck both judge with it, so that a note the soundcheck heard is a note
 * the exercise will hear.
 */
export const MIN_CREDIBILITY = 4;

/** Silence as a number, not as -Infinity. */
export const DB_FLOOR = -100;

/** Frames the winner is remembered for, to know whether it has settled. */
const STABILITY_FRAMES = 5;

/** The interval of keys the exercise can ask for: outside it there is no candidate. */
export interface NoteRange {
  low: number;
  high: number;
}

/**
 * What the exercise judges, and nothing more: which key, whether it can be
 * trusted, how much, and how loud. The detection travels along because the
 * spike writes it to its log and the app draws the candidates; both would
 * otherwise have to ask the microphone twice for the same frame.
 */
export interface Pressione {
  /** When the attack was heard, on the clock of `push`. */
  at: number;
  /** The key the detector named, as a MIDI number. */
  midi: number;
  /** Its nominal frequency in Hz — the measured one is `detection.measuredHz`. */
  hz: number;
  /** Winner and octave too close to call: the exercise must ask for the note again. */
  ambiguous: boolean;
  /** How far the winner stands out from the median candidate: below the gate it is noise. */
  credibility: number;
  /** Level of the frame the pressione was read on, in dBFS. */
  levelDb: number;
  /** How many frames the winner had already been the same key, at read time. */
  stability: number;
  /** Everything the detector saw in the frame the pitch was read from. */
  detection: Detection;
}

export interface MeasurementOptions {
  /** Lowest key the exercise can ask for. Defaults to the whole keyboard. */
  lowMidi?: number;
  /** Highest key the exercise can ask for. Defaults to the whole keyboard. */
  highMidi?: number;
  /** Read the pitch on this frame. The attack spectrum is always read. */
  withPitch?: boolean;
  /** When false the octave rule is skipped, and a pressione is judged as it lands. */
  octaveEvidence?: boolean;
}

export interface FrameMeasurement {
  /** RMS of the whole buffer, in dBFS. */
  levelDb: number;
  /** Spectrum of the last `ONSET_WINDOW` samples: what an attack is heard on. */
  attackSpectrum: Float32Array;
  /** Spectrum of the whole buffer, or null when this frame did not pay for it. */
  spectrum: Float32Array | null;
  /** The key the spectrum names, or null when this frame did not pay for it. */
  detection: Detection | null;
}

/**
 * Everything one buffer of the microphone has to say, without keeping state.
 *
 * Two windows, two questions. The short one hears the attack (2048 samples,
 * 43 ms); the long one resolves the pitch (341 ms, needed for the bass). The
 * last `ONSET_WINDOW` samples of the buffer are the most recent ones.
 */
export function measureFrame(
  samples: Float32Array | Float64Array,
  sampleRate: number,
  options: MeasurementOptions & { withPitch: true },
): FrameMeasurement & { spectrum: Float32Array; detection: Detection };
export function measureFrame(
  samples: Float32Array | Float64Array,
  sampleRate: number,
  options?: MeasurementOptions,
): FrameMeasurement;
export function measureFrame(
  samples: Float32Array | Float64Array,
  sampleRate: number,
  options: MeasurementOptions = {},
): FrameMeasurement {
  const levelDb = toDecibels(rms(samples), DB_FLOOR);
  const attackSamples = samples.length > ONSET_WINDOW
    ? samples.subarray(samples.length - ONSET_WINDOW)
    : samples;
  const attackSpectrum = amplitudeSpectrum(attackSamples);

  if (options.withPitch === false) return { levelDb, attackSpectrum, spectrum: null, detection: null };

  const spectrum = amplitudeSpectrum(samples);
  const detection = analyseSpectrum(spectrum, sampleRate, {
    lowMidi: options.lowMidi ?? LOWEST_MIDI,
    highMidi: options.highMidi ?? HIGHEST_MIDI,
    octaveEvidence: options.octaveEvidence,
  });
  return { levelDb, attackSpectrum, spectrum, detection };
}

export interface ListenerOptions {
  lowMidi?: number;
  highMidi?: number;
  /** Below this credibility a pressione is noise and does not enter. */
  minCredibility?: number;
  /** How long the pitch waits after an attack. */
  readDelayMs?: number;
  octaveEvidence?: boolean;
}

/** What one frame of listening produced. */
export interface ListenerFrame {
  at: number;
  levelDb: number;
  /** The spectrum the pitch was read from. */
  spectrum: Float32Array;
  detection: Detection;
  /** The spectrum the attack was heard on. */
  attackSpectrum: Float32Array;
  /** True when this frame holds an attack. */
  struck: boolean;
  /** Flux of this frame, for display. */
  flux: number;
  /** Trigger level this frame was compared against, for display. */
  threshold: number;
  /** True when the detector may fire again: it has heard the sound fall back. */
  armed: boolean;
  /** True when a pressione was waiting for the note to settle while this frame passed. */
  reading: boolean;
  /** How many frames in a row the winner has been the same key, this frame included. */
  stability: number;
  /** The pressioni this frame completed: none, or one. */
  pressioni: Pressione[];
}

export interface Listener {
  readonly range: NoteRange;
  readonly minCredibility: number;
  /** True while a pressione waits for the note to settle. */
  readonly pending: boolean;
  /** Change the exercise range. Onset and stability start over: the old ones were about other keys. */
  setRange(low: number, high: number): void;
  setMinCredibility(value: number): void;
  /** Forget the sound heard so far — every attack after this one is the first. */
  resetOnset(): void;
  /** Drop a pressione that was waiting: nothing of the old sound may be judged. */
  clearPending(): void;
  /**
   * Feed one buffer of `samples.length` samples, taken at `nowMs` on the caller's
   * clock. Returns what the frame produced, including any pressione it completed.
   */
  push(samples: Float32Array | Float64Array, sampleRate: number, nowMs: number): ListenerFrame;
  /**
   * Package what is in front of the microphone right now as a pressione, whatever
   * its credibility: this is the measure button of the spike, a deliberate act,
   * not a pressione the exercise has to judge. Null before the first frame.
   */
  capture(nowMs: number): Pressione | null;
}

export function createListener(options: ListenerOptions = {}): Listener {
  let range: NoteRange = {
    low: options.lowMidi ?? LOWEST_MIDI,
    high: options.highMidi ?? HIGHEST_MIDI,
  };
  let minCredibility = options.minCredibility ?? 0;
  const readDelayMs = options.readDelayMs ?? READ_DELAY_MS;
  const octaveEvidence = options.octaveEvidence;

  const onset = createOnsetDetector();
  let winners: number[] = [];
  let pendingAt: number | null = null;
  let lastLevelDb = DB_FLOOR;
  let lastDetection: Detection | null = null;
  let lastStability = 0;

  function pressione(at: number): Pressione | null {
    const detection = lastDetection;
    if (detection === null) return null;
    return {
      at,
      midi: detection.best.midi,
      hz: detection.best.hz,
      ambiguous: detection.ambiguous,
      credibility: detection.credibility,
      levelDb: lastLevelDb,
      stability: lastStability,
      detection,
    };
  }

  function push(
    samples: Float32Array | Float64Array,
    sampleRate: number,
    nowMs: number,
  ): ListenerFrame {
    const measurement = measureFrame(samples, sampleRate, {
      lowMidi: range.low,
      highMidi: range.high,
      withPitch: true,
      octaveEvidence,
    });
    const detection = measurement.detection;

    lastLevelDb = measurement.levelDb;
    lastDetection = detection;

    winners.push(detection.best.midi);
    if (winners.length > STABILITY_FRAMES) winners.shift();
    let stability = 0;
    for (let index = winners.length - 1; index >= 0; index--) {
      if (winners[index] !== detection.best.midi) break;
      stability++;
    }
    lastStability = stability;

    const struck = onset.push(measurement.attackSpectrum, nowMs);
    if (struck) pendingAt = nowMs;
    // Read before clearing: the frame that judges a pressione is still the frame in
    // which the page says it is about to.
    const reading = pendingAt !== null;

    // Read the pitch after the note has settled, not at the attack: the 341 ms
    // window is still filling with the silence that came before it.
    const pressioni: Pressione[] = [];
    if (pendingAt !== null && nowMs - pendingAt >= readDelayMs) {
      const at = pendingAt;
      pendingAt = null;
      const read = pressione(at);
      if (read !== null && read.credibility >= minCredibility) pressioni.push(read);
    }

    return {
      at: nowMs,
      levelDb: measurement.levelDb,
      spectrum: measurement.spectrum,
      detection,
      attackSpectrum: measurement.attackSpectrum,
      struck,
      flux: onset.flux,
      threshold: onset.threshold,
      armed: onset.armed,
      reading,
      stability,
      pressioni,
    };
  }

  return {
    push,
    capture: pressione,
    setRange(low: number, high: number): void {
      range = { low, high };
      onset.reset();
      winners = [];
    },
    setMinCredibility(value: number): void {
      minCredibility = value;
    },
    resetOnset(): void {
      onset.reset();
    },
    clearPending(): void {
      pendingAt = null;
    },
    get range() {
      return range;
    },
    get minCredibility() {
      return minCredibility;
    },
    get pending() {
      return pendingAt !== null;
    },
  };
}

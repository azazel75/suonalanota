/**
 * :Project:  suona-la-nota -- the five notes of the soundcheck
 * :Created:  lun 09 nov 2026 01:45:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The soundcheck as a state machine: five probes, one at a time, and a
 * measurement at the end. No microphone, no screen, no clock of its own — the
 * caller hands over frames and the instant they were taken, and asks what the
 * probes add up to.
 *
 * The protocol is the ticket's, and each clause is a decision:
 *
 *  - **the extent is measured, not assumed**: the allievə plays the lowest
 *    and the highest key of the instrument, and what the detector names is what
 *    the instrument has. A "how many keys" dropdown would be a shortcut, and a
 *    shortcut is not a measurement;
 *  - **the portata repeats the two extremes** and adds the middle C as a
 *    control: a phone that hears both ends but not Do4 is not measuring a
 *    portata, it is not hearing the note at all, and the screen says to check
 *    the volume instead of saving a nonsense interval;
 *  - **an unheard extreme falls back to Do4**, never to a guessed octave: the
 *    interval can only shrink, and it shrinks to the outermost key the device
 *    proved; two ends that cross mean the allievə did not play what was asked,
 *    and no interval is a measurement;
 *  - **three ambiguous colpi in a row on the same key** give that key up
 *    (ADR 0008): that is a fact about the device, not about the allievə;
 *  - **a room that never made a sound** is answered with the volume sentence,
 *    not with four more timeouts (the ticket's headphones clause) — but only
 *    after two notes in a row, because a hand slower than six seconds is not a
 *    muted phone.
 */
import { SILENCE_LEVEL_DB } from './controller';
import { PORTATA_VERSION, type Portata } from './portata';

/** The five probes, in the order they are asked. */
export const PROBES = ['basso', 'alto', 'basso2', 'alto2', 'centrale'] as const;

export type Probe = (typeof PROBES)[number];

/** Six seconds a note: five notes are the ticket's thirty seconds. */
export const PROBE_TIMEOUT_MS = 6_000;

/**
 * Below this level a frame is the room, not a note. The threshold is the
 * exercise's own (`session/controller`): the two must agree, or a note quiet
 * enough to be "silence" mid-session would still count as heard here.
 */
const QUIET_DB = SILENCE_LEVEL_DB;

/** The control note: Do4, the middle C. */
const CENTRAL = 60;

/** The two probes that measure each end, and the control. */
const BASS: readonly Probe[] = ['basso', 'basso2'];
const TREBLE: readonly Probe[] = ['alto', 'alto2'];

/** A colpo, as far as the soundcheck cares: which key, and whether it was decided. */
export interface SoundcheckColpo {
  readonly midi: number;
  readonly ambiguous: boolean;
}

/** One frame of the microphone. */
export interface SoundcheckFrame {
  readonly levelDb: number;
  readonly colpi: readonly SoundcheckColpo[];
}

export interface SoundcheckOptions {
  /** The instant the measurement is stamped with, when it ends. */
  readonly when: Date;
  readonly timeoutMs?: number;
  /** Below this level the room is silent, and a timeout is a volume problem. */
  readonly quietDb?: number;
}

/** What the screen reads after every frame. */
export interface SoundcheckSnapshot {
  /** The probe being asked, or `null` before the start and after the end. */
  readonly probe: Probe | null;
  /** 1…5 while running; 0 before the start, and 5 once finished. */
  readonly index: number;
  readonly finished: boolean;
  /** True when a timeout found the room silent: it is the volume, not the note. */
  readonly silent: boolean;
  /** The measurement, when the probes added up to one. */
  readonly portata: Portata | null;
  /** What each probe heard. */
  readonly heard: ReadonlyMap<Probe, number>;
  /** Keys the detector kept confusing, in the order they were given up. */
  readonly excluded: readonly number[];
}

export interface Soundcheck {
  /** Called when the microphone is open: the first probe starts now. */
  start(now: number): void;
  /** One frame of listening. Also moves the clock: a probe that runs out advances. */
  feed(now: number, frame: SoundcheckFrame): void;
  snapshot(): SoundcheckSnapshot;
}

export function createSoundcheck(options: SoundcheckOptions): Soundcheck {
  const timeoutMs = options.timeoutMs ?? PROBE_TIMEOUT_MS;
  const quietDb = options.quietDb ?? QUIET_DB;

  let index = 0;
  let probeStartedAt = 0;
  let finished = false;
  let silent = false;
  let peak = Number.NEGATIVE_INFINITY;
  let portata: Portata | null = null;
  const heard = new Map<Probe, number>();
  const excluded: number[] = [];
  /** How many ambiguous colpi in a row named the same key, and which. */
  let confused: { midi: number; count: number } | null = null;
  /** Quiet timeouts in a row: the second one is the volume, the first a slow hand. */
  let quietTimeouts = 0;

  function currentProbe(): Probe | null {
    return index >= 1 && index <= PROBES.length ? PROBES[index - 1] : null;
  }

  /** The lowest key heard on the bottom probes, or `null` when none was. */
  function lowestHeard(): number | null {
    const keys = BASS.map((probe) => heard.get(probe)).filter(
      (key): key is number => key !== undefined,
    );
    return keys.length === 0 ? null : Math.min(...keys);
  }

  /** The highest key heard on the top probes, or `null` when none was. */
  function highestHeard(): number | null {
    const keys = TREBLE.map((probe) => heard.get(probe)).filter(
      (key): key is number => key !== undefined,
    );
    return keys.length === 0 ? null : Math.max(...keys);
  }

  function measurement(): Portata | null {
    if (!heard.has('centrale')) return null;
    const lowest = lowestHeard() ?? CENTRAL;
    const highest = highestHeard() ?? CENTRAL;
    // Two ends that cross: the "lowest" key was heard above the "highest" one,
    // so the allievə did not play what was asked. Widening one into the other
    // would be inventing the interval the measurement refused to give.
    if (lowest > highest) return null;
    return {
      versione: PORTATA_VERSION,
      quando: options.when.toISOString(),
      sente: { lowest, highest },
      esclusi: [...excluded],
    };
  }

  function finish(): void {
    finished = true;
    portata = measurement();
  }

  /** The current probe is over: the next one starts now. */
  function advance(now: number): void {
    confused = null;
    index += 1;
    probeStartedAt = now;
    if (index > PROBES.length) {
      // The counter stops at the last probe: "5 di 5" is the number a reader
      // understands, not "6 di 5".
      index = PROBES.length;
      finish();
    }
  }

  function giveUp(midi: number, now: number): void {
    // A key the detector cannot decide three times in a row is a fact about the
    // device: it leaves the portata, and the probe moves on without it.
    if (!excluded.includes(midi)) excluded.push(midi);
    advance(now);
  }

  function hear(midi: number, now: number): void {
    const probe = currentProbe();
    if (probe === null) return;
    heard.set(probe, midi);
    // A note was played: whatever silence came before is not the room's.
    quietTimeouts = 0;
    advance(now);
  }

  function onColpo(colpo: SoundcheckColpo, now: number): void {
    if (colpo.ambiguous) {
      confused =
        confused !== null && confused.midi === colpo.midi
          ? { midi: colpo.midi, count: confused.count + 1 }
          : { midi: colpo.midi, count: 1 };
      if (confused.count >= 3) giveUp(colpo.midi, now);
      return;
    }
    confused = null;
    hear(colpo.midi, now);
  }

  function start(now: number): void {
    if (index !== 0) return;
    index = 1;
    probeStartedAt = now;
  }

  function feed(now: number, frame: SoundcheckFrame): void {
    if (index === 0 || finished) return;

    peak = Math.max(peak, frame.levelDb);
    // The listener completes at most one colpo per frame; the rest of the frame
    // would belong to a probe that has just started, and is not evidence for it.
    const colpo = frame.colpi[0];
    if (colpo !== undefined) onColpo(colpo, now);
    if (finished) return;

    if (now - probeStartedAt < timeoutMs) return;
    if (peak <= quietDb) {
      quietTimeouts += 1;
      // One quiet note can be a hand that has not found the key yet; the second
      // in a row is the room, and asking three more times would blame the allievə.
      if (quietTimeouts >= 2) {
        silent = true;
        finish();
        return;
      }
      advance(now);
      return;
    }
    quietTimeouts = 0;
    advance(now);
  }

  return {
    start,
    feed,
    snapshot(): SoundcheckSnapshot {
      return {
        probe: finished ? null : currentProbe(),
        index,
        finished,
        silent,
        portata,
        heard,
        excluded: [...excluded],
      };
    },
  };
}

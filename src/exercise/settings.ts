/**
 * :Project:  suona-la-nota -- the trial the teacher prepares
 * :Created:  dom 08 nov 2026 23:58:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * What a settings screen produces. The settings are chosen **before** the
 * session and never touched while it runs: changing them halfway would change
 * the exercise halfway, and the score would stop meaning anything
 * (docs/spec-esercizio.md). Keeping the rules here — and not in the page —
 * means the trial can be read in a test instead of watched on a phone.
 *
 * Three decisions this module makes, and why:
 *
 *  - a range is a pair of keys clamped to the piano and put back in order, so
 *    the two controls cannot produce a range that no key satisfies;
 *  - `null` is the only way a settings object says "no cap": a number is a cap,
 *    and a number below one is a mistake the controls cannot make, so it is
 *    lifted to one rather than silently read as off;
 *  - the **random** sequence is a shuffle, not a draw: a key already asked
 *    cannot come back in the same session, and when the range is exhausted the
 *    session ends by itself with the engine's `targets` reason;
 *  - a **preset** or a **list** is filtered on the active range: the spec says
 *    no note outside the range is ever proposed, so the sequence shortens
 *    instead of asking for a key the allievə cannot play — and if nothing is
 *    left, `problemWith` says it instead of starting an empty session.
 *
 * The presets are a didactic choice, not a measurement: difficulty grows with
 * the distance from the middle C and with the ledger lines. All of them stay
 * inside the base range, so they play on both ranges; a narrower range filters
 * them like everything else. The names are what a teacher reads on the screen.
 */
import { HIGHEST_MIDI, LOWEST_MIDI } from '../audio/notes';
import {
  ADVANCED_RANGE,
  BASE_RANGE,
  isInRange,
  keysInRange,
  type KeyRange,
} from '../score/staff';
import {
  DEFAULT_DURATION_MS,
  DEFAULT_TARGET_TIMEOUT_MS,
  type SessionConfig,
} from '../session/engine';

/** The three ways a session picks its targets. */
export type SequenceMode = 'random' | 'preset' | 'list';

/** The three modes, once, for both the URL and the page: no second whitelist to drift. */
export const SEQUENCE_MODES: readonly SequenceMode[] = ['random', 'preset', 'list'];

/** Whether a string is a mode, so a value read from the page or the URL can be trusted. */
export function isSequenceMode(value: string | null): value is SequenceMode {
  return value !== null && (SEQUENCE_MODES as readonly string[]).includes(value);
}

/** A progressive sequence that ships with the application. */
export interface Preset {
  readonly id: string;
  /** What the settings screen shows. */
  readonly name: string;
  /** The keys, in the order they are asked: the first is the easiest. */
  readonly keys: readonly number[];
}

/** Do3 → Si3, the bass staff and the space above it, ascending. */
const BASS_STAFF = [48, 50, 52, 53, 55, 57, 59];

/** Do4 → Do5, the treble staff with the middle C on its one ledger line. */
const TREBLE_STAFF = [60, 62, 64, 65, 67, 69, 71, 72];

/**
 * The two writings of the same name, one after the other: the exercise of
 * reading the clef, not the key. Do4 in the treble, Do3 in the bass, and so on.
 */
const BOTH_CLEFS = [60, 48, 62, 50, 64, 52, 65, 53, 67, 55, 69, 57, 71, 59];

/** The presets, easiest first: one clef, then the other, then both. */
export const PRESETS: readonly Preset[] = [
  { id: 'prime-note', name: 'Prime note, in violino', keys: TREBLE_STAFF },
  { id: 'rigo-di-basso', name: 'Il rigo di basso', keys: BASS_STAFF },
  { id: 'due-chiavi', name: 'Le due chiavi', keys: BOTH_CLEFS },
];

/** Everything the teacher chooses before the allievə starts. */
export interface Settings {
  /** The keys a session may ask for, lowest and highest included. */
  readonly range: KeyRange;
  /** Length of the whole session, in milliseconds. */
  readonly durationMs: number;
  /** Time a single target stays on screen, in milliseconds. */
  readonly targetTimeoutMs: number;
  /** Wrong colpi that close a target as *wrong*; `null` when the cap is off. */
  readonly wrongLimit: number | null;
  readonly mode: SequenceMode;
  /** The preset in force when the mode is `preset`. */
  readonly presetId: string;
  /** The teacher's list, in the order she composed it; empty until ticket 07. */
  readonly list: readonly number[];
}

/** What a phone finds playable on the first opening, with no choice made. */
export const DEFAULT_SETTINGS: Settings = {
  range: BASE_RANGE,
  durationMs: DEFAULT_DURATION_MS,
  targetTimeoutMs: DEFAULT_TARGET_TIMEOUT_MS,
  wrongLimit: null,
  mode: 'random',
  presetId: PRESETS[0].id,
  list: [],
};

/** A key of the piano, rounded: the controls cannot point outside it. */
export function clampKey(midi: number): number {
  return Math.min(HIGHEST_MIDI, Math.max(LOWEST_MIDI, Math.round(midi)));
}

/** A range the two controls can produce: inside the piano, lowest first. */
export function clampRange(lowest: number, highest: number): KeyRange {
  const first = clampKey(lowest);
  const second = clampKey(highest);
  return first <= second
    ? { lowest: first, highest: second }
    : { lowest: second, highest: first };
}

/** Whole and positive, or the fallback: a clock at zero is no clock at all. */
function positiveClock(value: number, fallback: number): number {
  const rounded = Math.round(value);
  return Number.isFinite(value) && rounded > 0 ? rounded : fallback;
}

/** The settings as the session will see them: range in order, clocks real, cap off only when it says so. */
export function normalise(settings: Settings): Settings {
  const limit = settings.wrongLimit;
  return {
    ...settings,
    range: clampRange(settings.range.lowest, settings.range.highest),
    durationMs: positiveClock(settings.durationMs, DEFAULT_DURATION_MS),
    targetTimeoutMs: positiveClock(settings.targetTimeoutMs, DEFAULT_TARGET_TIMEOUT_MS),
    // `null` is the cap being off, and only that. A number is a cap; below one
    // is a control mistake, lifted rather than read as "off", because the
    // checkbox saying on and the engine doing nothing is a lie on screen.
    wrongLimit: limit === null || !Number.isFinite(limit) ? null : Math.max(1, Math.floor(limit)),
    list: settings.list.filter((key) => Number.isInteger(key)),
  };
}

/** What the engine needs to know: the two clocks and the cap, if there is one. */
export function sessionConfigOf(settings: Settings): SessionConfig {
  return {
    durationMs: settings.durationMs,
    targetTimeoutMs: settings.targetTimeoutMs,
    wrongLimit: settings.wrongLimit ?? undefined,
  };
}

/**
 * Every key of the range, once, in an order that is not the order of the
 * keyboard. A shuffle instead of a draw is what makes "no key twice" true by
 * construction rather than by luck.
 */
export function randomSequence(
  range: KeyRange,
  random: () => number = Math.random,
): number[] {
  const keys = keysInRange(range);
  for (let index = keys.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [keys[index], keys[other]] = [keys[other], keys[index]];
  }
  return keys;
}

/** The chosen preset, shortened to the active range. */
export function presetKeys(settings: Settings): number[] {
  const preset = PRESETS.find((candidate) => candidate.id === settings.presetId);
  if (preset === undefined) return [];
  return preset.keys.filter((key) => isInRange(key, settings.range));
}

/** The teacher's list, in her order, without what the range excludes. */
export function listKeys(settings: Settings): number[] {
  return settings.list.filter((key) => isInRange(key, settings.range));
}

/** The targets before any shuffling: what each mode can ask for, in its own order. */
function targetsOf(settings: Settings): number[] {
  if (settings.mode === 'preset') return presetKeys(settings);
  if (settings.mode === 'list') return listKeys(settings);
  return keysInRange(settings.range);
}

/** The targets of the session, in the order they will be asked. */
export function sequenceFor(
  settings: Settings,
  random: () => number = Math.random,
): number[] {
  if (settings.mode === 'random') return randomSequence(settings.range, random);
  return targetsOf(settings);
}

const NOTHING_TO_ASK: Readonly<Record<SequenceMode, string>> = {
  random: 'Il range scelto non contiene nessuna nota.',
  preset: 'La progressione scelta non ha note nel range.',
  list: 'La lista è vuota: nessuna nota da chiedere.',
};

/** The list has keys, but not one of them is in the range in force. */
const LIST_OUTSIDE_RANGE = 'Nessun tasto della lista è nel range scelto.';

/**
 * Why this trial cannot start, or `null` when it can. The page asks before
 * opening the microphone: a session without targets would be over before the
 * allievə sees the first note, and the summary would blame nobody.
 *
 * A list that is not empty but has nothing in the range is not an empty list,
 * and saying so would contradict the line under the keyboard that counts the
 * keys left outside.
 */
export function problemWith(settings: Settings): string | null {
  if (targetsOf(settings).length > 0) return null;
  if (settings.mode === 'list' && settings.list.length > 0) return LIST_OUTSIDE_RANGE;
  return NOTHING_TO_ASK[settings.mode];
}

/** The parameters a URL may use to dictate the trial, all optional. */
const CONFIGURATION_PARAMETERS = [
  'range',
  'lowest',
  'highest',
  'duration',
  'timeout',
  'cap',
  'mode',
  'preset',
] as const;

/** The two ranges a URL may name, as names rather than as numbers. */
const RANGE_PRESETS: Readonly<Record<string, KeyRange>> = {
  base: BASE_RANGE,
  advanced: ADVANCED_RANGE,
};

export interface TrialFromUrl {
  readonly settings: Settings;
  /**
   * True when the URL chose the trial, so the configuration screen is skipped.
   * It says nothing about the soundcheck: when ticket 09 adds that step, the
   * step itself will decide whether the URL skipped it.
   */
  readonly skipSetup: boolean;
}

/** A number from the URL, or null when the parameter is absent or not a number. */
function numberParameter(params: URLSearchParams, name: string): number | null {
  const raw = params.get(name);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * The trial a URL dictates: the main parameters it carries, the defaults for
 * the ones it leaves out. `duration` and `timeout` are seconds, `lowest` and
 * `highest` are MIDI numbers, `cap` is a number of wrong colpi (absent or below
 * one means no cap), `mode` is `random`, `preset` or `list`, `preset` is one of
 * `PRESETS`, `range` is `base` or `advanced`. A value that makes no sense is
 * ignored — but its presence still means the URL chose the trial, so the
 * confirmation is skipped either way.
 */
export function settingsFromQuery(params: URLSearchParams): TrialFromUrl {
  const named = params.get('range');
  let range = named === null ? DEFAULT_SETTINGS.range : RANGE_PRESETS[named] ?? DEFAULT_SETTINGS.range;

  const lowest = numberParameter(params, 'lowest');
  const highest = numberParameter(params, 'highest');
  if (lowest !== null || highest !== null) {
    range = clampRange(lowest ?? range.lowest, highest ?? range.highest);
  }

  const duration = numberParameter(params, 'duration');
  const timeout = numberParameter(params, 'timeout');
  const cap = numberParameter(params, 'cap');
  const presetId = params.get('preset');
  const knownPreset = PRESETS.some((preset) => preset.id === presetId);
  const mode = params.get('mode');

  const settings = normalise({
    ...DEFAULT_SETTINGS,
    range,
    durationMs: duration === null ? DEFAULT_SETTINGS.durationMs : duration * 1000,
    targetTimeoutMs: timeout === null ? DEFAULT_SETTINGS.targetTimeoutMs : timeout * 1000,
    // A link has no checkbox: absent is off, and so is a number that cannot be
    // a cap. Lifting a zero to one is a rule for the controls, not for a URL.
    wrongLimit: cap !== null && cap >= 1 ? cap : null,
    mode: isSequenceMode(mode) ? mode : DEFAULT_SETTINGS.mode,
    presetId: knownPreset && presetId !== null ? presetId : DEFAULT_SETTINGS.presetId,
  });

  return {
    settings,
    skipSetup: CONFIGURATION_PARAMETERS.some((name) => params.has(name)),
  };
}

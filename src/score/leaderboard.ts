/**
 * :Project:  suona-la-nota -- the leaderboard of a trial
 * :Created:  lun 09 nov 2026 00:36:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The classifica: one row per allievə, kept on the phone, for **one trial**. It
 * is the first place in this application where a name is written down, and the
 * name is typed by a ten-year-old, so the rules are here rather than in the
 * summary screen: a row that is wrong is wrong on every phone, and a test can
 * read it.
 *
 * Four decisions, and why:
 *
 *  - **a row per name, not per run.** A ragazzə who plays five times appears
 *    once, with his best run: more corrette, then more note al minuto, then the
 *    most recent. Those are the same three criteria that order the board, so
 *    "the best run" and "the row above" cannot disagree. The comparison is
 *    case-insensitive — `Marta` and `marta` are one person on one phone — and
 *    the row keeps the spelling of the run that won.
 *  - **the key of a board is the trial**: range, duration, target timeout, cap
 *    and mode (`trialKey`). A twenty-notes-a-minute score on the base range and
 *    an eight on the advanced one are not two numbers of the same thing. The
 *    preset and the teacher's list are **not** in the key: the ticket names
 *    five fields, and two lists of notes are not two exercises in the sense a
 *    score is compared in.
 *  - **one storage document per trial**, under a key that carries the trial, so
 *    a board that a phone mangled costs one classifica and not every classifica
 *    on that phone. The document is versioned, like the two files of ADR 0012,
 *    and a version we do not know is refused rather than read on a guess.
 *  - **`when` is a number of milliseconds, not an ISO string.** The two files
 *    of ADR 0012 travel to a maestra who reads them; a leaderboard never leaves
 *    the device, so the instant only has to sort and to survive a round trip,
 *    and an integer does both without parsing a date that could be wrong.
 *
 * The names of the stored fields are Italian (`nome`, `corrette`,
 * `note_al_minuto`, `quando_ms`) because the document is part of the same family
 * the list and the log belong to; the code around them is English, as
 * everywhere in this repository.
 *
 * The storage is a port, not `localStorage`: a phone in private mode throws on
 * the first write, and a leaderboard that cannot be saved must not take the
 * summary down with it. Every function here says what it does by its return
 * value, never by an exception.
 */
import { normalise, type Settings } from '../exercise/settings';

/** What the page needs from `localStorage`, and nothing more (as in `exercise/list`). */
export interface LeaderboardStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The version of the stored document. One that says another version is refused. */
export const LEADERBOARD_VERSION = 1;

/** The prefix of every board: one document per trial, under `<prefix>.<trial>`. */
export const LEADERBOARD_STORAGE_KEY = 'suona-la-nota.classifica';

/** The name of the last run, so the field is already full the next time. */
export const LAST_NAME_STORAGE_KEY = 'suona-la-nota.nome';

/** How many rows the summary shows before the player's own row takes over. */
export const TOP_ROWS = 5;

/** The longest name the field, and the board, will keep. */
export const NAME_MAX_LENGTH = 20;

/** One run on the board: the numbers the summary shows and the instant it ended. */
export interface ScoreEntry {
  readonly name: string;
  readonly corrette: number;
  /** Notes read in a minute, the number the engine rounds to a decimal. */
  readonly notePerMinute: number;
  /** When the session ended, epoch milliseconds. */
  readonly when: number;
}

/** A row of the board as the screen draws it. */
export interface RankedRow extends ScoreEntry {
  /** 1 for the first: the place a ragazzə reads. */
  readonly place: number;
  /** True for the row of the player looking at the screen. */
  readonly self: boolean;
}

/** What the screen draws: the top, the player's row, and where that row stands. */
export interface Standings {
  readonly rows: readonly RankedRow[];
  /** The player's place, 1-based; `null` when no name was saved yet. */
  readonly place: number | null;
  /** How many players the trial has, including the ones below the top. */
  readonly total: number;
}

/** What a stored document produced: the rows, or why it was not a board. */
export type BoardImport =
  | {
      readonly kind: 'ok';
      /** The trial the document says it belongs to. */
      readonly trial: string;
      /** The rows of the file, in its order, without repeats. */
      readonly entries: ScoreEntry[];
      /** The rows that made no sense: reported, and left out. */
      readonly dropped: number;
    }
  | {
      readonly kind: 'invalid';
      /** One short Italian sentence, for the log of a developer and not a child. */
      readonly message: string;
    };

/**
 * A name as the board keeps it: one line, no space around it, and no longer
 * than the field. A name that is only spaces stays empty, and the caller
 * decides what an empty name means.
 */
export function cleanName(raw: string): string {
  const single = raw.replace(/\s+/gu, ' ').trim();
  return single.slice(0, NAME_MAX_LENGTH).trim();
}

/** The identity of a name: one person is one row, whatever the capitals. */
function nameKey(name: string): string {
  return cleanName(name).toLowerCase();
}

/**
 * The trial a board belongs to, as a short string: range, duration, target
 * timeout, cap (`-` when it is off) and mode. Millisecond clocks, not seconds,
 * because the key must not merge two trials the settings can tell apart.
 */
export function trialKey(settings: Settings): string {
  const trial = normalise(settings);
  const cap = trial.wrongLimit === null ? '-' : String(trial.wrongLimit);
  return [
    `${trial.range.lowest}-${trial.range.highest}`,
    trial.durationMs,
    trial.targetTimeoutMs,
    cap,
    trial.mode,
  ].join('|');
}

/** Where the board of this trial is remembered. */
export function boardStorageKey(settings: Settings): string {
  return `${LEADERBOARD_STORAGE_KEY}.${trialKey(settings)}`;
}

/**
 * Which of two runs is the better one: negative when `a` comes first. More
 * corrette, then more note al minuto, then the more recent — the last clause is
 * what makes a tie keep the newer run instead of the first one seen.
 */
export function compareRuns(a: ScoreEntry, b: ScoreEntry): number {
  if (a.corrette !== b.corrette) return b.corrette - a.corrette;
  if (a.notePerMinute !== b.notePerMinute) return b.notePerMinute - a.notePerMinute;
  return b.when - a.when;
}

/**
 * The board as it should be read: one row per name, keeping the best run, in
 * the order of `compareRuns`. It is a reduction and not a sort, because two
 * runs of the same name are one row and the survivor is decided, not ranked.
 */
export function ranked(entries: readonly ScoreEntry[]): ScoreEntry[] {
  const best = new Map<string, ScoreEntry>();
  for (const entry of entries) {
    const key = nameKey(entry.name);
    const kept = best.get(key);
    if (kept === undefined || compareRuns(entry, kept) < 0) best.set(key, entry);
  }
  return [...best.values()].sort(compareRuns);
}

/** The first `utenteN` no run on this board has taken. */
export function freeName(entries: readonly ScoreEntry[]): string {
  const taken = new Set(entries.map((entry) => nameKey(entry.name)));
  let number = 1;
  while (taken.has(`utente${number}`)) number += 1;
  return `utente${number}`;
}

/**
 * The name a run is saved under: what was typed, or the first free `utenteN`
 * when nothing was. The field being empty is not a mistake to report — the
 * ragazzə may not want to type a name — so it gets one, and the board says so.
 */
export function resolveName(typed: string, entries: readonly ScoreEntry[]): string {
  const name = cleanName(typed);
  return name === '' ? freeName(entries) : name;
}

/** Adds a run to the board, keeping one row per name. */
export function recordRun(entries: readonly ScoreEntry[], run: ScoreEntry): ScoreEntry[] {
  const named = { ...run, name: resolveName(run.name, entries) };
  return ranked([...entries, named]);
}

/**
 * What the screen shows: the first `visible` rows, with the player marked, and
 * the player's own row appended below them when they did not make the top.
 * The place is computed on the whole board, so it is the same number whether
 * the row is on screen or not.
 */
export function standings(
  entries: readonly ScoreEntry[],
  name: string | null,
  visible: number = TOP_ROWS,
): Standings {
  const board = ranked(entries);
  const who = name === null ? null : nameKey(name);
  const at = who === null ? -1 : board.findIndex((entry) => nameKey(entry.name) === who);

  const rows: RankedRow[] = board
    .slice(0, Math.max(0, Math.floor(visible)))
    .map((entry, index) => ({ ...entry, place: index + 1, self: index === at }));
  // Outside the top: the row is still shown, because a place nobody can see is
  // a place the allievə has to ask an adult about.
  if (at >= rows.length) rows.push({ ...board[at], place: at + 1, self: true });

  return { rows, place: at < 0 ? null : at + 1, total: board.length };
}

/** A JSON value as an object, or `null` when it is anything else. */
function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** A row of the document as a run, or `null` when it is not one. */
function entryOf(value: unknown): ScoreEntry | null {
  const row = asObject(value);
  if (row === null) return null;

  const name = typeof row.nome === 'string' ? cleanName(row.nome) : '';
  const corrette = row.corrette;
  const rate = row.note_al_minuto;
  const when = row.quando_ms;

  if (name === '') return null;
  if (typeof corrette !== 'number' || !Number.isInteger(corrette) || corrette < 0) return null;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) return null;
  if (typeof when !== 'number' || !Number.isFinite(when) || when < 0) return null;

  return { name, corrette, notePerMinute: rate, when: Math.round(when) };
}

/**
 * The board as the document a phone keeps: versioned, indented, and carrying
 * the trial it belongs to, so a board that arrives under the wrong key can be
 * recognised instead of read. The rows are written as they are given; `saveBoard`
 * is what puts them in order.
 */
export function boardToJson(settings: Settings, entries: readonly ScoreEntry[]): string {
  const document = {
    versione: LEADERBOARD_VERSION,
    prova: trialKey(settings),
    voci: entries.map((entry) => ({
      nome: entry.name,
      corrette: entry.corrette,
      note_al_minuto: entry.notePerMinute,
      quando_ms: entry.when,
    })),
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

/**
 * What a stored document says, or why it is not a board. The document as a
 * whole is refused when its shape is not ours; a **row** that makes no sense is
 * reported and left out, because one mangled row must not cost a classifica
 * every ragazzə on that phone can still read.
 */
export function boardFromJson(text: string): BoardImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'invalid', message: 'La classifica salvata non è leggibile: non è un JSON.' };
  }

  const document = asObject(parsed);
  if (document === null) {
    return { kind: 'invalid', message: 'La classifica salvata non è leggibile: sembra un altro file.' };
  }

  const version = document.versione;
  if (version === undefined) {
    return { kind: 'invalid', message: 'La classifica salvata non è leggibile: manca la versione.' };
  }
  if (version !== LEADERBOARD_VERSION) {
    return {
      kind: 'invalid',
      message: `Questa classifica è della versione ${String(version)}, che non conosco: aggiorna l'applicazione.`,
    };
  }

  const trial = document.prova;
  if (typeof trial !== 'string' || trial === '') {
    return { kind: 'invalid', message: 'La classifica salvata non dice a che prova appartiene.' };
  }

  const raw = document.voci;
  if (!Array.isArray(raw)) {
    return { kind: 'invalid', message: 'La classifica salvata non è leggibile: «voci» deve essere un elenco.' };
  }

  const entries: ScoreEntry[] = [];
  let dropped = 0;
  for (const value of raw) {
    const entry = entryOf(value);
    if (entry === null) dropped += 1;
    else entries.push(entry);
  }
  return { kind: 'ok', trial, entries, dropped };
}

/**
 * The board of this trial as it was left, or nothing. A missing document, a
 * storage that throws, a document of another version, a document that says it
 * belongs to another trial: an empty board, not an error on a screen a child is
 * looking at.
 */
export function loadBoard(storage: LeaderboardStorage | null, settings: Settings): ScoreEntry[] {
  try {
    const text = storage?.getItem(boardStorageKey(settings)) ?? null;
    if (text === null) return [];
    const read = boardFromJson(text);
    if (read.kind !== 'ok' || read.trial !== trialKey(settings)) return [];
    // The document is written in order; reading it in order is not assumed.
    return ranked(read.entries);
  } catch {
    return [];
  }
}

/** Remembers the board of this trial. A storage that refuses keeps it until the reload. */
export function saveBoard(
  storage: LeaderboardStorage | null,
  settings: Settings,
  entries: readonly ScoreEntry[],
): void {
  try {
    storage?.setItem(boardStorageKey(settings), boardToJson(settings, ranked(entries)));
  } catch {
    // Nothing to do and nothing to say: the summary still shows this session.
  }
}

/** The name of the last run on this phone, or `null` when there was none. */
export function loadLastName(storage: LeaderboardStorage | null): string | null {
  try {
    const text = storage?.getItem(LAST_NAME_STORAGE_KEY) ?? null;
    if (text === null) return null;
    const name = cleanName(text);
    return name === '' ? null : name;
  } catch {
    return null;
  }
}

/** Remembers the name, so the next summary opens with the field already full. */
export function saveLastName(storage: LeaderboardStorage | null, name: string): void {
  const clean = cleanName(name);
  if (clean === '') return;
  try {
    storage?.setItem(LAST_NAME_STORAGE_KEY, clean);
  } catch {
    // A name that cannot be kept is a field to fill again, not an error.
  }
}

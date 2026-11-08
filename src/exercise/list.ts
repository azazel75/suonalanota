/**
 * :Project:  suona-la-nota -- the list the teacher composes
 * :Created:  dom 08 nov 2026 23:40:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The teacher's list: the keys a session asks for, in the order she ticked
 * them. It is the only thing a maestra types and then hands to another person,
 * so it has to outlive the page and to survive a file that is not ours.
 *
 * Four decisions, and why:
 *
 *  - the order is the list. A list without an order is a set, and a set cannot
 *    say which note comes first — which is the didactic point of composing it
 *    by hand;
 *  - a key twice is impossible, not deduplicated on read: `toggleKey` removes
 *    what is there and appends what is not, so the list cannot grow a double;
 *  - the file carries a version. `{ "versione": 1, "tasti": [...] }` is a
 *    promise made to a teacher's laptop, and a file from a future version must
 *    be refused out loud rather than read on a guess;
 *  - a key outside the 88 piano keys is not a mistake worth throwing the whole
 *    file away for: it is reported and left out, and the rest of the lesson
 *    still plays.
 *
 * The storage is a port, not `localStorage`: a phone in private mode throws on
 * the first write, and a list that cannot be saved must not take the page down
 * with it. Every function here says what it does by its return value and never
 * by an exception.
 */
import { isPianoKey } from '../audio/notes';

/** What the page needs from `localStorage`, and nothing more. */
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Where the list is remembered, next to the configuration it belongs to. */
export const LIST_STORAGE_KEY = 'suona-la-nota.lista';

/** The version of the file format. A file that says another one is refused. */
export const LIST_VERSION = 1;

/** What an imported file produced: the keys, or why it was not a list. */
export type ListImport =
  | {
      readonly kind: 'ok';
      /** The keys of the file, in its order, without repeats. */
      readonly keys: number[];
      /** The keys that are not on a piano: reported, and left out. */
      readonly rejected: number[];
    }
  | {
      readonly kind: 'invalid';
      /** One short Italian sentence a teacher can read and act on. */
      readonly message: string;
    };

/** Ticks a key at the end, or unticks it where it is; never twice. */
export function toggleKey(keys: readonly number[], key: number): number[] {
  return keys.includes(key) ? keys.filter((candidate) => candidate !== key) : [...keys, key];
}

/** The empty list, as a value: what "start over" means here. */
export function clearList(): number[] {
  return [];
}

/**
 * The list as the file a teacher keeps: versioned, indented, one array of keys.
 * The keys stay on one line so that a list of twenty reads as a line and not as
 * a page.
 */
export function listToJson(keys: readonly number[]): string {
  const tasti = keys.length === 0 ? '[]' : `[${keys.join(', ')}]`;
  return `{\n  "versione": ${LIST_VERSION},\n  "tasti": ${tasti}\n}\n`;
}

/** A JSON value as an object, or `null` when it is anything else. */
function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * What a file says, or why it is not one of ours. Everything that is not the
 * versioned object is refused with a sentence that names the thing the teacher
 * was trying to open, because "errore di parsing" tells her nothing.
 */
export function listFromJson(text: string): ListImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'invalid', message: 'Il file non è una lista della maestra: non è un JSON.' };
  }

  const file = asObject(parsed);
  if (file === null) {
    return { kind: 'invalid', message: 'Il file non è una lista della maestra: sembra un altro file.' };
  }

  const version = file.versione;
  if (version === undefined) {
    return { kind: 'invalid', message: 'Il file non è una lista della maestra: manca la versione.' };
  }
  if (version !== LIST_VERSION) {
    return {
      kind: 'invalid',
      message: `Questa lista è della versione ${String(version)}, che non conosco: aggiorna l'applicazione.`,
    };
  }

  const raw = file.tasti;
  if (!Array.isArray(raw) || !raw.every((key) => Number.isInteger(key))) {
    return { kind: 'invalid', message: 'Il file non è una lista della maestra: «tasti» deve essere un elenco di numeri interi.' };
  }

  const keys: number[] = [];
  const rejected: number[] = [];
  for (const key of raw as number[]) {
    if (!isPianoKey(key)) rejected.push(key);
    else if (!keys.includes(key)) keys.push(key);
  }
  return { kind: 'ok', keys, rejected };
}

/**
 * The list as it was left, or nothing. A storage that throws — blocked, full,
 * a file the browser refuses to read — is a page that starts empty, not an
 * error on a screen a child is looking at.
 */
export function loadList(storage: StoragePort | null): number[] {
  try {
    const text = storage?.getItem(LIST_STORAGE_KEY) ?? null;
    if (text === null) return [];
    const read = listFromJson(text);
    return read.kind === 'ok' ? read.keys : [];
  } catch {
    return [];
  }
}

/** Remembers the list. A storage that refuses is a list that lives until the reload. */
export function saveList(storage: StoragePort | null, keys: readonly number[]): void {
  try {
    storage?.setItem(LIST_STORAGE_KEY, listToJson(keys));
  } catch {
    // Nothing to do and nothing to say: the lesson still plays.
  }
}

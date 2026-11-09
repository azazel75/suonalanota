/**
 * :Project:  suona-la-nota -- the teacher's list, checked without a browser
 * :Created:  dom 08 nov 2026 23:40:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The list is the one thing a maestra types and then hands to a ragazzə, so it
 * has to survive a reload, a bad file and a phone that refuses to store it. The
 * tests drive the real module and the real settings: the sequence checked here
 * is the sequence the session draws.
 */
import { describe, expect, it } from 'vitest';

import {
  LIST_STORAGE_KEY,
  clearList,
  listFromJson,
  listToJson,
  loadList,
  saveList,
  toggleKey,
  type StoragePort,
} from '../src/exercise/list';
import { DEFAULT_SETTINGS, normalise, problemWith, sequenceFor } from '../src/exercise/settings';
import { BASE_RANGE } from '../src/score/staff';

/** A storage that remembers, in a map, the way `localStorage` does. */
function rememberingStorage(): StoragePort & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  };
}

/** A storage the browser refuses: Safari in private mode, a full quota. */
const refusingStorage: StoragePort = {
  getItem: () => {
    throw new Error('the storage is not available');
  },
  setItem: () => {
    throw new Error('the quota is full');
  },
};

describe("the teacher's list", () => {
  it('ticks a key at the end, in the order the teacher ticked', () => {
    let keys = toggleKey([], 64);
    keys = toggleKey(keys, 60);
    keys = toggleKey(keys, 62);

    expect(keys).toEqual([64, 60, 62]);
  });

  it('unticks a key, keeping the others in their order', () => {
    expect(toggleKey([64, 60, 62], 60)).toEqual([64, 62]);
    expect(toggleKey([64], 64)).toEqual([]);
  });

  it('never lets the same key into the list twice', () => {
    const once = toggleKey([60, 62], 60);
    const twice = toggleKey(once, 60);

    expect(once).toEqual([62]);
    expect(twice).toEqual([62, 60]);
    expect(new Set(twice).size).toBe(twice.length);
  });

  it('empties the list in one go', () => {
    expect(clearList()).toEqual([]);
  });

  it('writes the versioned, indented JSON the ticket asks for', () => {
    expect(listToJson([60, 62, 64])).toBe('{\n  "versione": 1,\n  "tasti": [60, 62, 64]\n}\n');
    expect(listToJson([])).toBe('{\n  "versione": 1,\n  "tasti": []\n}\n');
  });

  it('reads back what it wrote, in the same order', () => {
    const read = listFromJson(listToJson([64, 60, 62]));

    expect(read).toEqual({ kind: 'ok', keys: [64, 60, 62], rejected: [] });
  });

  it('refuses the keys outside the piano and keeps the others in order', () => {
    const read = listFromJson('{"versione": 1, "tasti": [20, 60, 109, 62, 21, 108]}');

    expect(read).toEqual({ kind: 'ok', keys: [60, 62, 21, 108], rejected: [20, 109] });
  });

  it('drops a key repeated inside an imported file', () => {
    const read = listFromJson('{"versione": 1, "tasti": [60, 62, 60]}');

    expect(read).toEqual({ kind: 'ok', keys: [60, 62], rejected: [] });
  });

  it('explains in Italian a file that is not that JSON', () => {
    for (const text of ['', 'ciao', '[60, 62]', '{"tasti": [60]}', '{"versione": 1}']) {
      const read = listFromJson(text);
      expect(read.kind).toBe('invalid');
      if (read.kind === 'invalid') {
        expect(read.message.length).toBeGreaterThan(10);
        expect(read.message).toMatch(/lista/i);
      }
    }
  });

  it('refuses a version it does not know, instead of guessing', () => {
    const read = listFromJson('{"versione": 2, "tasti": [60]}');

    expect(read.kind).toBe('invalid');
    if (read.kind === 'invalid') expect(read.message).toMatch(/versione/i);
  });

  it('survives a reload through the storage under its own key', () => {
    const storage = rememberingStorage();
    const keys = toggleKey(toggleKey([], 62), 60);

    saveList(storage, keys);

    expect(storage.items.has(LIST_STORAGE_KEY)).toBe(true);
    expect(loadList(storage)).toEqual([62, 60]);
  });

  it('starts from an empty list when nothing was ever saved', () => {
    expect(loadList(rememberingStorage())).toEqual([]);
    expect(loadList(null)).toEqual([]);
  });

  it('does not break the page when the storage is blocked or full', () => {
    expect(loadList(refusingStorage)).toEqual([]);
    expect(() => saveList(refusingStorage, [60])).not.toThrow();
    expect(() => saveList(null, [60])).not.toThrow();
  });

  it('ignores what a storage holds when it is not a list', () => {
    const storage = rememberingStorage();
    storage.setItem(LIST_STORAGE_KEY, 'mezza lista');

    expect(loadList(storage)).toEqual([]);
  });

  it('feeds the session in the teacher order, filtered on the active range', () => {
    const settings = normalise({
      ...DEFAULT_SETTINGS,
      mode: 'list',
      list: [64, 60, 40, 72],
    });

    expect(sequenceFor(settings)).toEqual([64, 60, 72]);
    expect(problemWith({ ...settings, list: [] })).toBe('La lista è vuota: nessuna nota da chiedere.');
    // Keys of the list outside the range stay in the list: only the session loses them.
    expect(settings.list).toEqual([64, 60, 40, 72]);
    expect(64).toBeLessThanOrEqual(BASE_RANGE.highest);
  });
});

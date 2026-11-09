/**
 * :Project:  suona-la-nota -- the leaderboard, checked without a browser
 * :Created:  lun 09 nov 2026 00:30:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The leaderboard is the only place where a name is written down, and the name
 * is one a ten-year-old typed on a phone. So the tests drive the real module
 * over a storage that remembers the way the browser's does, and they check the
 * two things a wrong implementation would get wrong quietly: one row per
 * player, and the row that is kept being the best run.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, normalise, type Settings } from '../src/exercise/settings';
import { BASE_RANGE } from '../src/score/staff';
import {
  LEADERBOARD_STORAGE_KEY,
  boardFromJson,
  boardStorageKey,
  boardToJson,
  freeName,
  loadBoard,
  loadLastName,
  recordRun,
  resolveName,
  saveBoard,
  saveLastName,
  standings,
  trialKey,
  type LeaderboardStorage,
  type ScoreEntry,
} from '../src/score/leaderboard';

/** The trial the tests play, with the fields they care about written over. */
function trial(overrides: Partial<Settings> = {}): Settings {
  return normalise({ ...DEFAULT_SETTINGS, ...overrides });
}

/** A run as the summary hands it over: the counts, the rate, the instant. */
function run(name: string, corrette: number, notePerMinute: number, when: number): ScoreEntry {
  return { name, corrette, notePerMinute, when };
}

/** A storage that remembers, in a map, the way `localStorage` does. */
function rememberingStorage(): LeaderboardStorage & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  };
}

/** A storage the browser refuses: Safari in private mode, a full quota. */
const refusingStorage: LeaderboardStorage = {
  getItem: () => {
    throw new Error('the storage is not available');
  },
  setItem: () => {
    throw new Error('the quota is full');
  },
};

/** Four players, one row each, already in the order the leaderboard has to produce. */
const BOARD: readonly ScoreEntry[] = [
  run('bruno', 12, 4, 200),
  run('dino', 10, 7, 300),
  run('carla', 10, 7, 50),
  run('anna', 10, 5, 100),
];

describe('the key of a leaderboard', () => {
  it('is the trial in force: range, clocks, cap and mode', () => {
    const base = trialKey(trial());
    const variants = [
      trial({ range: { lowest: 55, highest: 72 } }),
      trial({ durationMs: 90_000 }),
      trial({ targetTimeoutMs: 5_000 }),
      trial({ wrongLimit: 3 }),
      trial({ mode: 'preset' }),
    ];

    for (const variant of variants) expect(trialKey(variant)).not.toBe(base);
    // Two trials that differ in two fields differ in the key as well.
    expect(trialKey(trial({ durationMs: 90_000, wrongLimit: 3 }))).not.toBe(
      trialKey(trial({ durationMs: 90_000 })),
    );
  });

  it('is the same for trials that differ in what is never played', () => {
    // The preset and the teacher's list are not in the key, by decision: the
    // ticket names five fields, and two lists of notes are not two exercises
    // in the sense a score is compared in.
    expect(trialKey(trial({ presetId: 'due-chiavi' }))).toBe(trialKey(trial()));
    expect(trialKey(trial({ list: [60, 62] }))).toBe(trialKey(trial()));
  });

  it('does not depend on how the values were written', () => {
    const swapped = { lowest: 72, highest: 48 };

    expect(trialKey(trial({ range: swapped }))).toBe(trialKey(trial({ range: BASE_RANGE })));
    expect(trialKey(trial({ durationMs: 60_000.4 }))).toBe(trialKey(trial()));
    // A cap below one is lifted to one by the settings, so it is the same trial.
    expect(trialKey(trial({ wrongLimit: 0.5 }))).toBe(trialKey(trial({ wrongLimit: 1 })));
  });

  it('gives every trial its own place in the storage', () => {
    const board = boardStorageKey(trial({ mode: 'list' }));

    expect(board.startsWith(`${LEADERBOARD_STORAGE_KEY}.`)).toBe(true);
    expect(board).toContain(trialKey(trial({ mode: 'list' })));
    expect(board).not.toBe(boardStorageKey(trial()));
  });
});

describe('one row per player', () => {
  it('keeps the better run when the same name plays twice', () => {
    const board = recordRun([run('marta', 5, 4, 100)], run('marta', 8, 6, 200));

    expect(board).toEqual([run('marta', 8, 6, 200)]);
  });

  it('counts corrette before the rate', () => {
    // The newer run is slower but has more notes read right: it wins.
    const board = recordRun([run('marta', 5, 10, 100)], run('marta', 8, 6, 200));

    expect(board).toEqual([run('marta', 8, 6, 200)]);
  });

  it('counts the rate when corrette are equal', () => {
    const board = recordRun([run('marta', 8, 7.5, 100)], run('marta', 8, 5, 200));

    expect(board).toEqual([run('marta', 8, 7.5, 100)]);
  });

  it('keeps the more recent run when corrette and rate are equal', () => {
    const board = recordRun([run('marta', 8, 7.5, 100)], run('marta', 8, 7.5, 200));

    expect(board).toEqual([run('marta', 8, 7.5, 200)]);
  });

  it('does not count "Marta" and "marta" as two people', () => {
    const board = recordRun([run('Marta', 8, 7.5, 100)], run('  marta ', 9, 5, 200));

    expect(board).toHaveLength(1);
    expect(board[0].corrette).toBe(9);
  });

  it('writes the name of the run that won, not the first one seen', () => {
    const better = recordRun([run('Marta', 5, 7.5, 100)], run('marta', 9, 5, 200));
    const worse = recordRun([run('Marta', 9, 7.5, 100)], run('marta', 5, 5, 200));

    expect(better[0].name).toBe('marta');
    expect(worse[0].name).toBe('Marta');
  });

  it('gives a row to a run that arrives without a name', () => {
    const board = recordRun([run('utente1', 4, 3, 100)], run('', 9, 5, 200));

    expect(board.map((entry) => entry.name)).toEqual(['utente2', 'utente1']);
  });
});

describe('the order of the board', () => {
  it('is corrette, then notes per minute, then the most recent', () => {
    let board: ScoreEntry[] = [];
    for (const entry of BOARD) board = recordRun(board, entry);

    expect(board).toEqual([...BOARD]);
  });
});

describe('the name on the board', () => {
  it('is utente1, utente2, … the first free when the field is empty', () => {
    expect(freeName([])).toBe('utente1');
    expect(freeName([run('utente1', 4, 3, 100)])).toBe('utente2');
    expect(freeName([run('utente1', 4, 3, 100), run('utente2', 5, 3, 100)])).toBe('utente3');
  });

  it('skips the numbers already taken, whatever their spelling', () => {
    expect(freeName([run('Utente1', 4, 3, 100), run('utente3', 4, 3, 100)])).toBe('utente2');
    expect(freeName([run('marta', 4, 3, 100)])).toBe('utente1');
  });

  it('takes what was typed, trimmed and on one line', () => {
    expect(resolveName('  marta   rossi ', [])).toBe('marta rossi');
    expect(resolveName('\n\tmarta\n', [])).toBe('marta');
  });

  it('never lets a name grow past the field', () => {
    expect(resolveName('m'.repeat(40), [])).toHaveLength(20);
    // The cut happens after the trim, so the name does not end in a space.
    expect(resolveName(`${'m'.repeat(19)} `, [])).toBe('m'.repeat(19));
  });

  it('falls back to the first free name when the field is only spaces', () => {
    const board = [run('utente1', 4, 3, 100)];

    expect(resolveName('   ', board)).toBe('utente2');
    expect(resolveName('', board)).toBe('utente2');
  });
});

describe("the player's place", () => {
  it('shows the top of the board, with the player marked inside it', () => {
    const seen = standings(BOARD, 'dino', 3);

    expect(seen.place).toBe(2);
    expect(seen.total).toBe(4);
    expect(seen.rows.map((row) => [row.place, row.name, row.self])).toEqual([
      [1, 'bruno', false],
      [2, 'dino', true],
      [3, 'carla', false],
    ]);
  });

  it('appends the player below the top, with their own place', () => {
    const seen = standings(BOARD, 'anna', 3);

    expect(seen.place).toBe(4);
    expect(seen.rows).toHaveLength(4);
    expect(seen.rows[3]).toEqual({ ...run('anna', 10, 5, 100), place: 4, self: true });
  });

  it('says nothing about a place when no name is in play', () => {
    const seen = standings(BOARD, null, 3);

    expect(seen.place).toBeNull();
    expect(seen.rows).toHaveLength(3);
    expect(seen.rows.some((row) => row.self)).toBe(false);
  });

  it('says nothing about a place for a name that is not on the board', () => {
    const seen = standings(BOARD, 'nuovo', 3);

    expect(seen.place).toBeNull();
    expect(seen.rows).toHaveLength(3);
  });

  it('shows the whole board when it is shorter than the top', () => {
    const seen = standings([run('marta', 3, 4, 100)], 'marta', 5);

    expect(seen.total).toBe(1);
    expect(seen.rows).toHaveLength(1);
    expect(seen.place).toBe(1);
  });
});

describe('the stored board', () => {
  it('is versioned JSON that says which trial it belongs to', () => {
    const settings = trial({ durationMs: 90_000, wrongLimit: 3 });
    const text = boardToJson(settings, [run('marta', 12, 8.5, 1_700_000_000_000)]);
    const file = JSON.parse(text) as Record<string, unknown>;

    expect(file.versione).toBe(1);
    expect(file.prova).toBe(trialKey(settings));
    expect(file.voci).toEqual([
      { nome: 'marta', corrette: 12, note_al_minuto: 8.5, quando_ms: 1_700_000_000_000 },
    ]);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('reads back what it wrote', () => {
    const settings = trial({ mode: 'preset' });

    expect(boardFromJson(boardToJson(settings, BOARD))).toEqual({
      kind: 'ok',
      trial: trialKey(settings),
      entries: [...BOARD],
      dropped: 0,
    });
  });

  it('refuses a version it does not know, instead of guessing', () => {
    const read = boardFromJson('{"versione": 2, "prova": "x", "voci": []}');

    expect(read.kind).toBe('invalid');
    if (read.kind === 'invalid') expect(read.message).toMatch(/versione/i);
  });

  it('refuses what is not a board at all', () => {
    for (const text of ['', 'mezza classifica', '[]', '{"versione": 1}', '{"versione": 1, "voci": 3}']) {
      const read = boardFromJson(text);
      expect(read.kind).toBe('invalid');
      if (read.kind === 'invalid') expect(read.message.length).toBeGreaterThan(10);
    }
  });

  it('drops a row that makes no sense and keeps the others', () => {
    const read = boardFromJson(
      JSON.stringify({
        versione: 1,
        prova: 'x',
        voci: [
          { nome: 'marta', corrette: 3, note_al_minuto: 4.5, quando_ms: 1000 },
          { nome: '', corrette: 2, note_al_minuto: 1, quando_ms: 1000 },
          { nome: 'luca', corrette: 'tre', note_al_minuto: 1, quando_ms: 1000 },
          { nome: 'sara', corrette: -1, note_al_minuto: 1, quando_ms: 1000 },
          { nome: 'gio', corrette: 2, note_al_minuto: 1, quando_ms: 'ieri' },
        ],
      }),
    );

    expect(read.kind).toBe('ok');
    if (read.kind === 'ok') {
      expect(read.entries).toEqual([run('marta', 3, 4.5, 1000)]);
      expect(read.dropped).toBe(4);
    }
  });

  it('survives a reload under the key of its trial', () => {
    const storage = rememberingStorage();
    const settings = trial();

    saveBoard(storage, settings, BOARD);

    expect(storage.items.has(boardStorageKey(settings))).toBe(true);
    expect(loadBoard(storage, settings)).toEqual([...BOARD]);
  });

  it('keeps the boards of two trials apart', () => {
    const storage = rememberingStorage();
    const oneMinute = trial();
    const twoMinutes = trial({ durationMs: 120_000 });

    saveBoard(storage, oneMinute, BOARD);

    expect(loadBoard(storage, twoMinutes)).toEqual([]);
    expect(loadBoard(storage, oneMinute)).toHaveLength(4);
  });

  it('ignores a board that belongs to another trial', () => {
    const storage = rememberingStorage();
    const settings = trial();
    // A document written under the wrong key: only a corrupt storage does this.
    storage.setItem(boardStorageKey(settings), boardToJson(trial({ mode: 'list' }), BOARD));

    expect(loadBoard(storage, settings)).toEqual([]);
  });

  it('starts from an empty board when nothing was ever saved', () => {
    expect(loadBoard(rememberingStorage(), trial())).toEqual([]);
    expect(loadBoard(null, trial())).toEqual([]);
  });

  it('does not break the page when the storage is blocked or full', () => {
    expect(loadBoard(refusingStorage, trial())).toEqual([]);
    expect(() => saveBoard(refusingStorage, trial(), BOARD)).not.toThrow();
    expect(() => saveBoard(null, trial(), BOARD)).not.toThrow();
  });

  it('ignores what a storage holds when it is not a board', () => {
    const storage = rememberingStorage();
    storage.setItem(boardStorageKey(trial()), 'mezza classifica');

    expect(loadBoard(storage, trial())).toEqual([]);
  });

  it('remembers the name of the last run, so the field is already full', () => {
    const storage = rememberingStorage();

    saveLastName(storage, 'marta');

    expect(loadLastName(storage)).toBe('marta');
    expect(loadLastName(rememberingStorage())).toBeNull();
  });

  it('does not break the page when the last name cannot be kept', () => {
    expect(loadLastName(refusingStorage)).toBeNull();
    expect(() => saveLastName(refusingStorage, 'marta')).not.toThrow();
  });
});

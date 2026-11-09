/**
 * :Project:  suona-la-nota -- what the soundcheck leaves behind
 * :Created:  lun 09 nov 2026 01:40:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The portata is a measurement of the phone, not of the lesson: it says which
 * keys this device, in this room, proved it can hear. The trial the teacher
 * chose is intersected with it when a session starts, and the intersection can
 * only be smaller than the trial — a measurement that widened a range would be
 * a measurement of nothing.
 */
import { describe, expect, it } from 'vitest';

import {
  PORTATA_STORAGE_KEY,
  PORTATA_VERSION,
  effectiveRange,
  loadPortata,
  savePortata,
  type Portata,
} from '../src/exercise/portata';
import { ADVANCED_RANGE, BASE_RANGE } from '../src/score/staff';

/** A measurement with only the fields the tests care about spelled out. */
function measured(lowest: number, highest: number, when = '2026-11-09T10:00:00.000Z'): Portata {
  return {
    versione: PORTATA_VERSION,
    quando: when,
    sente: { lowest, highest },
    esclusi: [],
  };
}

/** A storage that lives as long as the test, the way `localStorage` never does. */
function memory(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string): string | null => items.get(key) ?? null,
    setItem: (key: string, value: string): void => void items.set(key, value),
    read: (key: string): string | null => items.get(key) ?? null,
  };
}

describe('the portata a soundcheck measured', () => {
  it('leaves the trial alone when nothing was measured', () => {
    expect(effectiveRange(BASE_RANGE, null)).toEqual(BASE_RANGE);
    expect(effectiveRange(ADVANCED_RANGE, null)).toEqual(ADVANCED_RANGE);
  });

  it('narrows the advanced trial to what the device hears, and leaves the base alone', () => {
    const portata = measured(36, 84);
    expect(effectiveRange(ADVANCED_RANGE, portata)).toEqual({ lowest: 36, highest: 84 });
    expect(effectiveRange(BASE_RANGE, portata)).toEqual(BASE_RANGE);
  });

  it('never widens a trial the measurement reaches past', () => {
    expect(effectiveRange(BASE_RANGE, measured(21, 108))).toEqual(BASE_RANGE);
  });

  it('narrows to the one note the device proved it hears', () => {
    expect(effectiveRange(BASE_RANGE, measured(60, 60))).toEqual({ lowest: 60, highest: 60 });
  });

  it('answers nothing when the measurement leaves no note in the trial', () => {
    expect(effectiveRange({ lowest: 48, highest: 59 }, measured(60, 72))).toBeNull();
  });
  it('moves the bound past a key the detector kept confusing', () => {
    const portata: Portata = { ...measured(48, 72), esclusi: [48] };
    expect(effectiveRange(BASE_RANGE, portata)).toEqual({ lowest: 49, highest: 72 });
    expect(effectiveRange({ lowest: 48, highest: 48 }, portata)).toBeNull();
  });
});

describe('the phone remembers the measurement', () => {
  it('reads back what it wrote', () => {
    const storage = memory();
    const portata = measured(36, 84);
    savePortata(storage, portata);
    expect(loadPortata(storage)).toEqual(portata);
  });

  it('keeps the measurement under a version of its own, in the names of the other files', () => {
    const storage = memory();
    savePortata(storage, measured(36, 84));
    const text = storage.read(PORTATA_STORAGE_KEY);
    expect(text).not.toBeNull();
    const file = JSON.parse(text as string);
    expect(file.versione).toBe(PORTATA_VERSION);
    expect(file.sente).toEqual({ minimo: 36, massimo: 84 });
  });

  it('refuses a measurement written by a version it does not know', () => {
    const newer = JSON.stringify({ ...measured(36, 84), versione: PORTATA_VERSION + 1 });
    expect(loadPortata(memory({ [PORTATA_STORAGE_KEY]: newer }))).toBeNull();
  });

  it('refuses what is not a measurement at all', () => {
    expect(loadPortata(memory({ [PORTATA_STORAGE_KEY]: 'non è json' }))).toBeNull();
    expect(loadPortata(memory({ [PORTATA_STORAGE_KEY]: '{"versione":1}' }))).toBeNull();
  });

  it('starts from nothing when the browser refuses to be read', () => {
    const refuses = {
      getItem: (): string => {
        throw new Error('private mode');
      },
      setItem: (): void => {
        throw new Error('private mode');
      },
    };
    expect(loadPortata(refuses)).toBeNull();
    expect(() => savePortata(refuses, measured(36, 84))).not.toThrow();
  });
});

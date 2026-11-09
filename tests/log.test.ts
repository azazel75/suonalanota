/**
 * :Project:  suona-la-nota -- the session, written down for the teacher
 * :Created:  dom 08 nov 2026 23:30:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * What the log has to say, checked on a real session: the targets the exercise
 * asked, in the order it asked them, each with its verdict and the pressioni the
 * microphone heard; the measurement each pressione arrived with, or `null` where
 * there was none; the trial that was in force; and an honest word about the
 * soundcheck that does not exist yet.
 *
 * The file is read by a teacher, not by a program: the names are Italian and
 * the indent is the one `JSON.stringify` gives, because that is what every
 * editor and every browser show as a tree.
 */
import { describe, expect, it } from 'vitest';

import type { Detection } from '../src/audio/detect';
import { createExercise, type Exercise, type HeardPressione } from '../src/exercise/controller';
import { DEFAULT_SETTINGS, normalise, type Settings } from '../src/exercise/settings';
import type { Placement } from '../src/score/staff';
import type { SessionConfig } from '../src/session/engine';
import { logFileName, logJson, sessionLog, type PressioneLog } from '../src/session/log';

/** A page that only writes down what it was asked to do. */
const ports = {
  draw: (_placement: Placement) => undefined,
  flash: (_verdict: string) => undefined,
  beep: () => undefined,
  message: (_text: string | null) => undefined,
  status: () => undefined,
  end: (_reason: string) => undefined,
};

/** A session driven by hand, the way the page drives it. */
function session(keys: number[], config: SessionConfig = {}): Exercise {
  return createExercise({ keys, config, ports });
}

/** A pressione of the listener, with whatever the detector measured on it. */
function pressione(midi: number, extra: Partial<HeardPressione> = {}): HeardPressione {
  return { midi, ambiguous: false, ...extra };
}

/** A frame of the microphone, with no pressione in it. */
function quiet(at: number, levelDb = -20) {
  return { at, levelDb, pressioni: [] as HeardPressione[] };
}

/** Everything the detector saw, as the listener hands it over. */
function detection(marginDb: number, octaveMarginDb: number, measuredHz: number): Detection {
  return {
    best: { midi: 60, hz: 261.6, score: 0.02 },
    second: { midi: 62, hz: 293.7, score: 0.01 },
    candidates: [],
    marginDb,
    octaveMarginDb,
    measuredHz,
    fundamentalPresent: true,
    fundamentalMagnitude: 0.02,
    octaveBelowMagnitude: 0.001,
    credibility: 9.2,
    octaveEvidenceRatio: 0.47,
    ambiguous: false,
    octaveFlipped: false,
  };
}

/** The trial, written down the way the page writes it when the session is over. */
function written(
  exercise: Exercise,
  settings: Settings = DEFAULT_SETTINGS,
  when = new Date(2026, 10, 8, 22, 30, 11),
) {
  const log = sessionLog({ when, settings, state: exercise.state(), targets: exercise.log() });
  // The log is JSON with Italian names; the test reads it as a teacher would.
  const parsed = JSON.parse(logJson(log)) as Record<string, any>;
  return { log, parsed };
}

describe('the log of a session', () => {
  it('is JSON a teacher can open: indented, one field per line', () => {
    const exercise = session([60]);
    exercise.feed({ at: 40, levelDb: -20, pressioni: [pressione(60)] });

    const { log } = written(exercise);
    const text = logJson(log);

    expect(() => JSON.parse(text)).not.toThrow();
    expect(text.startsWith('{\n  "versione": 1,\n')).toBe(true);
    expect(text.endsWith('}\n')).toBe(true);
    // Indented means a line per field, not a wall of text on one line.
    expect(text.split('\n').length).toBeGreaterThan(24);
  });

  it('names its fields in Italian, and in a fixed order, so nothing has to be guessed', () => {
    const exercise = session([60]);
    exercise.feed({ at: 40, levelDb: -20, pressioni: [pressione(60)] });

    const { parsed } = written(exercise);

    expect(Object.keys(parsed)).toEqual([
      'versione',
      'quando',
      'impostazioni',
      'soundcheck',
      'fine',
      'punteggio',
      'note',
    ]);
    expect(Object.keys(parsed.impostazioni)).toEqual([
      'intervallo',
      'durata_secondi',
      'tempo_per_nota_secondi',
      'tentativi_massimi',
      'modalita',
      'lista_predefinita',
    ]);
    expect(Object.keys(parsed.note[0])).toEqual([
      'tasto',
      'nome',
      'verdetto',
      'millisecondi',
      'inizio_ms',
      'fine_ms',
      'pressioni',
    ]);
    expect(parsed.quando).toBe(new Date(2026, 10, 8, 22, 30, 11).toISOString());
  });

  it('reports the trial that was in force, not the defaults', () => {
    const settings = normalise({
      ...DEFAULT_SETTINGS,
      range: { lowest: 35, highest: 86 },
      durationMs: 90_000,
      targetTimeoutMs: 6_000,
      wrongLimit: 3,
      mode: 'preset',
      presetId: 'due-chiavi',
    });
    const exercise = session([60], {
      durationMs: settings.durationMs,
      targetTimeoutMs: settings.targetTimeoutMs,
      wrongLimit: settings.wrongLimit ?? undefined,
    });
    exercise.feed({ at: 40, levelDb: -20, pressioni: [pressione(60)] });

    const { parsed } = written(exercise, settings);

    expect(parsed.impostazioni).toEqual({
      intervallo: { minimo: 35, massimo: 86 },
      durata_secondi: 90,
      tempo_per_nota_secondi: 6,
      tentativi_massimi: 3,
      modalita: 'lista predefinita',
      lista_predefinita: 'Le due chiavi',
    });
  });

  it("says casuale and the teacher's list the way she chose them, with no predefined list left over", () => {
    const exercise = session([60]);
    exercise.feed({ at: 40, levelDb: -20, pressioni: [pressione(60)] });

    const casual = written(exercise).parsed.impostazioni;
    expect(casual.modalita).toBe('casuale');
    expect(casual.lista_predefinita).toBeNull();
    expect(casual.tentativi_massimi).toBeNull();

    const listed = written(exercise, { ...DEFAULT_SETTINGS, mode: 'list' }).parsed.impostazioni;
    expect(listed.modalita).toBe("lista dell'insegnante");
    expect(listed.lista_predefinita).toBeNull();
  });

  it('says the soundcheck has not measured the range, instead of pretending it did', () => {
    const exercise = session([60]);
    exercise.feed({ at: 40, levelDb: -20, pressioni: [pressione(60)] });

    const { parsed } = written(exercise);

    expect(parsed.soundcheck.intervallo_misurato).toBe(false);
    expect(parsed.soundcheck.intervallo_effettivo).toBeNull();
    expect(parsed.soundcheck.nota).toMatch(/soundcheck/i);
    expect(parsed.soundcheck.nota).toMatch(/non è stato fatto/i);
    expect(parsed.soundcheck.nota).not.toMatch(/non esiste ancora/i);
    // What is logged is the range the trial asked for, not a measured one.
    expect(parsed.impostazioni.intervallo).toEqual({ minimo: 48, massimo: 72 });
  });

  it('has a place for the range a soundcheck measured, and fills it when there is one', () => {
    const exercise = session([60]);
    exercise.feed({ at: 40, levelDb: -20, pressioni: [pressione(60)] });

    const measured = sessionLog({
      when: new Date(2026, 10, 8, 22, 30, 11),
      settings: DEFAULT_SETTINGS,
      state: exercise.state(),
      targets: exercise.log(),
      rangeMeasured: true,
      rangeEffective: { lowest: 50, highest: 70 },
    });

    expect(measured.soundcheck.intervallo_misurato).toBe(true);
    expect(measured.soundcheck.intervallo_effettivo).toEqual({ minimo: 50, massimo: 70 });
    expect(measured.soundcheck.nota).not.toMatch(/non è ancora stato fatto/i);
  });

  it('logs the targets the session asked, in order, with their verdict and their pressioni', () => {
    const exercise = session([60, 62, 64]);
    exercise.feed(quiet(40));
    exercise.feed({ at: 1_040, levelDb: -20, pressioni: [pressione(60)] });
    exercise.feed({ at: 1_080, levelDb: -20, pressioni: [pressione(61)] });
    exercise.feed(quiet(9_080));
    exercise.feed(quiet(17_080));

    const { parsed } = written(exercise);

    expect(parsed.note.map((target: any) => [target.tasto, target.nome, target.verdetto]))
      .toEqual([
        [60, 'Do4', 'corretta'],
        [62, 'Re4', 'sbagliata'],
        [64, 'Mi4', 'saltata'],
      ]);
    expect(parsed.note.map((target: any) => target.pressioni.length)).toEqual([1, 1, 0]);
    expect(parsed.note[0].millisecondi).toBe(1_000);
    // The file says when each nota appeared and when it left the staff, on
    // the page's clock: the instant is evidence, not a duration to be inferred.
    for (const target of parsed.note) {
      expect(typeof target.inizio_ms).toBe('number');
      expect(target.fine_ms).toBeGreaterThanOrEqual(target.inizio_ms);
    }
    expect(parsed.note[1].pressioni[0].altezza).toBe(61);
    expect(parsed.note[0].pressioni[0].altezza).toBe(60);
    expect(parsed.punteggio).toEqual({
      corrette: 1,
      sbagliate: 1,
      saltate: 1,
      totale: 3,
      note_al_minuto: 10.6,
    });
    expect(parsed.fine.motivo).toBe('note');
  });

  it('marks an ambiguous pressione and does not count it as a wrong one', () => {
    const exercise = session([60]);
    exercise.feed(quiet(40));
    exercise.feed({ at: 1_040, levelDb: -20, pressioni: [pressione(60, { ambiguous: true })] });
    exercise.feed(quiet(9_040));

    const { parsed } = written(exercise);

    expect(parsed.note[0].verdetto).toBe('saltata');
    expect(parsed.note[0].pressioni).toEqual([
      expect.objectContaining({ altezza: 60, ambiguo: true }),
    ]);
    expect(parsed.punteggio).toEqual({
      corrette: 0,
      sbagliate: 0,
      saltate: 1,
      totale: 1,
      // The session ended when the last nota did: eight seconds, not nine.
      note_al_minuto: 7.5,
    });
  });

  it('writes the measurement a pressione arrived with, and null where there was none', () => {
    const exercise = session([60]);
    exercise.feed(quiet(40));
    exercise.feed({
      at: 1_040,
      levelDb: -20,
      pressioni: [
        pressione(61, {
          at: 1_000,
          credibility: 9.2,
          levelDb: -18.4,
          stability: 5,
          detection: detection(12.4, 7.8, 293.2),
        }),
      ],
    });
    exercise.feed({ at: 1_080, levelDb: -20, pressioni: [pressione(63)] });
    exercise.feed({ at: 1_120, levelDb: -20, pressioni: [pressione(60)] });

    const { parsed } = written(exercise);
    const heard: PressioneLog[] = parsed.note[0].pressioni;

    expect(heard[0]).toEqual({
      altezza: 61,
      frequenza_hz: 293.2,
      ambiguo: false,
      credibilita: 9.2,
      livello_db: -18.4,
      margine_db: 12.4,
      margine_ottava_db: 7.8,
      stabilita: 5,
      // The attack, not the frame it was read on: the page forwards both.
      istante_ms: 1_000,
    });
    // A pressione with no measurement behind it says so, rather than inventing one.
    expect(heard[1]).toEqual({
      altezza: 63,
      frequenza_hz: null,
      ambiguo: false,
      credibilita: null,
      livello_db: null,
      margine_db: null,
      margine_ottava_db: null,
      stabilita: null,
      istante_ms: 1_080,
    });
  });

  it('leaves out the target that was still on screen when the time ran out', () => {
    const exercise = session([60, 62], { durationMs: 1_000 });
    exercise.feed(quiet(40));
    exercise.feed(quiet(1_040));

    const { parsed } = written(exercise);

    expect(parsed.note).toEqual([]);
    expect(parsed.fine).toEqual({ motivo: 'tempo', secondi: 1 });
  });

  it('names the file after the session, the way a phone saves it', () => {
    expect(logFileName(new Date(2026, 10, 8, 22, 30, 11))).toBe(
      'suona-la-nota-log-2026-11-08-223011.json',
    );
  });
});

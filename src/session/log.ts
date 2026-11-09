/**
 * :Project:  suona-la-nota -- the session written down for the teacher
 * :Created:  dom 08 nov 2026 23:34:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The file the summary hands over at the end of a session. It exists to answer
 * one question that the three counts cannot: when a note comes out wrong, is it
 * the allievə who missed it or the application that misheard it? So every
 * bersaglio carries the colpi the microphone actually produced, with the
 * measurement each one arrived with, and the trial that was in force is written
 * beside them — a log of ten notes on the advanced range means nothing without
 * the range, the clocks and the cap that produced it.
 *
 * Three decisions:
 *
 *  - **the names are Italian**, because the file is opened by a teacher and not
 *    by a program: `tasto`, `verdetto`, `colpi`; a field name in English would
 *    send her looking for a dictionary. The code around them stays English, as
 *    everywhere else in this repository;
 *  - **a value that was not measured is `null`, never a plausible number**: when
 *    the soundcheck has not been run, `range_misurato` is false and says so in
 *    the file rather than letting a nominal range pass for a measured one;
 *  - **the shape does not depend on the session**: every field is always there,
 *    in the same order, so two files can be read side by side and the indent of
 *    `JSON.stringify` is enough to read one on a phone.
 *
 * No DOM: the page builds the Blob, this module decides what is in it.
 */
import { midiToItalian } from '../audio/notes';
import type { Detection } from '../audio/detect';
import { PRESETS, type SequenceMode, type Settings } from '../exercise/settings';
import { type KeyRange } from '../score/staff';
import type { EndReason, SessionState, Verdict } from './engine';

/** Version of this shape: bump it when a field changes meaning, not when one is added. */
export const LOG_VERSION = 1;

/**
 * What the log needs from a colpo, and nothing more.
 *
 * The listener's `Colpo` already carries all of it — the detection travels along
 * precisely so that a log can be written — and the exercise forwards it
 * untouched. Every field but the two the screen judges on is optional, because a
 * frame driven by hand in a test has no detector behind it, and the log must say
 * `null` rather than invent a margin.
 */
export interface ColpoMeasurement {
  /** The key the detector named, as a MIDI number. */
  readonly midi: number;
  /** Winner and octave too close to call: not judged, the app asked to repeat. */
  readonly ambiguous: boolean;
  /** When the attack was heard, on the page's clock; the frame's instant when absent. */
  readonly at?: number;
  /** How far the winner stands out from the median candidate. */
  readonly credibility?: number;
  /** Level of the frame the colpo was read on, in dBFS. */
  readonly levelDb?: number;
  /** How many frames the winner had already been the same key at read time. */
  readonly stability?: number;
  /** Everything the detector saw in the frame the pitch was read from. */
  readonly detection?: Detection;
}

/**
 * One colpo as the file writes it: the key it was heard as, the frequency the
 * microphone actually measured, and how sure the detector was. Both margins are
 * kept — against the runner-up and against the octave — because the second one
 * is what tells a teacher that the device, and not the allievə, was unsure.
 */
export interface ColpoLog {
  /** The key the colpo was heard as, MIDI. */
  readonly altezza: number;
  /** The frequency measured near that key's fundamental, in Hz; `null` when not measured. */
  readonly frequenza_hz: number | null;
  /** True when the octave was too close to call: the colpo was not judged. */
  readonly ambiguo: boolean;
  /** Winner against the median candidate; `null` when not measured. */
  readonly credibilita: number | null;
  /** Level of the frame, in dBFS; `null` when not measured. */
  readonly livello_db: number | null;
  /** Winner against the runner-up, in dB; `null` when not measured. */
  readonly margine_db: number | null;
  /** Winner against the strongest of its octaves, in dB; `null` when not measured. */
  readonly margine_ottava_db: number | null;
  /** Frames the winner had already been the same key, at read time; `null` when not measured. */
  readonly stabilita: number | null;
  /** When the attack was heard, in milliseconds on the page's clock. */
  readonly istante_ms: number;
}

/**
 * One bersaglio as the exercise kept it: the key it asked for, how it closed and
 * every colpo heard while it was on screen. The target still on screen when the
 * session ends is not one of these — a bersaglio nobody got to try is not a
 * statistic (ADR 0003) — so its colpi are not in the file either.
 */
export interface TargetLog {
  /** MIDI number of the bersaglio. */
  readonly key: number;
  readonly verdict: Verdict;
  /** How long it stayed on screen, in milliseconds. */
  readonly elapsedMs: number;
  /** When it appeared on screen, on the page's clock, in milliseconds. */
  readonly openedAt: number;
  /** When it left the screen, on the page's clock, in milliseconds. */
  readonly closedAt: number;
  readonly colpi: readonly ColpoLog[];
}

/** Everything the page knows when the session is over. */
export interface SessionLogInput {
  /** When the session ended: the page's clock, the one that also timed it. */
  readonly when: Date;
  /** The trial that was in force, not the defaults. */
  readonly settings: Settings;
  /** The finished session: counts, elapsed time and why it ended. */
  readonly state: SessionState;
  /** What the exercise heard, one entry per bersaglio, in the order it asked. */
  readonly targets: readonly TargetLog[];
  /**
   * Whether the range was measured by a soundcheck. False when the step was
   * skipped or never asked, and a file that stayed silent about it would pass
   * the nominal range for the portata udibile.
   */
  readonly rangeMeasured?: boolean;
  /**
   * The range the soundcheck actually measured, when it measured one. `null`
   * when it did not: the file must not let a nominal range pass for the
   * intersection the device proved (`docs/adr/0012`).
   */
  readonly rangeEffective?: KeyRange;
}

/** The settings block, as the file writes it. */
export interface SettingsLog {
  readonly intervallo: { readonly minimo: number; readonly massimo: number };
  readonly durata_secondi: number;
  readonly tempo_per_bersaglio_secondi: number;
  readonly tetto_colpi: number | null;
  readonly modalita: string;
  /** The preset in force, by the name the settings screen showed; `null` when not used. */
  readonly preset: string | null;
}

/** The log, as a value: `logJson` turns it into the file. */
export interface SessionLog {
  readonly versione: number;
  readonly quando: string;
  readonly impostazioni: SettingsLog;
  readonly soundcheck: {
    readonly intervallo_misurato: boolean;
    /** The range the soundcheck narrowed the trial to; `null` when it did not run. */
    readonly intervallo_effettivo: { readonly minimo: number; readonly massimo: number } | null;
    readonly nota: string;
  };
  readonly fine: { readonly motivo: string | null; readonly secondi: number };
  readonly punteggio: {
    readonly corrette: number;
    readonly sbagliate: number;
    readonly saltate: number;
    readonly totale: number;
    readonly note_al_minuto: number;
  };
  readonly bersagli: readonly {
    readonly tasto: number;
    readonly nome: string;
    readonly verdetto: string;
    readonly millisecondi: number;
    /** When the bersaglio appeared and when it left the staff, on the page's clock. */
    readonly inizio_ms: number;
    readonly fine_ms: number;
    readonly colpi: readonly ColpoLog[];
  }[];
}

/** The three verdicts as the glossary names them, not as the engine spells them. */
const VERDICT_NAMES: Readonly<Record<Verdict, string>> = {
  centered: 'corretta',
  wrong: 'sbagliata',
  skipped: 'saltata',
};

/** The three ways a session picks its bersagli, in the words of the settings screen. */
const MODE_NAMES: Readonly<Record<SequenceMode, string>> = {
  random: 'casuale',
  preset: 'preset',
  list: 'lista',
};

/** Why the session ended, as the summary says it. */
const END_NAMES: Readonly<Record<EndReason, string>> = {
  duration: 'tempo',
  targets: 'lista',
};

const NOT_MEASURED =
  "Il soundcheck non è stato fatto: la portata udibile non è misurata, e l'intervallo scritto " +
  'qui è quello nominale della prova.';

const MEASURED =
  "Il soundcheck ha misurato la portata udibile: l'intervallo effettivo è quello scritto qui, ed è " +
  "l'intersezione fra l'intervallo nominale, l'estensione dello strumento e ciò che il microfono sente.";

/**
 * One colpo, measured or not. `at` is the frame's instant, used only when the
 * colpo did not come with one of its own: the listener knows when the attack was
 * heard, and that is the instant worth writing down.
 */
export function colpoLog(heard: ColpoMeasurement, at: number): ColpoLog {
  const detection = heard.detection;
  return {
    altezza: heard.midi,
    frequenza_hz: detection?.measuredHz ?? null,
    ambiguo: heard.ambiguous,
    credibilita: heard.credibility ?? null,
    livello_db: heard.levelDb ?? null,
    margine_db: detection?.marginDb ?? null,
    margine_ottava_db: detection?.octaveMarginDb ?? null,
    stabilita: heard.stability ?? null,
    istante_ms: heard.at ?? at,
  };
}

/** Seconds with one decimal: the clock a teacher reads, not the millisecond it timed. */
function seconds(ms: number): number {
  return Math.round(ms / 100) / 10;
}

/**
 * The session as a value. `state` carries the counts and the reason it ended;
 * `targets` carries what the exercise heard, in the order it was asked.
 */
export function sessionLog(input: SessionLogInput): SessionLog {
  const { settings, state } = input;
  const preset = PRESETS.find((candidate) => candidate.id === settings.presetId);

  return {
    versione: LOG_VERSION,
    quando: input.when.toISOString(),
    impostazioni: {
      intervallo: { minimo: settings.range.lowest, massimo: settings.range.highest },
      durata_secondi: settings.durationMs / 1000,
      tempo_per_bersaglio_secondi: settings.targetTimeoutMs / 1000,
      tetto_colpi: settings.wrongLimit,
      modalita: MODE_NAMES[settings.mode],
      // A preset nobody played says nothing about the session.
      preset: settings.mode === 'preset' && preset !== undefined ? preset.name : null,
    },
    soundcheck: {
      intervallo_misurato: input.rangeMeasured ?? false,
      intervallo_effettivo: input.rangeEffective === undefined
        ? null
        : { minimo: input.rangeEffective.lowest, massimo: input.rangeEffective.highest },
      nota: (input.rangeMeasured ?? false) ? MEASURED : NOT_MEASURED,
    },
    fine: {
      motivo: state.endReason === null ? null : END_NAMES[state.endReason],
      secondi: seconds(state.elapsedMs),
    },
    punteggio: {
      corrette: state.score.centered,
      sbagliate: state.score.wrong,
      saltate: state.score.skipped,
      totale: state.score.total,
      note_al_minuto: state.score.notesPerMinute,
    },
    bersagli: input.targets.map((target) => ({
      tasto: target.key,
      nome: midiToItalian(target.key),
      verdetto: VERDICT_NAMES[target.verdict],
      millisecondi: Math.round(target.elapsedMs),
      inizio_ms: Math.round(target.openedAt),
      fine_ms: Math.round(target.closedAt),
      colpi: target.colpi,
    })),
  };
}

/**
 * The file itself: JSON indented by two spaces, with a newline at the end, which
 * is what every editor and every browser shows as a tree. No key is dropped and
 * no number is rounded — the file is the evidence, and reading it must not
 * require a tool.
 */
export function logJson(log: SessionLog): string {
  return `${JSON.stringify(log, null, 2)}\n`;
}

/**
 * The name the download lands with: the session and when it was played, so that
 * two logs on the same phone do not overwrite each other. Local time, because
 * the teacher knows when the lesson was, not what UTC says.
 */
export function logFileName(when: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const day = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
  const clock = `${pad(when.getHours())}${pad(when.getMinutes())}${pad(when.getSeconds())}`;
  return `suona-la-nota-log-${day}-${clock}.json`;
}

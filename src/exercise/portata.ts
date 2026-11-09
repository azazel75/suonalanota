/**
 * :Project:  suona-la-nota -- the portata the soundcheck measured
 * :Created:  lun 09 nov 2026 01:45:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * What a soundcheck leaves on the phone: the interval of keys the device proved
 * it can hear, and the keys it kept confusing. It is a measurement of the phone
 * and the room, not of the trial, so one measurement serves the base range and
 * the advanced one alike — and the intersection with the trial is computed when
 * a session starts.
 *
 * Four decisions:
 *
 *  - **a trial can only get smaller**: `effectiveRange` intersects and never
 *    widens, because a measurement that widened a range would prove nothing;
 *  - **an empty intersection is `null`, not an empty range**: a range whose
 *    lowest is above its highest would travel through the page as if it were a
 *    range, and no key would ever be asked;
 *  - **the instrument's extent is not a field**: the two ends are what the first
 *    two probes heard, so they are already inside `sente`. Storing an extent
 *    apart would mean writing 21 and 108 — the piano assumed, not the instrument
 *    measured — into a value stamped with a date;
 *  - **the measurement lives on the phone** (`localStorage`, `versione: 1`), as
 *    the teacher's list does, and a value written by a version this build does
 *    not know is refused out loud rather than read on a guess. A storage that
 *    refuses is not a broken page: loading answers `null` and saving does
 *    nothing (docs/adr/0011).
 */
import type { KeyRange } from '../score/staff';
import type { WebStorage } from '../ui/dom';

/** Where the measurement is remembered, beside the list and the classifica. */
export const PORTATA_STORAGE_KEY = 'suona-la-nota.portata';

/** The version of the stored shape: bump it when a field changes meaning. */
export const PORTATA_VERSION = 1;

/** What the soundcheck measured, as the phone remembers it. */
export interface Portata {
  readonly versione: number;
  /** When the measurement was made, ISO instant. */
  readonly quando: string;
  /** Between the outermost probes the device proved it hears. */
  readonly sente: KeyRange;
  /** Keys the detector kept confusing: three ambiguous colpi in a row (ADR 0008). */
  readonly esclusi: readonly number[];
}

/**
 * The trial as the device can actually play it: the intersection, or `null`
 * when the measurement leaves no key inside the trial.
 */
export function effectiveRange(nominal: KeyRange, portata: Portata | null): KeyRange | null {
  if (portata === null) return nominal;
  let lowest = Math.max(nominal.lowest, portata.sente.lowest);
  let highest = Math.min(nominal.highest, portata.sente.highest);
  // A key the detector kept confusing is a key the exercise may not ask for,
  // even when the interval still reaches it: the bound moves inward.
  while (lowest <= highest && portata.esclusi.includes(lowest)) lowest += 1;
  while (lowest <= highest && portata.esclusi.includes(highest)) highest -= 1;
  return lowest <= highest ? { lowest, highest } : null;
}

/** A JSON value as an object, or `null` when it is anything else. */
function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** A key interval as the file writes it, or `null` when it is not one. */
function asRange(value: unknown): KeyRange | null {
  const range = asObject(value);
  if (range === null) return null;
  const lowest = range.minimo;
  const highest = range.massimo;
  if (!Number.isInteger(lowest) || !Number.isInteger(highest)) return null;
  if ((lowest as number) > (highest as number)) return null;
  return { lowest: lowest as number, highest: highest as number };
}

/** A key interval as the stored file writes it: the names of the two JSON files. */
function rangeToFile(range: KeyRange): { minimo: number; massimo: number } {
  return { minimo: range.lowest, massimo: range.highest };
}

/**
 * The measurement as it was stored, or `null`: absent, unreadable, written by
 * another version, or shaped like something else. A page that starts without a
 * portata is a page that falls back to the nominal range, which is honest.
 */
export function loadPortata(storage: WebStorage | null): Portata | null {
  try {
    const text = storage?.getItem(PORTATA_STORAGE_KEY) ?? null;
    if (text === null) return null;
    const parsed: unknown = JSON.parse(text);
    const file = asObject(parsed);
    if (file === null || file.versione !== PORTATA_VERSION) return null;

    const quando = file.quando;
    const sente = asRange(file.sente);
    const rawExcluded = file.esclusi;
    if (typeof quando !== 'string' || Number.isNaN(Date.parse(quando))) return null;
    if (sente === null) return null;
    if (!Array.isArray(rawExcluded) || !rawExcluded.every((key) => Number.isInteger(key))) {
      return null;
    }
    return {
      versione: PORTATA_VERSION,
      quando,
      sente,
      esclusi: rawExcluded as number[],
    };
  } catch {
    return null;
  }
}

/** Remembers the measurement. A storage that refuses leaves it living until the reload. */
export function savePortata(storage: WebStorage | null, portata: Portata): void {
  const file = {
    versione: portata.versione,
    quando: portata.quando,
    sente: rangeToFile(portata.sente),
    esclusi: portata.esclusi,
  };
  try {
    storage?.setItem(PORTATA_STORAGE_KEY, `${JSON.stringify(file, null, 2)}\n`);
  } catch {
    // Nothing to do and nothing to say: the trial still plays, measured or not.
  }
}

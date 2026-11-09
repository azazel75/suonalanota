/**
 * :Project:  suona-la-nota -- the sentences a measurement leaves on the screen
 * :Created:  lun 09 nov 2026 02:05:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The two lines the portata speaks: what the configuration reads under
 * «Ascolto», and why a trial cannot start against a measurement. They live
 * beside the screens, as the line under the keyboard does (`setup-text.ts`),
 * because they are words for a person and not rules about a phone.
 */
import { midiToItalian } from '../audio/notes';
import { effectiveRange, type Portata } from '../exercise/portata';
import { problemWith, type Settings } from '../exercise/settings';

/**
 * Why this trial cannot start with this measurement, or `null` when it can.
 *
 * The check is on the trial **as the phone can play it**: a range with no note
 * left, and a list or a preset whose keys all fell outside the measured
 * interval, are the same defect seen from two sides — a session that would open
 * the microphone on nothing and be over before the first target.
 */
export function trialProblem(settings: Settings, portata: Portata | null): string | null {
  const effective = effectiveRange(settings.range, portata);
  if (effective === null) {
    return "La portata misurata non lascia note in questo range: rifai l'ascolto, o allarga il range.";
  }
  return problemWith({ ...settings, range: effective });
}

/** The line the configuration reads, under «Ascolto». */
export function describePortata(portata: Portata | null): string {
  if (portata === null) return 'Portata del telefono: non misurata.';
  const day = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' }).format(
    new Date(portata.quando),
  );
  const from = midiToItalian(portata.sente.lowest);
  const to = midiToItalian(portata.sente.highest);
  return `Portata del telefono: ${from}–${to}, misurata il ${day}.`;
}

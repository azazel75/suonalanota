/**
 * :Project:  suona-la-nota -- the sentences a measurement leaves on the screen
 * :Created:  lun 09 nov 2026 02:08:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * Two lines, tested because they are what a teacher and an allievə actually
 * read: the state of the microphone under «Sensibilità del dispositivo», and the reason a trial
 * cannot start when the phone hears nothing inside it.
 */
import { describe, expect, it } from 'vitest';

import { PORTATA_VERSION, type Portata } from '../src/exercise/portata';
import { DEFAULT_SETTINGS, type Settings } from '../src/exercise/settings';
import { describePortata, trialProblem } from '../src/screens/portata-text';

function measured(lowest: number, highest: number, when = '2026-11-09T10:00:00.000Z'): Portata {
  return {
    versione: PORTATA_VERSION,
    quando: when,
    sente: { lowest, highest },
    esclusi: [],
  };
}

describe('the line the configuration reads', () => {
  it('says when nothing was measured', () => {
    expect(describePortata(null)).toBe('Portata del telefono: non misurata.');
  });

  it('names the interval and the day, in the words of the page', () => {
    expect(describePortata(measured(36, 84))).toBe(
      'Portata del telefono: Do2–Do6, misurata il 9 novembre.',
    );
  });
});

describe('why a trial cannot start', () => {
  it('says nothing when the measurement leaves notes in the trial', () => {
    expect(trialProblem(DEFAULT_SETTINGS, null)).toBeNull();
    expect(trialProblem(DEFAULT_SETTINGS, measured(48, 72))).toBeNull();
  });

  it('says so when it leaves none', () => {
    expect(trialProblem(DEFAULT_SETTINGS, measured(73, 84))).toBe(
      "La portata misurata non lascia note in questo intervallo: rifai la misura, o allarga l'intervallo.",
    );
  });

  it("says when the measurement empties the teacher's list", () => {
    const listed: Settings = { ...DEFAULT_SETTINGS, mode: 'list', list: [60, 62] };
    expect(trialProblem(listed, measured(72, 84))).toBe(
      "Nessun tasto della lista è nell'intervallo scelto.",
    );
  });
});

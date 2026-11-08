/**
 * :Project:  suona-la-nota -- the app shell, and a proof that VexFlow draws
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * Fase 0: there is no exercise here yet. The two staves exist to prove that the
 * notation library and its fonts survive the bundler, which is the only part of
 * the rendering stack worth verifying before the spike says the app is viable.
 *
 * A whole note, not a half one: a VexFlow voice refuses to be drawn unless its
 * ticks fill the measure, and the exercise will show one note per measure
 * anyway.
 */
/*
 * Import from `vexflow/bravura`, not from `vexflow`: the full entry loads six
 * font families (Gonville, Petaluma...) that this page never uses, and in a PWA
 * aimed at a phone 600 kB of extra gzip is not a detail.
 */
import { Factory } from 'vexflow/bravura';

async function drawStaves(): Promise<void> {
  const host = document.getElementById('staff');
  if (host === null) return;

  try {
    await document.fonts.ready;

    const factory = new Factory({
      renderer: { elementId: 'staff', width: 560, height: 240 },
    });
    const score = factory.EasyScore();
    const system = factory.System({ x: 10, y: 10, width: 540 });

    system.addStave({ voices: [score.voice(score.notes('C4/w'))] }).addClef('treble');
    system.addStave({ voices: [score.voice(score.notes('C3/w'))] }).addClef('bass');

    factory.draw();
  } catch (error) {
    // The page is the smoke test: a silent empty staff would be the worst
    // possible outcome, so the failure is printed where the staff should be.
    host.textContent = `VexFlow non ha disegnato: ${String(error)}`;
    host.className = 'bad';
  }
}

void drawStaves();

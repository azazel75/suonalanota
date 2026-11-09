/**
 * :Project:  suona-la-nota -- the page as composition
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The page, as composition and nothing else: it reads the URL, builds the
 * screens, shows the first one. Every rule lives in the module that owns it —
 * `screens/setup` the trial and the teacher's list, `screens/exercise` the
 * session in progress, `screens/summary` what a session leaves behind.
 *
 * The page is a wizard: one screen at a time, the configuration first, then the
 * staff, then the summary, and no way past the first without pressing
 * "Comincia". A URL can dictate the trial (`?duration=30&range=advanced`, see
 * docs/adr/0011): then the configuration screen is skipped, because the link
 * already answered the question it would ask.
 */
import { settingsFromQuery } from './exercise/settings';
import { registerServiceWorker } from './pwa/register';
import { createExerciseScreen } from './screens/exercise';
import { createSetupScreen, type SetupScreen } from './screens/setup';
import { createSummaryScreen } from './screens/summary';
import { createWizard } from './screens/wizard';
import { element } from './ui/dom';

async function main(): Promise<void> {
  await document.fonts.ready;

  const wizard = createWizard({
    setup: element<HTMLElement>('setup'),
    exercise: element<HTMLElement>('exercise'),
    summary: element<HTMLElement>('summary'),
  });

  // The one cycle of the page, and the only place where it is allowed to
  // exist: the exercise screen reads the trial the setup controls describe, and
  // the setup screen asks whether a session is in the way. Both are closures,
  // resolved on the first click, so the order of construction does not matter.
  let setup!: SetupScreen;
  const summary = createSummaryScreen({ wizard, restart: () => exercise.backToSetup() });
  const exercise = createExerciseScreen({
    wizard,
    settings: () => setup.settings(),
    refreshSetup: () => setup.refresh(),
    summary,
  });
  setup = createSetupScreen({
    busy: exercise.busy,
    changed: exercise.trialChanged,
    begin: exercise.enter,
  });

  // The URL may have already chosen the trial. What it leaves out keeps the
  // defaults, and the controls show what the session will actually use.
  const params = new URLSearchParams(window.location.search);
  const fromUrl = settingsFromQuery(params);
  setup.apply(fromUrl.settings);
  setup.refresh();

  // The configuration screen is the way in unless a link already chose the
  // trial — and `?autostart=1`, whose whole point is a session without a click.
  const autostart = params.get('autostart') === '1';
  if (fromUrl.skipSetup || autostart) exercise.enter();
  else wizard.show('setup');

  // A measurement shortcut, not part of the flow: it lets a headless browser
  // with a fake microphone start the exercise without a click.
  if (autostart) void exercise.start();
  registerServiceWorker();
}

void main();

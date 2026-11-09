/**
 * :Project:  suona-la-nota -- the page as composition
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The page, as composition and nothing else: it reads the URL, builds the
 * screens, shows the first one. Every rule lives in the module that owns it —
 * `screens/setup` the trial and the teacher's list, `screens/soundcheck` the
 * measurement of the listening, `screens/exercise` the session in progress,
 * `screens/summary` what a session leaves behind.
 *
 * The page is a wizard: one screen at a time, the configuration first, then the
 * staff, then the summary, and no way past the first without pressing
 * "Comincia". A URL can dictate the trial (`?duration=30&range=advanced`, see
 * docs/adr/0011): then the configuration screen is skipped, because the link
 * already answered the question it would ask. A URL can also ask for the
 * soundcheck (`?soundcheck=1`): that step comes first, wherever the page would
 * otherwise have gone, and when it is done the page returns to the
 * configuration — or to the trial, if the link had already chosen one.
 */
import { loadPortata, savePortata, type Portata } from './exercise/portata';
import { settingsFromQuery, soundcheckRequired } from './exercise/settings';
import { registerServiceWorker, applyUpdate } from './pwa/register';
import { createExerciseScreen } from './screens/exercise';
import { createSetupScreen, type SetupScreen } from './screens/setup';
import { createSoundcheckScreen } from './screens/soundcheck';
import { createSummaryScreen } from './screens/summary';
import { createWizard } from './screens/wizard';
import { browserStorage, element } from './ui/dom';

async function main(): Promise<void> {
  await document.fonts.ready;

  const params = new URLSearchParams(window.location.search);
  const fromUrl = settingsFromQuery(params);
  const autostart = params.get('autostart') === '1';
  const required = soundcheckRequired(params);

  const wizard = createWizard({
    avvio: element<HTMLElement>('avvio'),
    setup: element<HTMLElement>('setup'),
    exercise: element<HTMLElement>('exercise'),
    summary: element<HTMLElement>('summary'),
  });

  const storage = browserStorage();
  /** The measurement on the phone: it belongs to the device, until it is redone. */
  let portata: Portata | null = loadPortata(storage);

  // The one cycle of the page, and the only place where it is allowed to
  // exist: the exercise screen reads the trial the setup controls describe, and
  // the setup screen asks whether a session is in the way. Both are closures,
  // resolved on the first click, so the order of construction does not matter.
  let setup!: SetupScreen;
  const summary = createSummaryScreen({ wizard, restart: () => exercise.backToSetup() });
  const exercise = createExerciseScreen({
    wizard,
    settings: () => setup.settings(),
    portata: () => portata,
    refreshSetup: () => setup.refresh(),
    summary,
  });
  const soundcheck = createSoundcheckScreen({
    wizard,
    settings: () => setup.settings(),
    save: (measured) => {
      portata = measured;
      savePortata(storage, measured);
    },
    // Whichever screen the URL would have gone to, the step returns there: the
    // configuration, unless the link had already chosen a trial.
    done: () => {
      setup.refresh();
      if (fromUrl.skipSetup || autostart) exercise.enter();
      else wizard.show('setup');
    },
  });
  setup = createSetupScreen({
    busy: exercise.busy,
    changed: exercise.trialChanged,
    begin: exercise.enter,
    portata: () => portata,
    measure: () => soundcheck.enter(),
  });

  // The URL may have already chosen the trial. What it leaves out keeps the
  // defaults, and the controls show what the session will actually use.
  setup.apply(fromUrl.settings);
  setup.refresh();

  // The configuration screen is the way in unless a link already chose the
  // trial — and `?autostart=1`, whose whole point is a session without a click.
  // `?soundcheck=1` comes before either, and its way out is a button, never a
  // silent skip.
  if (required) soundcheck.enter({ keep: portata, required });
  else if (fromUrl.skipSetup || autostart) exercise.enter();
  else wizard.show('setup');

  // A measurement shortcut, not part of the flow: it lets a headless browser
  // with a fake microphone start the exercise without a click. With a required
  // soundcheck the gesture that opens the microphone is the step's own button.
  if (autostart && !required) void exercise.start();

  // The shell updates when the reader says so: the bar appears if a new worker
  // is waiting, and the button is what reloads the page.
  const updateBar = element<HTMLDivElement>('update');
  element<HTMLButtonElement>('update-apply').addEventListener('click', () => {
    applyUpdate();
  });
  registerServiceWorker(() => {
    updateBar.hidden = false;
  });
}

void main();

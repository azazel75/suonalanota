/**
 * :Project:  suona-la-nota -- the exercise screen
 * :Created:  dom 08 nov 2026 23:58:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The exercise screen: one target on the staff, the microphone, the verdicts,
 * and the way back to the configuration. It owns the session in progress and
 * the DOM it needs, and it asks for everything else through a port.
 *
 * Four decisions live here because they are about the browser and not about the
 * exercise:
 *
 *  - the microphone is opened on the button, because that is the only gesture
 *    the browser accepts;
 *  - the tone the application makes is heard by its own microphone for a few
 *    hundred milliseconds, and the pressioni it produces are dropped: they are the
 *    phone talking to itself;
 *  - a tab that is not watched is not a session being played, so going to the
 *    background pauses it instead of burning a minute of targets;
 *  - the settings are read once, when the session starts: they do not change
 *    while it runs, because the score would stop meaning anything.
 */
import { createListener, MIN_CREDIBILITY } from '../audio/listener';
import { openAudioInput, type AudioInput } from '../audio/microphone';
import { createExercise, type Exercise } from '../exercise/controller';
import { effectiveRange, type Portata } from '../exercise/portata';
import { sequenceFor, sessionConfigOf, type Settings } from '../exercise/settings';
import { drawTarget } from '../score/sheet';
import { keysInRange, nearestPlacement } from '../score/staff';
import type { EndReason, SessionState, Verdict } from '../session/engine';
import { element } from '../ui/dom';
import { count } from '../ui/text';
import { trialProblem } from './portata-text';
import type { ScreenName } from './screen-name';
import type { SummaryScreen } from './summary';
import type { Wizard } from './wizard';

/** How long after the beep the microphone's frames are not believed. */
const BEEP_MUTE_MS = 300;

/** How long the green or the red stays on the paper. */
const FLASH_MS = 350;

/** What the page asks of this screen, and nothing more. */
export interface ExerciseScreen {
  /** Shows the screen, ready: the trial on the staff and the button that opens the microphone. */
  enter(): void;
  /** Opens the microphone and starts the session, as the "Inizia" button does. */
  start(): Promise<void>;
  /** Back to the configuration, with the same values, without starting anything. */
  backToSetup(): void;
  /** The trial changed while no session ran: the start button follows it. */
  trialChanged(problem: string | null): void;
  /** True from the click to the microphone being open, and while a session runs. */
  busy(): boolean;
}

/** What this screen needs from the rest of the page. */
export interface ExercisePorts {
  readonly wizard: Wizard<ScreenName>;
  /** The trial the controls describe: read once, when the session starts. */
  readonly settings: () => Settings;
  /** Puts the setup controls back in agreement with the trial in force; answers with the problem, if any. */
  readonly refreshSetup: () => string | null;
  readonly summary: SummaryScreen;
  /** The portata the phone measured: the session can only ask what the device hears. */
  readonly portata: () => Portata | null;
}

interface Running {
  audio: AudioInput;
  exercise: Exercise;
  /** The trial in force, kept for the log: the controls may have moved since. */
  settings: Settings;
  /** The measurement in force when the session started, kept for the log. */
  portata: Portata | null;
  /** Until this instant the pressioni the microphone hears are the beep coming back. */
  muteUntil: number;
}

export function createExerciseScreen(ports: ExercisePorts): ExerciseScreen {
  const sheet = element<HTMLDivElement>('target');
  const statusLine = element<HTMLParagraphElement>('status');
  const messageLine = element<HTMLParagraphElement>('message');
  const startButton = element<HTMLButtonElement>('start');
  const pauseButton = element<HTMLButtonElement>('pause');
  const backButton = element<HTMLButtonElement>('back');

  let running: Running | null = null;
  /** True from the click to the microphone being open: a second click must not start a second session. */
  let starting = false;
  let flashTimer: number | null = null;

  function busy(): boolean {
    return running !== null || starting;
  }

  /** Something on the paper before the allievə presses anything, on the chosen range. */
  function drawPreview(): void {
    if (busy()) return;
    const range = effectiveRange(ports.settings().range, ports.portata()) ?? ports.settings().range;
    const keys = keysInRange(range);
    drawTarget(sheet, nearestPlacement(keys[Math.floor(Math.random() * keys.length)]));
  }

  function flash(verdict: Verdict): void {
    const kind = verdict === 'centered' ? 'flash-good' : 'flash-bad';
    sheet.classList.remove('flash-good', 'flash-bad');
    // Restart the animation even when two pressioni land back to back.
    void sheet.offsetWidth;
    sheet.classList.add(kind);
    if (flashTimer !== null) window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => sheet.classList.remove('flash-good', 'flash-bad'), FLASH_MS);
  }

  /** A line under the staff, or the counter back in its place. */
  function showMessage(text: string | null): void {
    if (text === null) {
      messageLine.hidden = true;
      statusLine.hidden = false;
      return;
    }
    messageLine.textContent = text;
    messageLine.hidden = false;
    statusLine.hidden = true;
  }

  function showStatus(snapshot: SessionState): void {
    const seconds = Math.ceil(snapshot.remainingMs / 1000);
    const parts = [
      `${seconds} s`,
      count(snapshot.score.centered, 'corretta', 'corrette'),
    ];
    if (snapshot.paused) parts.push('in pausa');
    statusLine.textContent = parts.join(' · ');
  }

  /** The session is over: the summary takes it from here, and the page forgets it. */
  function finish(reason: EndReason, state: SessionState): void {
    const current = running;
    // The exercise only ends a session it started, so this is unreachable; the
    // guard is here because a summary without a trial in force would have to
    // invent the settings the log is written from.
    if (current === null) return;
    running = null;
    current.audio.stop();

    ports.summary.show({
      reason,
      state,
      settings: current.settings,
      portata: current.portata,
      clefs: current.exercise.placements(),
      targets: current.exercise.log(),
    });

    pauseButton.hidden = true;
    showMessage(null);
  }

  function enter(): void {
    ports.wizard.show('exercise');
    const problem = ports.refreshSetup();
    if (problem === null) {
      drawPreview();
      statusLine.textContent = 'Premi Inizia, poi suona la nota che vedi.';
    } else {
      statusLine.textContent = problem;
    }
    backButton.hidden = false;
  }

  function backToSetup(): void {
    if (busy()) return;
    ports.summary.clear();
    ports.wizard.show('setup');
    pauseButton.hidden = true;
    startButton.hidden = false;
    ports.refreshSetup();
    showMessage(null);
  }

  function trialChanged(problem: string | null): void {
    startButton.disabled = starting || problem !== null;
  }

  async function start(): Promise<void> {
    if (busy()) return;
    const settings = ports.settings();
    const measured = ports.portata();
    // The trial as the phone can play it: an empty intersection, or a list whose
    // keys all fell outside it, is said in the configuration instead of starting
    // a session with nothing to ask.
    if (trialProblem(settings, measured) !== null) {
      ports.refreshSetup();
      return;
    }
    const effective = effectiveRange(settings.range, measured) ?? settings.range;
    const trial: Settings = { ...settings, range: effective };

    // From here to the open microphone nothing is to be touched: the way back
    // goes away at once, so no change can land on a trial already being built.
    starting = true;
    startButton.disabled = true;
    backButton.hidden = true;
    showMessage(null);

    const listener = createListener({
      lowMidi: trial.range.lowest,
      highMidi: trial.range.highest,
      minCredibility: MIN_CREDIBILITY,
    });

    let audio: AudioInput;
    try {
      audio = await openAudioInput((samples, sampleRate, now) => {
        const current = running;
        if (current === null) return;
        const frame = listener.push(samples, sampleRate, now);
        // The beep leaves this phone's speaker and comes back into its
        // microphone: what it produces is not the allievə's pressione.
        current.exercise.feed({
          at: now,
          levelDb: frame.levelDb,
          pressioni: now < current.muteUntil ? [] : frame.pressioni,
        });
      });
    } catch (error) {
      starting = false;
      backButton.hidden = false;
      ports.refreshSetup();
      showMessage(
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'Senza il microfono non si può ascoltare: concedilo e riprova.'
          : 'Il microfono non si è aperto: riprova.',
      );
      return;
    }

    // The sequence is drawn once, at the start: the range cannot be exhausted
    // and refilled behind the allievə's back.
    const exercise = createExercise({
      keys: sequenceFor(trial),
      config: sessionConfigOf(settings),
      ports: {
        draw: (placement) => drawTarget(sheet, placement),
        flash,
        beep: () => {
          audio.beep();
          const current = running;
          if (current !== null) current.muteUntil = performance.now() + BEEP_MUTE_MS;
          listener.clearPending();
        },
        message: showMessage,
        status: showStatus,
        end: finish,
      },
    });

    running = { audio, exercise, settings, portata: measured, muteUntil: 0 };
    starting = false;

    // Nothing to touch while the trial runs, and the staff gets the screen.
    startButton.hidden = true;
    pauseButton.hidden = false;
    pauseButton.textContent = 'Pausa';
  }

  function togglePause(): void {
    const current = running;
    if (current === null) return;
    if (current.exercise.state().paused) {
      current.exercise.resume();
      pauseButton.textContent = 'Pausa';
      return;
    }
    current.exercise.pause();
    pauseButton.textContent = 'Riprendi';
  }

  startButton.addEventListener('click', () => void start());
  pauseButton.addEventListener('click', togglePause);
  backButton.addEventListener('click', backToSetup);

  document.addEventListener('visibilitychange', () => {
    const current = running;
    if (document.hidden && current !== null && !current.exercise.state().paused) {
      current.exercise.pause();
      pauseButton.textContent = 'Riprendi';
    }
  });

  return { enter, start, backToSetup, trialChanged, busy };
}

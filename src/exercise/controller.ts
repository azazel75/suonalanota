/**
 * :Project:  suona-la-nota -- the exercise, frame by frame
 * :Created:  dom 08 nov 2026 22:55:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * Between the microphone and the screen there is a rule, and this is it: what
 * each colpo does to what the allievo sees, when a target moves on, when the
 * page has to say "check the volume" instead of counting, and when the session
 * is over.
 *
 * It holds no DOM and no audio: the page hands it one frame at a time — the
 * level, the colpi completed — and it asks the ports to draw, flash, beep and
 * write. That is why the behaviour the ticket asks for can be read in a test
 * instead of being watched on a phone.
 *
 * It also keeps the book the session leaves: one entry per bersaglio with the
 * colpi heard while it was on screen, and the measurement each one arrived with
 * (`log()`), which is what the downloadable log is made of. Nothing about the
 * judgement changes because of it: the book is written as the colpi pass, and
 * the bersaglio still on screen when the time runs out is not in it — it never
 * had a verdict, so its colpi are evidence of nothing.
 *
 * Two things it decides that the engine cannot know:
 *
 *  - **silence** is not an error: five seconds with the microphone at the noise
 *    floor mean the instrument is off, or the headphones are on, and telling
 *    the allievo about it is better than letting the targets scroll by;
 *  - the **clock** is whatever the frames say: the page stops sending them when
 *    the tab is hidden, and a tab that is not watched is not a session being
 *    played.
 */
import { equallyNearInBothClefs, nearestPlacement, type Clef, type Placement } from '../score/staff';
import {
  createSession,
  type EndReason,
  type SessionConfig,
  type SessionState,
  type Verdict,
} from '../session/engine';
import {
  colpoLog,
  type ColpoLog,
  type ColpoMeasurement,
  type TargetLog,
} from '../session/log';

/**
 * What a colpo says, as far as the screen is concerned — and, since the log is
 * written from the same objects, as far as the file is concerned. The two fields
 * the judgement needs are required; the measurement the listener attaches is
 * optional, because a frame driven by hand has no detector behind it and the log
 * must be able to say `null` instead of a number nobody measured.
 */
export type HeardColpo = ColpoMeasurement;

/** One buffer of the microphone, as the page forwards it. */
export interface ExerciseFrame {
  /** When the buffer was taken, on the page's clock. */
  readonly at: number;
  /** Level of the frame, in dBFS. */
  readonly levelDb: number;
  /** The colpi this frame completed. */
  readonly colpi: readonly HeardColpo[];
}

/** Everything the exercise asks the page to do. */
export interface ExercisePorts {
  /** Put the target on the staff. */
  draw(placement: Placement): void;
  /** The verdict of a judged colpo: green on centered, red on wrong. */
  flash(verdict: Verdict): void;
  /** The same neutral tone for every judged colpo: the colour tells the answer, not the sound. */
  beep(): void;
  /** A line under the staff, or null to give the counter its place back. */
  message(text: string | null): void;
  /** The counter and the clocks. */
  status(state: SessionState): void;
  /** The session is over, and why. */
  end(reason: EndReason, state: SessionState): void;
}

export interface ExerciseOptions {
  /** The targets, in the order the session asks them. */
  keys: Iterable<number>;
  config?: SessionConfig;
  /** Silence longer than this is a device problem, not a wrong note. */
  silenceMs?: number;
  /** Below this level the room counts as silent, in dBFS. */
  silenceLevelDb?: number;
  ports: ExercisePorts;
}

export interface Exercise {
  /** One frame of the microphone. The first one only starts the clock. */
  feed(frame: ExerciseFrame): void;
  pause(): void;
  resume(): void;
  state(): SessionState;
  /** True once the session is over and the page has been told. */
  finished(): boolean;
  /** The clef each key was drawn in: the middle C can be written two ways. */
  placements(): ReadonlyMap<number, Clef>;
  /**
   * The bersagli the session asked, in that order, each with the colpi heard
   * while it was on screen. Nothing is written for the target still on display
   * when the session ends: it never had a verdict.
   */
  log(): readonly TargetLog[];
}

/** Five seconds of nothing is a room problem, not a wrong note. */
export const SILENCE_MS = 5_000;

/**
 * The level below which the microphone is hearing the room and nothing else.
 *
 * A quiet room sits around -70 dBFS on a phone; a note played at arm's length is
 * well above -40. -55 is the gap between them, and it is a number of this app,
 * not of the detector.
 */
export const SILENCE_LEVEL_DB = -55;

export const REPEAT_MESSAGE = 'Ripeti la nota.';

export const SILENCE_MESSAGE = 'Controlla il volume dello strumento, o togli le cuffie.';

export function createExercise(options: ExerciseOptions): Exercise {
  const { ports } = options;
  const session = createSession(options.keys, options.config);
  const silenceMs = options.silenceMs ?? SILENCE_MS;
  const silenceLevelDb = options.silenceLevelDb ?? SILENCE_LEVEL_DB;

  let lastAt: number | null = null;
  /** When the room went quiet, or null while the microphone hears something. */
  let silenceSince: number | null = null;
  /** The clef of the last middle C: that position alternates between the two. */
  let lastMiddleCClef: Clef | undefined;
  /** How many targets were closed when the staff last changed: a target is new when this moves. */
  let drawnResults = -1;
  let shownMessage: string | null = null;
  let announced = false;
  /** The clef each key was written in, so the summary shows the same writing. */
  const placements = new Map<number, Clef>();
  /** The bersagli the session asked, with their colpi: the book the log is made of. */
  const askedTargets: TargetLog[] = [];
  /** The bersaglio on screen now, when it appeared, and the colpi landing on it. */
  let openTarget: { key: number; colpi: ColpoLog[]; openedAt: number } | null = null;

  /**
   * Bring the book up to date with the session: close the entries the session has
   * closed since the last look, and start one for the bersaglio now on screen.
   *
   * The colpi of a closed entry are the ones that were collected while it was
   * open; a bersaglio the clock closed without a colpo gets an empty list, which
   * is what "nobody played" looks like in the file. The target on screen when the
   * session ends is dropped with its colpi, as ADR 0003 drops it from the counts.
   * `at` is the frame's instant: the file wants to say when a bersaglio appeared
   * and when it closed, and the frame is the only clock the page has.
   */
  function syncLog(at: number): void {
    const state = session.state();
    while (askedTargets.length < state.results.length) {
      const closed = state.results[askedTargets.length];
      const colpi = openTarget !== null && openTarget.key === closed.key ? openTarget.colpi : [];
      askedTargets.push({
        key: closed.key,
        verdict: closed.verdict,
        elapsedMs: closed.elapsedMs,
        openedAt: openTarget?.openedAt ?? at,
        closedAt: at,
        colpi,
      });
      openTarget = null;
    }
    if (state.finished || state.current === null) {
      openTarget = null;
      return;
    }
    if (openTarget === null) openTarget = { key: state.current.key, colpi: [], openedAt: at };
  }

  function showMessage(text: string | null): void {
    if (text === shownMessage) return;
    shownMessage = text;
    ports.message(text);
  }

  /** Draw the target the session has on screen now, if it is not the one already drawn. */
  function showCurrentTarget(): void {
    const state = session.state();
    if (state.finished || state.current === null) return;
    if (state.results.length === drawnResults) return;
    const placement = nearestPlacement(state.current.key, lastMiddleCClef);
    // Only the middle C position reads the previous clef, and only it has to be
    // remembered: everywhere else the key alone decides.
    if (equallyNearInBothClefs(state.current.key)) lastMiddleCClef = placement.clef;
    drawnResults = state.results.length;
    placements.set(state.current.key, placement.clef);
    ports.draw(placement);
  }

  function announceIfOver(): boolean {
    const state = session.state();
    if (!state.finished) return false;
    if (!announced) {
      announced = true;
      // Nothing else is drawn: the target still on screen is not a statistic.
      ports.end(state.endReason ?? 'duration', state);
    }
    return true;
  }

  function feed(frame: ExerciseFrame): void {
    if (announced) return;
    const at = frame.at;
    if (lastAt !== null && at > lastAt) {
      session.tick(at - lastAt);
      // A tick can close a bersaglio — or the session — without a colpo.
      syncLog(at);
    }
    lastAt = at;

    // The room is silent until the level says otherwise; the first audible
    // frame closes the window that a message opens.
    if (frame.levelDb >= silenceLevelDb) silenceSince = null;
    else if (silenceSince === null) silenceSince = at;

    showCurrentTarget();
    if (announceIfOver()) return;

    for (const colpo of frame.colpi) {
      // The colpo belongs to the bersaglio that was on screen when it was heard,
      // and `hit` may close that one: keep hold of it before it moves on.
      const target = openTarget;
      const result = session.hit(colpo.midi, colpo.ambiguous);
      if (result.kind === 'ignored') continue;
      if (target !== null) target.colpi.push(colpoLog(colpo, at));
      syncLog(at);
      // A colpo is sound, whatever the level of the frame it was read on.
      silenceSince = null;
      if (result.kind === 'ambiguous') {
        // No verdict and no try: the octave is part of the answer, so the app asks.
        showMessage(REPEAT_MESSAGE);
        continue;
      }
      showMessage(null);
      ports.flash(result.kind === 'verdict' ? result.verdict : 'wrong');
      ports.beep();
      showCurrentTarget();
      if (announceIfOver()) return;
    }

    const state = session.state();
    if (!state.paused && silenceSince !== null && at - silenceSince >= silenceMs) {
      showMessage(SILENCE_MESSAGE);
    }
    ports.status(state);
  }

  // The first target is on screen as soon as the exercise exists.
  if (!announceIfOver()) showCurrentTarget();
  syncLog(0);
  ports.status(session.state());

  return {
    feed,
    pause(): void {
      session.pause();
      showMessage(null);
      ports.status(session.state());
    },
    resume(): void {
      session.resume();
      ports.status(session.state());
    },
    state: () => session.state(),
    finished: () => announced,
    placements: () => placements,
    log: () => askedTargets,
  };
}

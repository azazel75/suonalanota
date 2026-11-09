/**
 * :Project:  suona-la-nota -- the session engine
 * :Created:  dom 08 nov 2026 22:02:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The state machine the whole exercise rests on: no DOM, no audio, no real
 * timer. It takes a sequence of targets from outside — an array, a generator, a
 * random source, it cannot tell — and a sequence of events, and says which
 * verdict each target gets and when the session is over.
 *
 * The verdict is decided by **how the target closes**, never by the clock alone
 * (docs/adr/0003, updated by docs/adr/0008):
 *
 *  | event                                         | verdict   |
 *  | a colpo contains the target's exact key       | centered  |
 *  | the target is closed by the wrong-hits cap    | wrong     |
 *  | the target time runs out, after a wrong colpo | wrong     |
 *  | the target time runs out, without one         | skipped   |
 *  | the session ends with the target on screen    | uncounted |
 *
 * A **colpo ambiguo** is not judged at all: the detector could not pick the
 * octave, so guessing would punish a correct answer. It costs no try, it is
 * only counted on the target (the log shows how unsure the device is on that
 * key), and a target closed by the clock with nothing but ambiguous colpi is
 * *skipped*, not *wrong*: the allievə has not tried yet.
 *
 * Three decisions this module makes, and why:
 *
 *  - the clock starts with the **first target**, so `createSession` already
 *    pulls one: there is no "not started" state to keep in step with the UI;
 *  - when a tick would expire the target and the session at the same instant,
 *    the session wins and the target is **not counted** — it was still on
 *    screen, and the ADR says a target nobody got to try is not a statistic;
 *  - a single tick may cross more than one target boundary (a coarse frame);
 *    the time is distributed over the targets it passes through rather than
 *    dropped, and never past the end of the session.
 *
 * The pause stops both clocks and touches nothing else: no time is consumed,
 * no colpo is judged, no count changes.
 */

/** How a target closed. The three values of the glossary, no fourth. */
export type Verdict = 'centered' | 'wrong' | 'skipped';

/** Why the session ended: the clock, or the list of targets. */
export type EndReason = 'duration' | 'targets';

/** A session lasts one minute unless the settings say otherwise. */
export const DEFAULT_DURATION_MS = 60_000;

/** A target gets eight seconds before it moves on. */
export const DEFAULT_TARGET_TIMEOUT_MS = 8_000;

/** What the settings ask for. Everything has a default except the cap. */
export interface SessionConfig {
  /** Duration of the whole session, in milliseconds. */
  durationMs?: number;
  /** Time a single target stays on screen, in milliseconds. */
  targetTimeoutMs?: number;
  /**
   * Wrong colpi after which a target closes as *wrong*. Off when absent: the
   * only limit left is the target's time.
   */
  wrongLimit?: number;
}

/** The configuration in force, with the defaults applied. */
export interface ResolvedConfig {
  readonly durationMs: number;
  readonly targetTimeoutMs: number;
  /** `null` when the cap is off. */
  readonly wrongLimit: number | null;
}

/** A target that has been closed, with how it closed. */
export interface ClosedTarget {
  /** MIDI number of the target. */
  readonly key: number;
  readonly verdict: Verdict;
  /** Non-ambiguous colpi that were not the target. */
  readonly wrongHits: number;
  /** Colpi the detector could not judge. Recorded, never counted. */
  readonly ambiguousHits: number;
  /** Time the target stayed on screen, in milliseconds. */
  readonly elapsedMs: number;
}

/** The target on screen right now. */
export interface OpenTarget {
  readonly key: number;
  readonly elapsedMs: number;
  readonly wrongHits: number;
  readonly ambiguousHits: number;
}

/** The score is three counts and a rate, not a single number. */
export interface SessionScore {
  readonly centered: number;
  readonly wrong: number;
  readonly skipped: number;
  /** Closed targets: always the sum of the three counts. */
  readonly total: number;
  /** Closed targets per minute of session, to one decimal. */
  readonly notesPerMinute: number;
}

/** Everything a screen needs to draw the session, in one immutable snapshot. */
export interface SessionState {
  readonly config: ResolvedConfig;
  readonly current: OpenTarget | null;
  readonly finished: boolean;
  readonly paused: boolean;
  /** Set only once the session is finished. */
  readonly endReason: EndReason | null;
  readonly elapsedMs: number;
  readonly remainingMs: number;
  /** Time left on the target on screen; 0 when there is none. */
  readonly targetRemainingMs: number;
  readonly results: readonly ClosedTarget[];
  readonly score: SessionScore;
}

/**
 * What a colpo did, so the screen does not have to re-derive the rule:
 *
 *  - `verdict` — the target closed, with this verdict (green on centered);
 *  - `wrong` — counted, the target stays on screen (red, try again);
 *  - `ambiguous` — not judged, ask for the note again (no flash);
 *  - `ignored` — the session is paused or over, nothing happened.
 */
export type HitResult =
  | { readonly kind: 'verdict'; readonly verdict: Verdict }
  | { readonly kind: 'wrong' }
  | { readonly kind: 'ambiguous' }
  | { readonly kind: 'ignored' };

/** The session, driven from outside. */
export interface Session {
  /** One colpo: the keys it was heard as, and whether the octave is uncertain. */
  hit(pitches: number | readonly number[], ambiguous?: boolean): HitResult;
  /** Advance the clocks by this much time. Ignored while paused or over. */
  tick(ms: number): void;
  pause(): void;
  resume(): void;
  state(): SessionState;
}

interface Open {
  key: number;
  elapsedMs: number;
  wrongHits: number;
  ambiguousHits: number;
}

interface Machine {
  readonly config: ResolvedConfig;
  readonly targets: Iterator<number>;
  current: Open | null;
  readonly closed: ClosedTarget[];
  elapsedMs: number;
  paused: boolean;
  finished: boolean;
  endReason: EndReason | null;
}

function resolveConfig(config: SessionConfig): ResolvedConfig {
  const limit = config.wrongLimit;
  return {
    durationMs: Math.max(0, Math.floor(config.durationMs ?? DEFAULT_DURATION_MS)),
    // A zero timeout would close every target on the next tick: keep it real.
    targetTimeoutMs: Math.max(1, Math.floor(config.targetTimeoutMs ?? DEFAULT_TARGET_TIMEOUT_MS)),
    // A cap of zero or less is not a cap: the default is off.
    wrongLimit: typeof limit === 'number' && limit >= 1 ? Math.floor(limit) : null,
  };
}

function finish(machine: Machine, reason: EndReason): void {
  machine.finished = true;
  machine.paused = false;
  machine.endReason = reason;
  // Whatever was on screen is dropped: it is not a verdict (ADR 0003).
  machine.current = null;
}

/** Put the next target on screen, or end the session when the list is over. */
function pullTarget(machine: Machine): void {
  const next = machine.targets.next();
  if (next.done === true) {
    finish(machine, 'targets');
    return;
  }
  machine.current = { key: next.value, elapsedMs: 0, wrongHits: 0, ambiguousHits: 0 };
}

function closeTarget(machine: Machine, verdict: Verdict): void {
  const open = machine.current;
  if (open === null) return;
  machine.closed.push({
    key: open.key,
    verdict,
    wrongHits: open.wrongHits,
    ambiguousHits: open.ambiguousHits,
    elapsedMs: open.elapsedMs,
  });
  machine.current = null;
  pullTarget(machine);
}

/** The clock closed the target: wrong only if there was a real attempt. */
function closeOnTimeout(machine: Machine): void {
  const open = machine.current;
  if (open === null) return;
  closeTarget(machine, open.wrongHits > 0 ? 'wrong' : 'skipped');
}

function contains(pitches: number | readonly number[], key: number): boolean {
  const wanted = Math.round(key);
  if (typeof pitches === 'number') return Math.round(pitches) === wanted;
  return pitches.some((pitch) => Math.round(pitch) === wanted);
}

function advance(machine: Machine, ms: number): void {
  if (machine.finished || machine.paused) return;
  if (!Number.isFinite(ms) || ms <= 0) return;

  let remaining = ms;
  while (remaining > 0 && !machine.finished && machine.current !== null) {
    const open = machine.current;
    const sessionLeft = machine.config.durationMs - machine.elapsedMs;
    if (sessionLeft <= 0) {
      finish(machine, 'duration');
      return;
    }
    const targetLeft = machine.config.targetTimeoutMs - open.elapsedMs;
    if (targetLeft <= 0) {
      closeOnTimeout(machine);
      continue;
    }

    const step = Math.min(remaining, sessionLeft, targetLeft);
    machine.elapsedMs += step;
    open.elapsedMs += step;
    remaining -= step;

    // The session comes first: a target still on screen at the end is not a
    // statistic, even when its own time would have expired at the same instant.
    if (machine.elapsedMs >= machine.config.durationMs) {
      finish(machine, 'duration');
      return;
    }
    if (open.elapsedMs >= machine.config.targetTimeoutMs) closeOnTimeout(machine);
  }
}

function hit(
  machine: Machine,
  pitches: number | readonly number[],
  ambiguous: boolean,
): HitResult {
  if (machine.finished || machine.paused) return { kind: 'ignored' };
  const open = machine.current;
  if (open === null) return { kind: 'ignored' };

  if (ambiguous) {
    // Not judged and no try spent: the octave is the answer, so the app asks.
    open.ambiguousHits += 1;
    return { kind: 'ambiguous' };
  }

  if (contains(pitches, open.key)) {
    closeTarget(machine, 'centered');
    return { kind: 'verdict', verdict: 'centered' };
  }

  open.wrongHits += 1;
  const limit = machine.config.wrongLimit;
  if (limit !== null && open.wrongHits >= limit) {
    closeTarget(machine, 'wrong');
    return { kind: 'verdict', verdict: 'wrong' };
  }
  return { kind: 'wrong' };
}

function scoreOf(machine: Machine): SessionScore {
  let centered = 0;
  let wrong = 0;
  let skipped = 0;
  for (const target of machine.closed) {
    if (target.verdict === 'centered') centered += 1;
    else if (target.verdict === 'wrong') wrong += 1;
    else skipped += 1;
  }
  const total = machine.closed.length;
  // Rounded to a decimal because this is the number the summary shows and the
  // classification ranks: comparing a hidden precision would not be fair.
  const notesPerMinute =
    machine.elapsedMs > 0
      ? Math.round((total / (machine.elapsedMs / 60_000)) * 10) / 10
      : 0;
  return { centered, wrong, skipped, total, notesPerMinute };
}

function snapshot(machine: Machine): SessionState {
  const { config } = machine;
  const current = machine.current;
  return {
    config,
    current:
      current === null
        ? null
        : {
            key: current.key,
            elapsedMs: current.elapsedMs,
            wrongHits: current.wrongHits,
            ambiguousHits: current.ambiguousHits,
          },
    finished: machine.finished,
    paused: machine.paused,
    endReason: machine.endReason,
    elapsedMs: machine.elapsedMs,
    remainingMs: Math.max(0, config.durationMs - machine.elapsedMs),
    targetRemainingMs:
      current === null ? 0 : Math.max(0, config.targetTimeoutMs - current.elapsedMs),
    results: machine.closed.map((target) => ({ ...target })),
    score: scoreOf(machine),
  };
}

/**
 * A session over these targets. The first target is on screen as soon as the
 * session exists — the clock starts when the first note appears — and an empty
 * sequence is a session that is already over.
 */
export function createSession(targets: Iterable<number>, config: SessionConfig = {}): Session {
  const machine: Machine = {
    config: resolveConfig(config),
    targets: targets[Symbol.iterator](),
    current: null,
    closed: [],
    elapsedMs: 0,
    paused: false,
    finished: false,
    endReason: null,
  };

  if (machine.config.durationMs <= 0) finish(machine, 'duration');
  else pullTarget(machine);

  return {
    hit: (pitches, ambiguous = false) => hit(machine, pitches, ambiguous),
    tick: (ms) => advance(machine, ms),
    pause: () => {
      if (!machine.finished) machine.paused = true;
    },
    resume: () => {
      if (!machine.finished) machine.paused = false;
    },
    state: () => snapshot(machine),
  };
}

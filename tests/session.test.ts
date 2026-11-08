/**
 * :Project:  suona-la-nota -- the session engine, judged by its verdicts
 * :Created:  dom 08 nov 2026 22:02:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The engine's only seam: a sequence of targets and a sequence of events in,
 * verdicts and counts out. No DOM, no audio, no real timer — `tick` is the clock.
 * One test per row of the matrix of ADR 0003 (as updated by ADR 0008), then the
 * cases around it: the ambiguous colpo, the pause, the cap, the end of the
 * session, the score.
 */
import { describe, expect, test } from 'vitest';

import { createSession, DEFAULT_DURATION_MS, DEFAULT_TARGET_TIMEOUT_MS } from '../src/session/engine';
import type { Session, Verdict } from '../src/session/engine';

const MIDDLE_C = 60;
const D4 = 62;
const E4 = 64;
const F4 = 65;
const G4 = 67;

/** The verdicts in the order the targets closed. */
function verdicts(session: Session): Verdict[] {
  return session.state().results.map((result) => result.verdict);
}

describe('the verdict matrix', () => {
  test('a colpo that contains the target key closes the target as centered', () => {
    const session = createSession([MIDDLE_C]);
    expect(session.hit(MIDDLE_C)).toEqual({ kind: 'verdict', verdict: 'centered' });
    expect(verdicts(session)).toEqual(['centered']);
  });

  test('a colpo that contains the target among other keys is still centered', () => {
    const session = createSession([MIDDLE_C]);
    expect(session.hit([E4, MIDDLE_C, G4])).toEqual({ kind: 'verdict', verdict: 'centered' });
    expect(verdicts(session)).toEqual(['centered']);
  });

  test('a wrong colpo leaves the target on screen and costs a try', () => {
    const session = createSession([MIDDLE_C]);
    expect(session.hit(D4)).toEqual({ kind: 'wrong' });

    const state = session.state();
    expect(state.results).toHaveLength(0);
    expect(state.finished).toBe(false);
    expect(state.current).toEqual({ key: MIDDLE_C, elapsedMs: 0, wrongHits: 1, ambiguousHits: 0 });
  });

  test('the wrong-hits cap closes the target as wrong', () => {
    const session = createSession([MIDDLE_C, E4], { wrongLimit: 2 });
    expect(session.hit(D4)).toEqual({ kind: 'wrong' });
    expect(session.hit(F4)).toEqual({ kind: 'verdict', verdict: 'wrong' });
    expect(verdicts(session)).toEqual(['wrong']);
    expect(session.state().current?.key).toBe(E4);
  });

  test('with the cap off a wrong colpo never closes the target', () => {
    const session = createSession([MIDDLE_C]);
    for (let attempt = 0; attempt < 20; attempt++) {
      expect(session.hit(D4)).toEqual({ kind: 'wrong' });
    }
    expect(session.state().current?.wrongHits).toBe(20);
    expect(session.state().results).toHaveLength(0);
  });

  test('the clock closes the target as wrong when there was a wrong colpo', () => {
    const session = createSession([MIDDLE_C, E4]);
    session.hit(D4);
    session.tick(DEFAULT_TARGET_TIMEOUT_MS);

    expect(session.state().results).toEqual([
      { key: MIDDLE_C, verdict: 'wrong', wrongHits: 1, ambiguousHits: 0, elapsedMs: 8000 },
    ]);
  });

  test('the clock closes a target nobody tried as skipped', () => {
    const session = createSession([MIDDLE_C, E4]);
    session.tick(DEFAULT_TARGET_TIMEOUT_MS);

    expect(verdicts(session)).toEqual(['skipped']);
    expect(session.state().results[0].wrongHits).toBe(0);
  });

  test('the clock closes a target with only ambiguous colpi as skipped', () => {
    const session = createSession([MIDDLE_C, E4]);
    session.hit(MIDDLE_C, true);
    session.hit(MIDDLE_C, true);
    session.tick(DEFAULT_TARGET_TIMEOUT_MS);

    expect(verdicts(session)).toEqual(['skipped']);
    expect(session.state().results[0]).toMatchObject({ wrongHits: 0, ambiguousHits: 2 });
  });

  test('a target still on screen when the session ends is not counted', () => {
    const session = createSession([MIDDLE_C, E4], { durationMs: 5000 });
    session.tick(5000);

    const state = session.state();
    expect(state.finished).toBe(true);
    expect(state.endReason).toBe('duration');
    expect(state.current).toBeNull();
    expect(state.results).toHaveLength(0);
    expect(state.score).toEqual({ centered: 0, wrong: 0, skipped: 0, total: 0, notesPerMinute: 0 });
  });

  test('when the target and the session expire together the target is not counted', () => {
    const session = createSession([MIDDLE_C], { durationMs: 8000, targetTimeoutMs: 8000 });
    session.tick(8000);

    expect(session.state().endReason).toBe('duration');
    expect(session.state().results).toHaveLength(0);
  });
});

describe('the ambiguous colpo', () => {
  test('produces no verdict even when the colpo contains the target key', () => {
    const session = createSession([MIDDLE_C]);
    expect(session.hit(MIDDLE_C, true)).toEqual({ kind: 'ambiguous' });
    expect(session.state().results).toHaveLength(0);
    expect(session.state().current?.key).toBe(MIDDLE_C);
  });

  test('does not count towards the wrong-hits cap', () => {
    const session = createSession([MIDDLE_C, E4], { wrongLimit: 1 });
    for (let attempt = 0; attempt < 5; attempt++) session.hit(E4, true);

    expect(session.state().current?.wrongHits).toBe(0);
    expect(session.hit(D4)).toEqual({ kind: 'verdict', verdict: 'wrong' });
  });

  test('is recorded on the target, so the log can show how unsure the device is', () => {
    const session = createSession([MIDDLE_C, E4]);
    for (let attempt = 0; attempt < 3; attempt++) session.hit(MIDDLE_C, true);
    session.tick(DEFAULT_TARGET_TIMEOUT_MS);

    expect(session.state().results[0]).toEqual({
      key: MIDDLE_C,
      verdict: 'skipped',
      wrongHits: 0,
      ambiguousHits: 3,
      elapsedMs: 8000,
    });
  });
});

describe('the pause', () => {
  test('consumes neither the session nor the target time', () => {
    const session = createSession([MIDDLE_C, E4]);
    session.tick(1000);
    session.pause();
    session.tick(50_000);

    const paused = session.state();
    expect(paused.paused).toBe(true);
    expect(paused.elapsedMs).toBe(1000);
    expect(paused.remainingMs).toBe(DEFAULT_DURATION_MS - 1000);
    expect(paused.current?.elapsedMs).toBe(1000);
    expect(paused.targetRemainingMs).toBe(DEFAULT_TARGET_TIMEOUT_MS - 1000);

    session.resume();
    session.tick(1000);
    expect(session.state().elapsedMs).toBe(2000);
    expect(session.state().current?.elapsedMs).toBe(2000);
  });

  test('leaves the counts alone and the target still open', () => {
    const session = createSession([MIDDLE_C, E4]);
    session.hit(MIDDLE_C);
    session.hit(D4);

    session.pause();
    session.tick(4000);
    session.resume();

    expect(verdicts(session)).toEqual(['centered']);
    expect(session.state().current?.wrongHits).toBe(1);

    session.tick(DEFAULT_TARGET_TIMEOUT_MS);
    expect(verdicts(session)).toEqual(['centered', 'wrong']);
  });

  test('a colpo while paused is not judged', () => {
    const session = createSession([MIDDLE_C]);
    session.pause();

    expect(session.hit(MIDDLE_C)).toEqual({ kind: 'ignored' });
    expect(session.state().results).toHaveLength(0);
    expect(session.state().current?.wrongHits).toBe(0);
  });
});

describe('the end of the session', () => {
  test('ends when the duration expires, keeping what was already counted', () => {
    // Five targets for a 20 s session: 8 s each, so the clock runs out before
    // the list does, and the target on screen at that moment is dropped.
    const session = createSession([MIDDLE_C, E4, G4, F4, D4], { durationMs: 20000 });
    session.hit(MIDDLE_C);
    session.tick(20_000);

    const state = session.state();
    expect(state.finished).toBe(true);
    expect(state.endReason).toBe('duration');
    expect(state.elapsedMs).toBe(20_000);
    expect(state.score).toEqual({ centered: 1, wrong: 0, skipped: 2, total: 3, notesPerMinute: 9 });
  });

  test('ends when the list of targets is exhausted', () => {
    const session = createSession([MIDDLE_C, E4]);
    session.hit(MIDDLE_C);

    expect(session.state().finished).toBe(false);
    expect(session.state().current?.key).toBe(E4);

    session.hit(E4);
    const state = session.state();
    expect(state.finished).toBe(true);
    expect(state.endReason).toBe('targets');
    expect(state.current).toBeNull();
    expect(state.score.centered).toBe(2);
  });

  test('an empty sequence is a session that ends before the first target', () => {
    const state = createSession([]).state();
    expect(state.finished).toBe(true);
    expect(state.endReason).toBe('targets');
    expect(state.remainingMs).toBe(DEFAULT_DURATION_MS);
    expect(state.score).toEqual({ centered: 0, wrong: 0, skipped: 0, total: 0, notesPerMinute: 0 });
  });

  test('nothing happens after it is over', () => {
    const session = createSession([MIDDLE_C]);
    session.hit(MIDDLE_C);
    const before = session.state();

    expect(session.hit(E4)).toEqual({ kind: 'ignored' });
    session.tick(5000);
    session.pause();

    const after = session.state();
    expect(after.elapsedMs).toBe(before.elapsedMs);
    expect(after.results).toEqual(before.results);
    expect(after.paused).toBe(false);
  });

  test('a single coarse tick runs through the targets it crosses', () => {
    const session = createSession([MIDDLE_C, E4, G4]);
    session.tick(20_000);

    const state = session.state();
    expect(verdicts(session)).toEqual(['skipped', 'skipped']);
    expect(state.current).toEqual({ key: G4, elapsedMs: 4000, wrongHits: 0, ambiguousHits: 0 });
    expect(state.remainingMs).toBe(DEFAULT_DURATION_MS - 20_000);
  });

  test('the session clock never runs past the duration', () => {
    const targets = Array.from({ length: 20 }, (_, index) => MIDDLE_C + index);
    const session = createSession(targets);
    session.tick(120_000);

    const state = session.state();
    expect(state.elapsedMs).toBe(DEFAULT_DURATION_MS);
    expect(state.remainingMs).toBe(0);
    expect(state.finished).toBe(true);
    expect(state.endReason).toBe('duration');
  });

  test('the wrong colpi of one target do not carry over to the next', () => {
    const session = createSession([MIDDLE_C, E4]);
    session.hit(D4);
    session.hit(D4);
    session.tick(DEFAULT_TARGET_TIMEOUT_MS);

    expect(session.state().results[0].wrongHits).toBe(2);
    expect(session.state().current).toEqual({
      key: E4,
      elapsedMs: 0,
      wrongHits: 0,
      ambiguousHits: 0,
    });
  });
});

describe('the score', () => {
  test('is the three counts plus the notes per minute', () => {
    const session = createSession([MIDDLE_C, D4, E4, F4, G4], { durationMs: 30_000 });
    expect(session.hit(MIDDLE_C)).toEqual({ kind: 'verdict', verdict: 'centered' });

    session.tick(4000);
    expect(session.hit(63)).toEqual({ kind: 'wrong' });
    session.tick(4000);
    expect(verdicts(session)).toEqual(['centered', 'wrong']);

    expect(session.hit(E4, true)).toEqual({ kind: 'ambiguous' });
    session.tick(8000);
    expect(verdicts(session)).toEqual(['centered', 'wrong', 'skipped']);

    // F4 closes on its own time at 24 s; G4 is then on screen when the 30 s of
    // the session run out, and is not a fifth target.
    session.tick(14_000);

    const state = session.state();
    expect(state.finished).toBe(true);
    expect(state.endReason).toBe('duration');
    expect(state.elapsedMs).toBe(30_000);
    expect(state.score).toEqual({
      centered: 1,
      wrong: 1,
      skipped: 2,
      total: 4,
      notesPerMinute: 8,
    });
  });

  test('counts add up to the targets that closed', () => {
    const session = createSession([MIDDLE_C, D4, E4, F4, G4], { targetTimeoutMs: 4000 });
    session.hit(MIDDLE_C); // centered, at once
    session.tick(4000); // D4 skipped
    session.hit(66); // a wrong colpo on E4
    session.tick(4000); // E4 wrong
    session.tick(4000); // F4 skipped
    session.tick(4000); // G4 skipped, list over

    const { score, results } = session.state();
    expect(session.state().endReason).toBe('targets');
    expect(results).toHaveLength(5);
    expect(score.total).toBe(results.length);
    expect(score.centered + score.wrong + score.skipped).toBe(score.total);
    // 5 targets in 16 s: 18.75, shown and ranked as one decimal.
    expect(score).toEqual({ centered: 1, wrong: 1, skipped: 3, total: 5, notesPerMinute: 18.8 });
  });
});

describe('the settings', () => {
  test('default to a minute, eight seconds a target and no cap', () => {
    expect(createSession([MIDDLE_C]).state().config).toEqual({
      durationMs: DEFAULT_DURATION_MS,
      targetTimeoutMs: DEFAULT_TARGET_TIMEOUT_MS,
      wrongLimit: null,
    });
  });

  test('the cap is the number they asked for', () => {
    expect(createSession([MIDDLE_C], { wrongLimit: 3 }).state().config.wrongLimit).toBe(3);
  });
});

describe('the sequence of targets', () => {
  test('comes from outside: a generator is a sequence like any other', () => {
    function* threeNotes(): Generator<number> {
      yield MIDDLE_C;
      yield D4;
      yield E4;
    }

    const session = createSession(threeNotes());
    session.hit(MIDDLE_C);
    session.hit(D4);
    session.hit(E4);

    expect(session.state().endReason).toBe('targets');
    expect(session.state().score.centered).toBe(3);
  });
});

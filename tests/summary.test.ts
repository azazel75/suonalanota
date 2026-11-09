/**
 * :Project:  suona-la-nota -- the session summary, checked without a browser
 * :Created:  dom 08 nov 2026 23:42:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The summaries are produced by real sessions of the engine, not by hand-made
 * state: a summary that agrees with a state the engine never produces proves
 * nothing.
 */
import { describe, expect, it } from 'vitest';

import { summarise } from '../src/exercise/summary';
import { fitsSheet, seriesSheet } from '../src/score/layout';
import { nearestPlacement } from '../src/score/staff';
import { createSession, type Session, type SessionConfig } from '../src/session/engine';

function session(keys: number[], config: SessionConfig = {}): Session {
  return createSession(keys, config);
}

describe('the summary', () => {
  it('keeps the three verdicts apart and makes the total their sum', () => {
    const run = session([60, 62, 64]);
    run.hit(60);              // centered
    run.hit(61);              // wrong pressione…
    run.tick(8_000);          // …and the clock closes the target as wrong
    run.tick(8_000);          // nobody plays the third: skipped

    const summary = summarise(run.state());
    expect([summary.centered, summary.wrong, summary.skipped]).toEqual([1, 1, 1]);
    expect(summary.total).toBe(3);
    expect(summary.total).toBe(summary.centered + summary.wrong + summary.skipped);
  });

  it('does not count the target that was still on screen', () => {
    const run = session([60, 62], { durationMs: 1_000 });
    run.tick(1_000);

    const summary = summarise(run.state());
    expect(summary.total).toBe(0);
    expect(summary.centered + summary.wrong + summary.skipped).toBe(0);
  });

  it('lists a wrong note once, in the order it was asked', () => {
    const run = session([62, 60, 62]);
    run.hit(61);              // 62 wrong
    run.tick(8_000);
    run.hit(59);              // 60 wrong
    run.tick(8_000);
    run.hit(59);              // 62 wrong again
    run.tick(8_000);

    const summary = summarise(run.state());
    expect(summary.wrong).toBe(3);
    expect(summary.wrongNotes.flatMap((series) => series.notes.map((note) => note.key))).toEqual([62, 60]);
  });

  it('keeps the skipped notes in their own list', () => {
    const run = session([64, 65]);
    run.tick(8_000);
    run.tick(8_000);

    const summary = summarise(run.state());
    expect(summary.skippedNotes.flatMap((series) => series.notes.map((note) => note.key))).toEqual([64, 65]);
    expect(summary.wrongNotes).toEqual([]);
  });

  it('puts the notes of one clef in one series, treble first', () => {
    const run = session([60, 45, 64]);
    run.hit(70);
    run.tick(8_000);
    run.hit(70);
    run.tick(8_000);
    run.hit(70);
    run.tick(8_000);

    const summary = summarise(
      run.state(),
      new Map([
        [60, 'bass' as const],
        [45, 'bass' as const],
        [64, 'treble' as const],
      ]),
    );
    expect(summary.wrongNotes.map((series) => series.clef)).toEqual(['treble', 'bass']);
    expect(summary.wrongNotes[0].notes.map((note) => note.key)).toEqual([64]);
    expect(summary.wrongNotes[1].notes.map((note) => note.key)).toEqual([60, 45]);
  });

  it('writes the rate with the Italian comma', () => {
    const run = session([60, 62, 64], { durationMs: 120_000, targetTimeoutMs: 120_000 });
    run.tick(40_000);
    run.hit(60);
    run.hit(62);
    run.hit(64);

    // Three targets in forty seconds: four and a half a minute, with a comma.
    expect(summarise(run.state()).notesPerMinute).toBe('4,5');
  });

  it('says why the session is over', () => {
    const byTime = session([60, 62], { durationMs: 1_000 });
    byTime.tick(1_000);
    expect(summarise(byTime.state()).reason).toBe('duration');

    const byList = session([60]);
    byList.hit(60);
    expect(summarise(byList.state()).reason).toBe('targets');
  });

  it('draws a note in the clef it was asked in, when the session knows it', () => {
    const run = session([60]);
    run.hit(61);
    run.tick(8_000);

    const summary = summarise(run.state(), new Map([[60, 'bass' as const]]));
    expect(summary.wrongNotes[0].clef).toBe('bass');
    expect(summary.wrongNotes[0].notes[0].placement.clef).toBe('bass');
    expect(summary.wrongNotes[0].notes[0].name).toBe('Do4');
  });

  it('gives a series a sheet that fits every note, ledger lines included', () => {
    // The bottom and the top of the advanced range on one staff: the case that
    // cut the low notes when the sheet had a fixed height.
    const placements = [35, 45, 86, 60].map((key) => nearestPlacement(key, 'bass'));
    const sheet = seriesSheet(placements);
    for (const placement of placements) expect(fitsSheet(placement, sheet)).toBe(true);
  });
});

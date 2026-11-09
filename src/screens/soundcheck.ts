/**
 * :Project:  suona-la-nota -- the screen that measures the listening
 * :Created:  lun 09 nov 2026 01:50:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * The soundcheck screen: it opens the microphone on a gesture, asks five notes
 * one at a time, and hands the measurement over. The rules are in
 * `exercise/soundcheck.ts`; this file is the paper they are written on.
 *
 * Four decisions live here because they are about the browser:
 *
 *  - the microphone is opened on the button, because that is the only gesture
 *    the browser accepts, and closed as soon as the five notes are done;
 *  - the listener searches the **whole piano**, not the trial range: the whole
 *    point of measuring the extent is to find out which keys the instrument has,
 *    and a search that began from the trial would assume the answer;
 *  - a measurement that already exists is offered, not repeated: the step is
 *    occasional, and redoing it must be a choice;
 *  - a screen that cannot measure still has a way out, and it says what it
 *    costs: no portata, the nominal range, and an honest word in the log.
 */
import { HIGHEST_MIDI, LOWEST_MIDI, midiToItalian } from '../audio/notes';
import { createListener, MIN_CREDIBILITY } from '../audio/listener';
import { openAudioInput, type AudioInput } from '../audio/microphone';
import {
  PROBES,
  createSoundcheck,
  type Probe,
  type Soundcheck,
  type SoundcheckSnapshot,
} from '../exercise/soundcheck';
import { effectiveRange, type Portata } from '../exercise/portata';
import type { Settings } from '../exercise/settings';
import { element } from '../ui/dom';
import { describePortata, trialProblem } from './portata-text';
import type { ScreenName } from './screen-name';
import type { Wizard } from './wizard';

/** What the allievə is asked, in the words the screen says. */
const PROMPTS: Readonly<Record<Probe, string>> = {
  basso: 'Suona il tasto più basso del tuo pianoforte.',
  alto: 'Ora il tasto più alto.',
  basso2: 'Suona di nuovo il tasto più basso.',
  alto2: 'E di nuovo il tasto più alto.',
  centrale: 'Ora il Do centrale: quello in mezzo alla tastiera.',
};

/** What the screen says while the browser asks for the microphone. */
const OPENING = 'Sto accendendo il microfono…';

/** What it says when the room never made a sound. */
const VOLUME =
  'Controlla il volume dello strumento, o togli le cuffie: il microfono non ha sentito niente.';

/** What it says when the control note did not arrive, though the room was not silent. */
const NO_CENTRE = 'Il Do centrale non è arrivato: riprova, avvicinando il telefono al pianoforte.';

/** What it says when the browser refuses the microphone. */
const REFUSED = 'Senza il microfono non si può misurare: concedilo e riprova.';

/** What the page asks of this screen, and nothing more. */
export interface SoundcheckScreen {
  /**
   * Opens the screen. `keep` is a measurement already on the phone, offered
   * instead of measured again; `required` is the URL asking for the step, which
   * only changes the words of the way out — never whether there is one.
   */
  enter(options?: { readonly keep?: Portata | null; readonly required?: boolean }): void;
}

/** What this screen needs from the rest of the page. */
export interface SoundcheckPorts {
  readonly wizard: Wizard<ScreenName>;
  /** The trial in force: the result is shown against the range it would narrow. */
  readonly settings: () => Settings;
  /** Remembers the measurement the allievə chose to use. */
  readonly save: (portata: Portata) => void;
  /** The step is over: the page decides which screen comes next. */
  readonly done: () => void;
}

type Phase = 'intro' | 'opening' | 'measuring' | 'result' | 'problem';

export function createSoundcheckScreen(ports: SoundcheckPorts): SoundcheckScreen {
  const lead = element<HTMLParagraphElement>('avvio-lead');
  const step = element<HTMLParagraphElement>('avvio-step');
  const status = element<HTMLParagraphElement>('avvio-status');
  const message = element<HTMLParagraphElement>('avvio-message');
  const startButton = element<HTMLButtonElement>('avvio-start');
  const useButton = element<HTMLButtonElement>('avvio-use');
  const retryButton = element<HTMLButtonElement>('avvio-retry');
  const skipButton = element<HTMLButtonElement>('avvio-skip');

  let phase: Phase = 'intro';
  let required = false;
  /** The measurement already on the phone, shown in the intro. */
  let stored: Portata | null = null;
  /** The measurement the last run produced, waiting for «Usa questa portata». */
  let measured: Portata | null = null;
  let audio: AudioInput | null = null;
  let check: Soundcheck | null = null;
  let why = '';
  /** The last thing painted: a frame that changes nothing must not repaint. */
  let painted = '';
  /** Which run of the five notes is the current one: a stale one must not paint. */
  let run = 0;

  function stopAudio(): void {
    const current = audio;
    audio = null;
    current?.stop();
  }

  /** The user left, or started over: whatever was opening is no longer wanted. */
  function cancel(): void {
    run += 1;
    stopAudio();
  }

  function show(button: HTMLButtonElement, visible: boolean): void {
    button.hidden = !visible;
  }

  function begin(): void {
    cancel();
    const token = run;
    phase = 'opening';
    painted = '';
    paint();
    void open(token);
  }

  async function open(token: number): Promise<void> {
    const listener = createListener({
      lowMidi: LOWEST_MIDI,
      highMidi: HIGHEST_MIDI,
      minCredibility: MIN_CREDIBILITY,
    });
    const running = createSoundcheck({ when: new Date() });

    let input: AudioInput;
    try {
      input = await openAudioInput((samples, sampleRate, now) => {
        if (token !== run) return;
        const frame = listener.push(samples, sampleRate, now);
        running.feed(now, { levelDb: frame.levelDb, colpi: frame.colpi });
        const snapshot = running.snapshot();
        if (snapshot.finished) settle(snapshot);
        else paint();
      });
    } catch (error) {
      if (token !== run) return;
      phase = 'problem';
      why =
        error instanceof Error && error.name === 'NotAllowedError'
          ? REFUSED
          : 'Il microfono non si è aperto: riprova.';
      paint();
      return;
    }

    // The microphone was granted after the user had already left the screen.
    if (token !== run) {
      input.stop();
      return;
    }

    audio = input;
    check = running;
    running.start(performance.now());
    phase = 'measuring';
    painted = '';
    paint();
  }

  /** The five notes are done: say what they measured, or what went wrong. */
  function settle(snapshot: SoundcheckSnapshot): void {
    stopAudio();
    const portata = snapshot.portata;
    if (portata !== null) {
      const problem = trialProblem(ports.settings(), portata);
      if (problem === null) {
        measured = portata;
        phase = 'result';
      } else {
        measured = null;
        phase = 'problem';
        why = problem;
      }
    } else {
      measured = null;
      phase = 'problem';
      why = snapshot.silent ? VOLUME : NO_CENTRE;
    }
    paint();
  }

  function paint(): void {
    const snapshot = check?.snapshot() ?? null;
    const signature = `${phase}|${snapshot?.index ?? 0}|${snapshot?.finished ?? false}`;
    if (signature === painted) return;
    painted = signature;

    message.hidden = true;
    step.hidden = false;
    status.hidden = false;

    if (phase === 'intro') {
      lead.textContent =
        stored === null
          ? 'Cinque note per sapere cosa il telefono sente davvero: il tasto più basso del pianoforte, il più alto, di nuovo i due estremi, e il Do centrale. Servono trenta secondi.'
          : "Una misura c'è già. Puoi usarla, oppure rifarla se hai cambiato telefono, stanza o strumento.";
      step.textContent =
        stored === null
          ? 'Quando sei pronto, accendi il microfono e suona le note che ti chiedo.'
          : describePortata(stored);
      status.hidden = true;
      show(startButton, stored === null);
      show(useButton, stored !== null);
      show(retryButton, stored !== null);
      show(skipButton, true);
      skipButton.textContent = required ? 'Continua senza misurare' : 'Salta';
      return;
    }

    if (phase === 'opening' || phase === 'measuring') {
      lead.textContent = 'Ascolto in corso: una nota alla volta.';
      step.textContent =
        snapshot === null || snapshot.probe === null ? OPENING : PROMPTS[snapshot.probe];
      status.textContent = snapshot === null ? '' : `${snapshot.index} di ${PROBES.length}`;
      show(startButton, false);
      show(useButton, false);
      show(retryButton, false);
      show(skipButton, true);
      skipButton.textContent = required ? 'Continua senza misurare' : 'Salta';
      return;
    }

    if (phase === 'result' && measured !== null) {
      const nominal = ports.settings().range;
      const effective = effectiveRange(nominal, measured);
      lead.textContent = 'Misura finita.';
      step.textContent = `Il telefono sente da ${midiToItalian(measured.sente.lowest)} a ${midiToItalian(
        measured.sente.highest,
      )}.`;
      status.textContent =
        effective === null
          ? ''
          : `Con questa prova le note vanno da ${midiToItalian(effective.lowest)} a ${midiToItalian(
              effective.highest,
            )}.`;
      status.hidden = effective === null;
      show(startButton, false);
      show(useButton, true);
      show(retryButton, true);
      show(skipButton, true);
      skipButton.textContent = "Lascia com'era";
      return;
    }

    // problem
    lead.textContent = 'La misura non è riuscita.';
    step.hidden = true;
    status.hidden = true;
    message.textContent = why;
    message.hidden = false;
    show(startButton, false);
    show(useButton, false);
    show(retryButton, true);
    show(skipButton, true);
    skipButton.textContent = required ? 'Continua senza misurare' : 'Salta';
  }

  function enter(options: { readonly keep?: Portata | null; readonly required?: boolean } = {}): void {
    cancel();
    check = null;
    measured = null;
    stored = options.keep ?? null;
    required = options.required ?? false;
    phase = 'intro';
    painted = '';
    paint();
    ports.wizard.show('avvio');
  }

  startButton.addEventListener('click', begin);
  retryButton.addEventListener('click', begin);

  useButton.addEventListener('click', () => {
    cancel();
    // In the intro this is the measurement already on the phone; in the result,
    // the one the five notes just produced.
    const chosen = measured ?? stored;
    if (chosen !== null) ports.save(chosen);
    ports.done();
  });

  skipButton.addEventListener('click', () => {
    cancel();
    ports.done();
  });

  return { enter };
}

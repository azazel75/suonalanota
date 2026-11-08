/**
 * :Project:  suona-la-nota -- the runtime shared by the two probe pages
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * A probe is a measurement, not a product: it listens, waits for an attack, keeps
 * a short window of spectra around it, and writes what it saw. The pages differ
 * only in the `measure` function and in the name that ends up in the JSON, which
 * is how the two files are told apart by whoever reads them.
 */
import { analyseSpectrum, type Detection } from '../audio/detect';
import { amplitudeSpectrum, rms, toDecibels } from '../audio/fft';
import { HIGHEST_MIDI, LOWEST_MIDI, midiToLabel, midiToName, pitchClass, pianoKeys } from '../audio/notes';
import { createOnsetDetector } from '../audio/onset';

const FFT_SIZE = 16_384;
const SHORT_SIZE = 2_048;
const FRAME_MS = 20;
/** The long window is recomputed every other frame: it costs ten times the short one. */
const LONG_EVERY = 2;
/** Short spectra kept around the attack: 3 before, 14 after — about 340 ms. */
const PRE_ROLL = 3;
const SERIES_FRAMES = 14;
const DB_FLOOR = -100;

export interface ProbeInput {
  reference: number;
  sampleRate: number;
  levelDb: number;
  detection: Detection;
  /** Short-window spectra around the attack, oldest first, one every FRAME_MS. */
  series: Float32Array[];
}

export interface ProbeDefinition {
  /** Written into the JSON: it is how the two files are told apart. */
  name: string;
  /** Columns of the table, as [key shown in the row, label]. */
  columns: [string, string][];
  measure(input: ProbeInput): Record<string, unknown>;
}

interface Entry {
  at: number;
  reference: number;
  referenceName: string;
  detected: number;
  detectedName: string;
  verdict: 'giusto' | 'ottava' | 'altro';
  levelDb: number;
  [key: string]: unknown;
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`#${id} is missing from the page`);
  return found as T;
}

function round(value: number, digits = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

export function runProbe(definition: ProbeDefinition): void {
  const status = element<HTMLSpanElement>('status');
  const startButton = element<HTMLButtonElement>('start');
  const stopButton = element<HTMLButtonElement>('stop');
  const referenceSelect = element<HTMLSelectElement>('ref');
  const referenceBig = element<HTMLDivElement>('ref-big');
  const lastReadout = element<HTMLPreElement>('last');
  const rows = element<HTMLTableSectionElement>('rows');
  const downloadButton = element<HTMLButtonElement>('download');
  const hint = element<HTMLParagraphElement>('hint');

  const log: Entry[] = [];
  let reference = 60;
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let stream: MediaStream | null = null;
  let running = false;
  let timeBuffer = new Float32Array(FFT_SIZE);
  let lastFrameMs = 0;
  let frameIndex = 0;
  let latestDetection: Detection | null = null;
  let latestLevelDb = DB_FLOOR;
  let preRoll: Float32Array[] = [];
  let capture: Float32Array[] | null = null;
  const onset = createOnsetDetector();

  for (const midi of pianoKeys()) {
    const option = document.createElement('option');
    option.value = String(midi);
    option.textContent = midiToLabel(midi);
    referenceSelect.append(option);
  }

  function setReference(midi: number): void {
    reference = Math.min(HIGHEST_MIDI, Math.max(LOWEST_MIDI, midi));
    referenceSelect.value = String(reference);
    referenceBig.textContent = `riferimento: ${midiToLabel(reference)}`;
  }

  function verdictOf(expected: number, detected: number): Entry['verdict'] {
    if (detected === expected) return 'giusto';
    if (pitchClass(detected) === pitchClass(expected)) return 'ottava';
    return 'altro';
  }

  function render(): void {
    rows.replaceChildren();
    for (const entry of log.slice(-12).reverse()) {
      const row = document.createElement('tr');
      const name = document.createElement('td');
      name.textContent = `${entry.referenceName} → ${entry.detectedName}`;
      row.append(name);
      for (const [key] of definition.columns) {
        const cell = document.createElement('td');
        cell.className = 'num';
        cell.textContent = String(entry[key] ?? '—');
        row.append(cell);
      }
      rows.append(row);
    }
  }

  function record(input: ProbeInput): void {
    const entry: Entry = {
      at: Math.round(performance.now()),
      reference: input.reference,
      referenceName: midiToName(input.reference),
      detected: input.detection.best.midi,
      detectedName: midiToName(input.detection.best.midi),
      verdict: verdictOf(input.reference, input.detection.best.midi),
      levelDb: round(input.levelDb, 1),
      ...definition.measure(input),
    };
    log.push(entry);
    render();
    lastReadout.textContent = JSON.stringify(entry, null, 1);
  }

  function frame(nowMs: number): void {
    if (!running || analyser === null || context === null) return;
    window.requestAnimationFrame(frame);
    if (nowMs - lastFrameMs < FRAME_MS) return;
    lastFrameMs = nowMs;

    analyser.getFloatTimeDomainData(timeBuffer);
    const level = rms(timeBuffer);
    latestLevelDb = toDecibels(level, DB_FLOOR);

    const short = amplitudeSpectrum(timeBuffer.subarray(FFT_SIZE - SHORT_SIZE));
    preRoll.push(short);
    if (preRoll.length > PRE_ROLL) preRoll.shift();

    if (capture !== null) {
      capture.push(short);
      if (capture.length >= PRE_ROLL + SERIES_FRAMES && latestDetection !== null) {
        const series = capture;
        capture = null;
        record({
          reference,
          sampleRate: context.sampleRate,
          levelDb: latestLevelDb,
          detection: latestDetection,
          series,
        });
      }
    }

    frameIndex += 1;
    if (frameIndex % LONG_EVERY === 0) {
      latestDetection = analyseSpectrum(amplitudeSpectrum(timeBuffer), context.sampleRate, {
        frameRms: rms(timeBuffer),
      });
    }

    // The attack starts a capture: the series is what both probes measure.
    if (onset.push(short, nowMs) && capture === null) {
      capture = [...preRoll];
      status.textContent = 'colpo';
    }
  }

  async function start(): Promise<void> {
    if (running) return;
    if (!window.isSecureContext) {
      status.textContent = 'serve HTTPS';
      hint.textContent = 'Il microfono richiede https:// o localhost.';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
        video: false,
      });
    } catch (error) {
      status.textContent = 'permesso negato';
      hint.textContent = String(error);
      return;
    }

    context = new AudioContext();
    await context.resume();
    analyser = context.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0;

    const source = context.createMediaStreamSource(stream);
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(analyser);
    analyser.connect(mute);
    mute.connect(context.destination);

    timeBuffer = new Float32Array(FFT_SIZE);
    onset.reset();
    running = true;
    startButton.disabled = true;
    stopButton.disabled = false;
    status.textContent = 'in ascolto';
    hint.textContent =
      'Suona la nota di riferimento tre volte, staccando. Ogni colpo produce una riga: ' +
      'alla fine scarica il JSON.';
    window.requestAnimationFrame(frame);
  }

  function stop(): void {
    running = false;
    capture = null;
    startButton.disabled = false;
    stopButton.disabled = true;
    status.textContent = 'spento';
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    analyser = null;
    void context?.close();
    context = null;
  }

  function download(): void {
    const payload = {
      probe: definition.name,
      generatedAt: new Date().toISOString(),
      device: { sampleRate: context?.sampleRate ?? 48000, userAgent: navigator.userAgent },
      settings: { fftSize: FFT_SIZE, shortSize: SHORT_SIZE, frameMs: FRAME_MS, seriesFrames: SERIES_FRAMES },
      colpi: log,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `suona-la-nota-${definition.name}-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  referenceSelect.addEventListener('change', () => setReference(Number(referenceSelect.value)));
  startButton.addEventListener('click', () => void start());
  stopButton.addEventListener('click', stop);
  downloadButton.addEventListener('click', download);

  setReference(reference);
  render();
}

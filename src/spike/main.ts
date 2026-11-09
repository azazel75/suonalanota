/**
 * :Project:  suona-la-nota -- the spike: does a phone hear a piano, and which key
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * This page is a measuring instrument, not a product: it shows what the
 * detector believes, how much it believes it, and what the microphone actually
 * received. The log it downloads is the evidence the spike is judged on.
 *
 * Deliberate shortcuts, allowed here and nowhere else: the FFT runs on the main
 * thread, the buffers are reallocated every frame, and the analysis is throttled
 * to 25 frames per second instead of following the audio clock.
 */
import type { Detection } from '../audio/detect';
import { toDecibels } from '../audio/fft';
import {
  ANALYSIS_INTERVAL_MS,
  DB_FLOOR,
  FFT_SIZE,
  ONSET_WINDOW,
  READ_DELAY_MS,
  createListener,
  type Pressione,
} from '../audio/listener';
import {
  HIGHEST_MIDI,
  LOWEST_MIDI,
  midiToHz,
  midiToLabel,
  midiToName,
  pianoKeys,
  pitchClass,
} from '../audio/notes';

const SPECTRUM_MIN_HZ = 20;
const SPECTRUM_MAX_HZ = 8_000;
const NOISE_FRAMES = 25;

interface NoteRange {
  id: string;
  label: string;
  low: number;
  high: number;
}

/** The ranges the exercise can ask for, plus the whole keyboard to compare. */
const RANGES: NoteRange[] = [
  { id: 'base', label: 'base · Do3 – Do5', low: 48, high: 72 },
  { id: 'avanzato', label: 'avanzato · Si1 – Re6', low: 35, high: 86 },
  { id: 'piano', label: 'tutto il pianoforte · La0 – Do8', low: 21, high: 108 },
];

type Verdict = 'giusto' | 'ottava' | 'altro';

/** One row of the log this page downloads: the pressione, plus the conditions it was read under. */
interface LogEntry {
  at: number;
  reference: number;
  referenceName: string;
  detected: number;
  detectedName: string;
  /** The frequency actually measured near the detected note's fundamental. */
  measuredHz: number;
  detectedHz: number;
  score: number;
  marginDb: number;
  octaveMarginDb: number;
  levelDb: number;
  verdict: Verdict;
  /** The settings in force for this pressione, not the ones at download time. */
  minCredibility: number;
  rangeLow: number;
  rangeHigh: number;
  stability: number;
  fundamentalPresent: boolean;
  /** The pair of amplitudes that decides the octave, so the rule can be calibrated. */
  fundamentalMagnitude: number;
  octaveBelowMagnitude: number;
  /** How much the winner stands out from the median candidate: this is the gate. */
  credibility: number;
  /** The octave was too close to call: this pressione must not be judged. */
  ambiguous: boolean;
  octaveFlipped: boolean;
  top: { midi: number; name: string; score: number }[];
}

interface NoiseReport {
  frames: number;
  medianDb: number;
  peaks: { hz: number; db: number }[];
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`#${id} is missing from the page`);
  return found as T;
}

const statusBadge = element<HTMLSpanElement>('status');
const startButton = element<HTMLButtonElement>('start');
const stopButton = element<HTMLButtonElement>('stop');
const measureButton = element<HTMLButtonElement>('measure');
const notesButton = element<HTMLButtonElement>('noise');
const downloadButton = element<HTMLButtonElement>('download');
const deviceFacts = element<HTMLDivElement>('device');
const noteDisplay = element<HTMLDivElement>('note');
const levelCell = element<HTMLElement>('level');
const marginCell = element<HTMLElement>('margin');
const octaveCell = element<HTMLElement>('octave');
const onsetsCell = element<HTMLElement>('onsets');
const flashLine = element<HTMLDivElement>('flash');
const refBig = element<HTMLDivElement>('ref-big');
const spectrumCanvas = element<HTMLCanvasElement>('spectrum');
const candidatesBody = element<HTMLTableSectionElement>('candidates');
const referenceSelect = element<HTMLSelectElement>('ref');
const rangeSelect = element<HTMLSelectElement>('range-notes');
const referenceDetail = element<HTMLParagraphElement>('ref-detail');
const referenceDown = element<HTMLButtonElement>('ref-down');
const referenceUp = element<HTMLButtonElement>('ref-up');
const gateInput = element<HTMLInputElement>('gate');
const gateLabel = element<HTMLSpanElement>('gate-label');
const countersFacts = element<HTMLDivElement>('counters');
const referenceTable = element<HTMLTableSectionElement>('ref-table');
const noiseOutput = element<HTMLParagraphElement>('noise-out');

const log: LogEntry[] = [];

let reference = 60;
let activeRange: NoteRange = RANGES[1];
const listener = createListener({
  lowMidi: activeRange.low,
  highMidi: activeRange.high,
  minCredibility: Number(gateInput.value),
});
let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let stream: MediaStream | null = null;
let running = false;
let lastAnalysisMs = 0;
let timeBuffer = new Float32Array(FFT_SIZE);
let noiseFrames: Float32Array[] = [];
let noiseTarget = 0;
let noiseReport: NoiseReport | null = null;
let deviceInfo: Record<string, unknown> = {};

function round(value: number, digits = 1): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function verdictOf(expected: number, detected: number): Verdict {
  if (detected === expected) return 'giusto';
  if (pitchClass(detected) === pitchClass(expected)) return 'ottava';
  return 'altro';
}

function fillReferenceSelect(): void {
  referenceSelect.replaceChildren();
  let octaveSeen = Number.NaN;
  let group: HTMLOptGroupElement | null = null;

  for (const midi of pianoKeys()) {
    const octave = Math.floor(midi / 12) - 1;
    if (octave !== octaveSeen) {
      octaveSeen = octave;
      group = document.createElement('optgroup');
      group.label = `ottava ${octave}`;
      referenceSelect.append(group);
    }
    const option = document.createElement('option');
    option.value = String(midi);
    option.textContent = midiToLabel(midi);
    group?.append(option);
  }
  referenceSelect.value = String(reference);
}

function setStatus(text: string, on: boolean): void {
  statusBadge.textContent = text;
  statusBadge.className = on ? 'badge on' : 'badge off';
}

function setDeviceFacts(entries: [string, string][]): void {
  deviceFacts.replaceChildren();
  for (const [name, value] of entries) {
    const label = document.createElement('span');
    label.textContent = name;
    const cell = document.createElement('b');
    cell.textContent = value;
    deviceFacts.append(label, cell);
  }
}

function drawSpectrum(magnitudes: Float32Array, sampleRate: number): void {
  const ratio = window.devicePixelRatio || 1;
  const cssWidth = Math.max(240, spectrumCanvas.clientWidth);
  const cssHeight = Math.max(120, spectrumCanvas.clientHeight);
  const width = Math.round(cssWidth * ratio);
  const height = Math.round(cssHeight * ratio);

  if (spectrumCanvas.width !== width || spectrumCanvas.height !== height) {
    spectrumCanvas.width = width;
    spectrumCanvas.height = height;
  }

  const paint = spectrumCanvas.getContext('2d');
  if (paint === null) return;

  paint.fillStyle = '#070b10';
  paint.fillRect(0, 0, width, height);

  const lowLog = Math.log(SPECTRUM_MIN_HZ);
  const highLog = Math.log(SPECTRUM_MAX_HZ);
  const span = highLog - lowLog;
  const xOf = (hz: number): number => ((Math.log(hz) - lowLog) / span) * width;
  const yOf = (db: number): number =>
    height - (Math.max(DB_FLOOR, Math.min(0, db)) - DB_FLOOR) / -DB_FLOOR * height;

  paint.strokeStyle = '#16202b';
  paint.fillStyle = '#4b6178';
  paint.font = `${11 * ratio}px system-ui, sans-serif`;
  paint.lineWidth = ratio;
  for (const hz of [32, 63, 125, 250, 500, 1000, 2000, 4000, 8000]) {
    const x = xOf(hz);
    paint.beginPath();
    paint.moveTo(x, 0);
    paint.lineTo(x, height);
    paint.stroke();
    paint.fillText(hz >= 1000 ? `${hz / 1000}k` : String(hz), x + 3 * ratio, height - 4 * ratio);
  }

  const binHz = sampleRate / (magnitudes.length * 2);
  const bars = new Path2D();
  for (let x = 0; x < width; x++) {
    const fromHz = Math.exp(lowLog + (x / width) * span);
    const toHz = Math.exp(lowLog + ((x + 1) / width) * span);
    const fromBin = Math.max(1, Math.floor(fromHz / binHz));
    const toBin = Math.min(magnitudes.length - 1, Math.ceil(toHz / binHz));

    let peak = 0;
    for (let bin = fromBin; bin <= toBin; bin++) {
      if (magnitudes[bin] > peak) peak = magnitudes[bin];
    }
    if (peak <= 0) continue;

    const y = yOf(toDecibels(peak, DB_FLOOR));
    bars.rect(x, y, 1, height - y);
  }
  paint.fillStyle = '#2e7dd1';
  paint.fill(bars);

  const fundamental = midiToHz(reference);
  paint.strokeStyle = 'rgba(61, 220, 132, 0.75)';
  paint.fillStyle = 'rgba(61, 220, 132, 0.9)';
  for (let k = 1; k <= 8; k++) {
    const hz = fundamental * k;
    if (hz > SPECTRUM_MAX_HZ) break;
    const x = xOf(hz);
    paint.beginPath();
    paint.moveTo(x, 0);
    paint.lineTo(x, height);
    paint.stroke();
    paint.fillText(`${k}`, x + 2 * ratio, 13 * ratio);
  }
}

function showDetection(detection: Detection, levelDb: number): void {
  const best = detection.best;
  noteDisplay.textContent = midiToLabel(best.midi);
  const midiTag = document.createElement('small');
  const measured = detection.measuredHz > 0
    ? `${round(detection.measuredHz, 1)} Hz misurati`
    : 'fondamentale non ricevuta';
  midiTag.textContent = ` · MIDI ${best.midi} · ${measured}${detection.octaveFlipped ? ' · ottava corretta' : ''}`;
  noteDisplay.append(midiTag);

  levelCell.textContent = `${round(levelDb, 1)} dBFS`;
  marginCell.textContent = `${round(detection.marginDb, 1)} dB`;
  octaveCell.textContent = `${round(detection.octaveMarginDb, 1)} dB`;

  candidatesBody.replaceChildren();
  for (const candidate of detection.candidates.slice(0, 5)) {
    const row = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = midiToLabel(candidate.midi);
    const score = document.createElement('td');
    score.className = 'num';
    score.textContent = candidate.score.toFixed(4);
    const delta = document.createElement('td');
    delta.className = 'num';
    const db = candidate.score > 0 ? 20 * Math.log10(candidate.score / best.score) : -99;
    delta.textContent = `${db.toFixed(1)}`;
    row.append(name, score, delta);
    candidatesBody.append(row);
  }
}

function flashVerdict(entry: LogEntry): void {
  // An ambiguous pressione is not a mistake by the player and must not cost an
  // attempt: the exercise asks to play it again.
  if (entry.ambiguous) {
    flashLine.className = 'warn';
    flashLine.textContent =
      `ambiguo (l'ottava non è distinguibile): chiedi di ripetere — ` +
      `atteso ${entry.referenceName}, sentito ${entry.detectedName}`;
    return;
  }

  const colours: Record<Verdict, string> = {
    giusto: 'good',
    ottava: 'warn',
    altro: 'bad',
  };
  const words: Record<Verdict, string> = {
    giusto: 'giusto',
    ottava: 'ottava sbagliata',
    altro: 'altra nota',
  };
  flashLine.className = colours[entry.verdict];
  flashLine.textContent =
    `${words[entry.verdict]}: atteso ${entry.referenceName}, sentito ${entry.detectedName}` +
    ` (margine ${entry.marginDb} dB, ottava ${entry.octaveMarginDb} dB)`;

  noteDisplay.className = entry.verdict === 'giusto' ? 'good' : 'bad';
  window.setTimeout(() => {
    noteDisplay.className = '';
  }, 400);
}

function renderCounters(): void {
  const totals = { pressioni: log.length, giusto: 0, ottava: 0, altro: 0 };
  const ambiguous = log.filter((entry) => entry.ambiguous).length;
  const perReference = new Map<number, { pressioni: number; giusto: number; ottava: number; altro: number }>();

  for (const entry of log) {
    totals[entry.verdict] += 1;
    const bucket = perReference.get(entry.reference) ??
      { pressioni: 0, giusto: 0, ottava: 0, altro: 0 };
    bucket.pressioni += 1;
    bucket[entry.verdict] += 1;
    perReference.set(entry.reference, bucket);
  }

  countersFacts.replaceChildren();
  const facts: [string, string][] = [
    ['pressioni', String(totals.pressioni)],
    ['giusti', String(totals.giusto)],
    ['ottave sbagliate', String(totals.ottava)],
    ['altre note', String(totals.altro)],
  ];
  if (totals.pressioni > 0) {
    const right = (100 * totals.giusto) / totals.pressioni;
    facts.push(['precisione', `${round(right, 1)} %`]);
  }
  facts.push(['ambigui (da ripetere)', String(ambiguous)]);
  for (const [name, value] of facts) {
    const label = document.createElement('span');
    label.textContent = name;
    const cell = document.createElement('b');
    cell.textContent = value;
    countersFacts.append(label, cell);
  }

  referenceTable.replaceChildren();
  for (const midi of [...perReference.keys()].sort((left, right) => left - right)) {
    const bucket = perReference.get(midi);
    if (bucket === undefined) continue;
    const row = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = midiToLabel(midi);
    row.append(name);
    for (const value of [bucket.pressioni, bucket.giusto, bucket.ottava, bucket.altro]) {
      const cell = document.createElement('td');
      cell.className = 'num';
      cell.textContent = String(value);
      row.append(cell);
    }
    referenceTable.append(row);
  }
}

function record(pressione: Pressione): void {
  const detection = pressione.detection;
  const entry: LogEntry = {
    at: Math.round(pressione.at),
    reference,
    referenceName: midiToName(reference),
    detected: pressione.midi,
    detectedName: midiToName(pressione.midi),
    measuredHz: round(detection.measuredHz, 2),
    detectedHz: round(pressione.hz, 2),
    score: round(detection.best.score, 5),
    marginDb: round(detection.marginDb, 1),
    octaveMarginDb: round(detection.octaveMarginDb, 1),
    levelDb: round(pressione.levelDb, 1),
    verdict: verdictOf(reference, pressione.midi),
    // The settings in force for this pressione, not the ones at download time.
    minCredibility: listener.minCredibility,
    rangeLow: listener.range.low,
    rangeHigh: listener.range.high,
    stability: pressione.stability,
    fundamentalPresent: detection.fundamentalPresent,
    fundamentalMagnitude: round(detection.fundamentalMagnitude, 5),
    octaveBelowMagnitude: round(detection.octaveBelowMagnitude, 5),
    credibility: round(pressione.credibility, 2),
    ambiguous: pressione.ambiguous,
    octaveFlipped: detection.octaveFlipped,
    top: detection.candidates.slice(0, 5).map((candidate) => ({
      midi: candidate.midi,
      name: midiToName(candidate.midi),
      score: round(candidate.score, 5),
    })),
  };
  log.push(entry);
  renderCounters();
  flashVerdict(entry);
}

function collectNoise(magnitudes: Float32Array, sampleRate: number): void {
  if (noiseTarget <= 0) return;
  noiseFrames.push(Float32Array.from(magnitudes));
  noiseTarget -= 1;
  if (noiseTarget > 0) return;

  const length = noiseFrames[0]?.length ?? 0;
  const mean = new Float64Array(length);
  for (const frame of noiseFrames) {
    for (let bin = 0; bin < length; bin++) mean[bin] += frame[bin] / noiseFrames.length;
  }
  noiseFrames = [];

  const levels: number[] = [];
  for (let bin = 1; bin < length; bin++) levels.push(toDecibels(mean[bin], DB_FLOOR));
  levels.sort((left, right) => left - right);
  const medianDb = levels[levels.length >> 1] ?? DB_FLOOR;

  const peaks: { hz: number; db: number }[] = [];
  for (let bin = 2; bin < length - 1; bin++) {
    if (mean[bin] > mean[bin - 1] && mean[bin] > mean[bin + 1]) {
      peaks.push({ hz: bin * (sampleRate / (length * 2)), db: toDecibels(mean[bin], DB_FLOOR) });
    }
  }
  peaks.sort((left, right) => right.db - left.db);

  // The room's own noise, for the record: how quiet the room was is part of the
  // measurement, and a peak at 100 Hz is the mains hum of a whole country.
  noiseReport = {
    frames: NOISE_FRAMES,
    medianDb: round(medianDb, 1),
    peaks: peaks.slice(0, 5).map((peak) => ({ hz: round(peak.hz, 0), db: round(peak.db, 1) })),
  };

  noiseOutput.className = '';
  noiseOutput.textContent =
    `rumore mediano ${noiseReport.medianDb} dB · picchi: ` +
    noiseReport.peaks.map((peak) => `${peak.hz} Hz ${peak.db} dB`).join(', ');
}

function analyse(nowMs: number): void {
  if (analyser === null || context === null) return;

  analyser.getFloatTimeDomainData(timeBuffer);
  const frame = listener.push(timeBuffer, context.sampleRate, nowMs);

  drawSpectrum(frame.spectrum, context.sampleRate);
  showDetection(frame.detection, frame.levelDb);
  collectNoise(frame.spectrum, context.sampleRate);

  onsetsCell.textContent = frame.struck
    ? 'attacco'
    : `flusso ${frame.flux.toFixed(3)} / soglia ${Number.isFinite(frame.threshold) ? frame.threshold.toFixed(3) : '—'}` +
      ` · ${frame.armed ? 'armato' : 'in attesa che il suono scenda'}` +
      (frame.reading ? ' · lettura fra poco' : '');

  for (const pressione of frame.pressioni) record(pressione);
}

function loop(nowMs: number): void {
  if (!running) return;
  window.requestAnimationFrame(loop);
  if (nowMs - lastAnalysisMs < ANALYSIS_INTERVAL_MS) return;
  lastAnalysisMs = nowMs;
  analyse(nowMs);
}

async function start(): Promise<void> {
  if (running) return;

  if (!window.isSecureContext) {
    setStatus('serve HTTPS', false);
    flashLine.className = 'bad';
    flashLine.textContent =
      'Questa pagina non è in un contesto sicuro: il browser non concede il microfono su http, ' +
      'a parte localhost. Usa https:// o apri la pagina dal telefono tramite il server TLS.';
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('nessun accesso al microfono', false);
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
    setStatus('permesso negato', false);
    flashLine.className = 'bad';
    flashLine.textContent = `Il microfono non è partito: ${String(error)}`;
    return;
  }

  context = new AudioContext();
  await context.resume();

  const analyserNode = context.createAnalyser();
  analyserNode.fftSize = FFT_SIZE;
  analyserNode.smoothingTimeConstant = 0;

  const source = context.createMediaStreamSource(stream);
  const mute = context.createGain();
  mute.gain.value = 0;
  source.connect(analyserNode);
  analyserNode.connect(mute);
  mute.connect(context.destination);
  analyser = analyserNode;

  timeBuffer = new Float32Array(analyserNode.fftSize);
  listener.resetOnset();
  running = true;
  startButton.disabled = true;
  stopButton.disabled = false;
  measureButton.disabled = false;
  setStatus('microfono acceso', true);

  if (noiseReport === null) {
    flashLine.className = 'warn';
    flashLine.textContent =
      'In silenzio, prima di suonare, premi «Misura il rumore della stanza»: dice quanto è ' +
      'silenziosa (e se c’è ronzio di rete). Una pressione conta solo se la nota vince almeno ' +
      `${listener.minCredibility.toFixed(1)} volte sulla mediana di tutti i candidati.`;
  }

  const track = stream.getAudioTracks()[0];
  const settings = (track?.getSettings() ?? {}) as Record<string, unknown>;
  let label = track?.label ?? 'sconosciuto';
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const input = devices.find((device) => device.deviceId === settings['deviceId']);
    if (input?.label) label = input.label;
  } catch {
    // the label is a nicety, the rest of the page does not depend on it
  }

  deviceInfo = {
    label,
    sampleRate: context.sampleRate,
    fftSize: FFT_SIZE,
    binHz: round(context.sampleRate / FFT_SIZE, 2),
    windowMs: round((FFT_SIZE / context.sampleRate) * 1000, 0),
    settings,
    secureContext: window.isSecureContext,
    userAgent: navigator.userAgent,
  };

  const settingsFacts: [string, string][] = [
    ['microfono', label],
    ['campionamento', `${context.sampleRate} Hz`],
    ['finestra', `${FFT_SIZE} campioni · ${round((FFT_SIZE / context.sampleRate) * 1000, 0)} ms`],
    ['risoluzione', `${round(context.sampleRate / FFT_SIZE, 2)} Hz per bin`],
    [
      'soppressione',
      settings['echoCancellation'] === true
        ? 'echoCancellation ATTIVO (danneggia la misura)'
        : 'echo/soglia/guadagno spenti, come richiesto',
    ],
    ['chiavi', `${midiToName(LOWEST_MIDI)} – ${midiToName(HIGHEST_MIDI)}`],
  ];
  setDeviceFacts(settingsFacts);

  lastAnalysisMs = 0;
  window.requestAnimationFrame(loop);
}

function stop(): void {
  running = false;
  listener.clearPending();
  startButton.disabled = false;
  stopButton.disabled = true;
  measureButton.disabled = true;
  setStatus('spento', false);

  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  analyser = null;
  void context?.close();
  context = null;
}

function download(): void {
  const payload = {
    generatedAt: new Date().toISOString(),
    device: deviceInfo,
    reference,
    minCredibility: listener.minCredibility,
    detector: {
      fftSize: FFT_SIZE,
      onsetWindow: ONSET_WINDOW,
      readDelayMs: READ_DELAY_MS,
      octaveEvidence: true,
      partialTolerance: 0.02,
      harmonics: 8,
    },
    // The archived measurement logs in the repository carry this key: renaming
    // it would break joining a new round with rounds 1–5.
    colpi: log,
    noise: noiseReport,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `suona-la-nota-spike-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

startButton.addEventListener('click', () => {
  void start();
});
stopButton.addEventListener('click', stop);
downloadButton.addEventListener('click', download);

measureButton.addEventListener('click', () => {
  const pressione = listener.capture(performance.now());
  if (pressione !== null) record(pressione);
});

notesButton.addEventListener('click', () => {
  if (!running) return;
  noiseFrames = [];
  noiseTarget = NOISE_FRAMES;
  noiseOutput.className = 'hint';
  noiseOutput.textContent = 'misuro un secondo in silenzio…';
});

function fillRangeSelect(): void {
  rangeSelect.replaceChildren();
  for (const range of RANGES) {
    const option = document.createElement('option');
    option.value = range.id;
    option.textContent = range.label;
    rangeSelect.append(option);
  }
  rangeSelect.value = activeRange.id;
}

function setReference(midi: number): void {
  const changed = Math.min(HIGHEST_MIDI, Math.max(LOWEST_MIDI, midi)) !== reference;
  reference = Math.min(HIGHEST_MIDI, Math.max(LOWEST_MIDI, midi));
  referenceSelect.value = String(reference);
  referenceDetail.textContent =
    `${midiToLabel(reference)} · MIDI ${reference} · ${midiToHz(reference).toFixed(1)} Hz`;

  // The change has to be visible where the eye is: the big readout is what one
  // watches while playing, and a reference that did not move is a whole set of
  // pressioni scored against the wrong note (measured: three D4 under a D#4
  // reference, eleven seconds apart).
  refBig.textContent = `riferimento: ${midiToLabel(reference)}`;
  if (changed) {
    refBig.className = 'ref changed';
    window.setTimeout(() => {
      refBig.className = 'ref';
    }, 600);
  }

  // The log is never cleared: every pressione carries its own reference, and the
  // table below groups them by it. Testing ten notes in a row is the point.
  flashLine.textContent = '';
}

referenceSelect.addEventListener('change', () => setReference(Number(referenceSelect.value)));
referenceDown.addEventListener('click', () => setReference(reference - 1));
referenceUp.addEventListener('click', () => setReference(reference + 1));

rangeSelect.addEventListener('change', () => {
  const chosen = RANGES.find((range) => range.id === rangeSelect.value);
  if (chosen === undefined) return;
  activeRange = chosen;
  listener.setRange(chosen.low, chosen.high);
  // A reference outside the range would make every verdict "altra nota".
  setReference(Math.min(chosen.high, Math.max(chosen.low, reference)));
});

gateInput.addEventListener('input', () => {
  listener.setMinCredibility(Number(gateInput.value));
  gateLabel.textContent = listener.minCredibility.toFixed(1);
});

fillReferenceSelect();
fillRangeSelect();
setReference(reference);
renderCounters();
gateLabel.textContent = listener.minCredibility.toFixed(1);
setDeviceFacts([['stato', 'microfono spento: premi “Attiva il microfono”']]);

// `?autostart=1` exists for the headless check: it lets chromium drive the whole
// audio path with a fake capture device, where no hand can press the button.
if (new URLSearchParams(window.location.search).has('autostart')) {
  void start();
}


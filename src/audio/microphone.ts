/**
 * :Project:  suona-la-nota -- the device's ear
 * :Created:  dom 08 nov 2026 23:00:00 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * Permission, the audio context, the analyser and the loop that takes one
 * buffer 25 times a second: everything the application needs from the browser
 * to listen, and nothing about what it hears. The listener in ../audio turns
 * the buffers into colpi.
 *
 * The window is the one the pitch needs (16384 samples, 341 ms at 48 kHz), and
 * the processing the browser would add by default — echo cancellation, noise
 * suppression, automatic gain — is asked off: they are tuned for speech, and a
 * piano is not speech.
 *
 * The tone of the feedback comes from the same context, so the page has one
 * audio device and one place to close.
 */
import { ANALYSIS_INTERVAL_MS, FFT_SIZE } from './listener';
import { createSpeaker, type Speaker } from './speaker';

/** One buffer of the microphone, and when it was taken. */
export type FrameHandler = (samples: Float32Array, sampleRate: number, nowMs: number) => void;

export interface AudioInput extends Speaker {
  /** The rate the device actually runs at: 44100 or 48000, never assumed. */
  readonly sampleRate: number;
  /** Stop listening and release the microphone. */
  stop(): void;
}

export interface AudioInputOptions {
  /** How often a frame is taken; rAF is faster than this and is throttled. */
  intervalMs?: number;
  /** Samples per analysis window: the pitch needs 16384 at 48 kHz. */
  windowSize?: number;
}

/**
 * Ask for the microphone and start feeding frames.
 *
 * Must be called from a user gesture: the browser grants the microphone only
 * then, and the audio context only starts running after one.
 */
export async function openAudioInput(
  onFrame: FrameHandler,
  options: AudioInputOptions = {},
): Promise<AudioInput> {
  const intervalMs = options.intervalMs ?? ANALYSIS_INTERVAL_MS;
  const windowSize = options.windowSize ?? FFT_SIZE;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  const context = new AudioContext();
  // A context created inside a gesture starts running; one resumed later does not.
  if (context.state === 'suspended') await context.resume();

  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = windowSize;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);

  const buffer = new Float32Array(windowSize);
  const speaker = createSpeaker(context);
  let lastFrameAt = -Infinity;
  let handle: number | null = null;

  function loop(now: number): void {
    handle = requestAnimationFrame(loop);
    if (now - lastFrameAt < intervalMs) return;
    lastFrameAt = now;
    // The analyser keeps the most recent window: no history to keep here.
    analyser.getFloatTimeDomainData(buffer);
    onFrame(buffer, context.sampleRate, now);
  }

  handle = requestAnimationFrame(loop);

  return {
    beep: () => speaker.beep(),
    get sampleRate() {
      return context.sampleRate;
    },
    stop(): void {
      if (handle !== null) cancelAnimationFrame(handle);
      handle = null;
      for (const track of stream.getTracks()) track.stop();
      source.disconnect();
      void context.close();
    },
  };
}

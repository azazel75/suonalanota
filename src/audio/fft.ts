/**
 * :Project:  suona-la-nota -- a small FFT, to read the spectrum of the room
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * Radix-2 in place, no dependency: the same module has to run in a browser, in
 * an AudioWorklet and in node under vitest, and a numpy port would not. The
 * output is the amplitude of each sinusoid, not a bin magnitude, so that a
 * partial of amplitude A reads back as A.
 */

/** Periodic Hann window. Periodic, not symmetric: it is meant for the FFT. */
export function hannWindow(length: number): Float64Array {
  const window = new Float64Array(length);
  for (let index = 0; index < length; index++) {
    window[index] = 0.5 * (1 - Math.cos((2 * Math.PI * index) / length));
  }
  return window;
}

/** In-place iterative Cooley-Tukey FFT. Both arrays must be the same power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const length = re.length;
  if (length !== im.length) throw new Error('re and im must have the same length');
  if ((length & (length - 1)) !== 0) throw new Error('the length must be a power of two');

  for (let i = 1, j = 0; i < length; i++) {
    let bit = length >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const reTmp = re[i];
      re[i] = re[j];
      re[j] = reTmp;
      const imTmp = im[i];
      im[i] = im[j];
      im[j] = imTmp;
    }
  }

  for (let size = 2; size <= length; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    const stepRe = Math.cos(angle);
    const stepIm = Math.sin(angle);
    const half = size >> 1;
    for (let start = 0; start < length; start += size) {
      let cosRe = 1;
      let cosIm = 0;
      for (let k = 0; k < half; k++) {
        const evenRe = re[start + k];
        const evenIm = im[start + k];
        const oddRe = re[start + k + half] * cosRe - im[start + k + half] * cosIm;
        const oddIm = re[start + k + half] * cosIm + im[start + k + half] * cosRe;
        re[start + k] = evenRe + oddRe;
        im[start + k] = evenIm + oddIm;
        re[start + k + half] = evenRe - oddRe;
        im[start + k + half] = evenIm - oddIm;
        const nextRe = cosRe * stepRe - cosIm * stepIm;
        cosIm = cosRe * stepIm + cosIm * stepRe;
        cosRe = nextRe;
      }
    }
  }
}

/**
 * Amplitude spectrum of a real signal, Hann windowed and mean removed.
 *
 * Returns `length / 2` values: index `k` covers `k * sampleRate / length` Hz.
 */
export function amplitudeSpectrum(samples: Float32Array | Float64Array): Float32Array {
  const length = samples.length;
  if ((length & (length - 1)) !== 0) throw new Error('the length must be a power of two');

  const re = new Float64Array(length);
  const im = new Float64Array(length);
  const window = hannWindow(length);

  let mean = 0;
  for (let i = 0; i < length; i++) mean += samples[i];
  mean /= length;

  let windowSum = 0;
  for (let i = 0; i < length; i++) {
    re[i] = (samples[i] - mean) * window[i];
    windowSum += window[i];
  }

  fft(re, im);

  const half = length >> 1;
  const magnitudes = new Float32Array(half);
  const scale = 2 / windowSum;
  for (let k = 1; k < half; k++) magnitudes[k] = Math.hypot(re[k], im[k]) * scale;
  return magnitudes;
}

/** Root mean square of a signal, as a plain amplitude (0..1 for full scale). */
export function rms(samples: Float32Array | Float64Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/** Amplitude to dBFS, with a floor so that silence is a number and not -Infinity. */
export function toDecibels(amplitude: number, floor = -120): number {
  if (amplitude <= 0) return floor;
  return Math.max(floor, 20 * Math.log10(amplitude));
}

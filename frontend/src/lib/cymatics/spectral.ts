export type SpectralWindow = 'hann' | 'hamming' | 'rectangular';

export interface SpectrumFrame {
  sampleRateHz: number;
  fftSize: number;
  binWidthHz: number;
  magnitudesDbfs: Float32Array;
  peakFrequencyHz: number | null;
  peakDbfs: number | null;
}

const isPowerOfTwo = (value: number) => value > 1 && (value & (value - 1)) === 0;

export function windowCoefficient(type: SpectralWindow, index: number, size: number): number {
  if (type === 'rectangular') return 1;
  if (size <= 1) return 1;
  const phase = 2 * Math.PI * index / (size - 1);
  return type === 'hann' ? .5 * (1 - Math.cos(phase)) : .54 - .46 * Math.cos(phase);
}

/** In-place radix-2 FFT. The input must contain finite real samples. */
export function fftReal(samples: Float32Array, window: SpectralWindow = 'hann') {
  const size = samples.length;
  if (!isPowerOfTwo(size)) throw new Error('FFT size must be a power of two.');
  const real = new Float64Array(size), imaginary = new Float64Array(size);
  for (let index = 0; index < size; index++) {
    const sample = samples[index];
    if (!Number.isFinite(sample)) throw new Error('FFT samples must be finite.');
    real[index] = sample * windowCoefficient(window, index, size);
  }
  for (let index = 1, reversed = 0; index < size; index++) {
    let bit = size >> 1;
    for (; reversed & bit; bit >>= 1) reversed ^= bit;
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed], real[index]];
      [imaginary[index], imaginary[reversed]] = [imaginary[reversed], imaginary[index]];
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = -2 * Math.PI / length;
    for (let offset = 0; offset < size; offset += length) {
      for (let index = 0; index < length / 2; index++) {
        const cosine = Math.cos(angle * index), sine = Math.sin(angle * index), even = offset + index, odd = even + length / 2;
        const oddReal = real[odd] * cosine - imaginary[odd] * sine;
        const oddImaginary = real[odd] * sine + imaginary[odd] * cosine;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
      }
    }
  }
  return { real, imaginary };
}

export function analyzeSpectrum(samples: Float32Array, sampleRateHz: number, window: SpectralWindow = 'hann'): SpectrumFrame {
  if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0) throw new Error('Sample rate must be positive.');
  const { real, imaginary } = fftReal(samples, window), size = samples.length, bins = size / 2 + 1;
  let coefficientSum = 0;
  for (let index = 0; index < size; index++) coefficientSum += windowCoefficient(window, index, size);
  const magnitudesDbfs = new Float32Array(bins);
  let peakIndex = 0, peakDbfs = -Infinity;
  for (let index = 0; index < bins; index++) {
    const edgeScale = index === 0 || index === size / 2 ? 1 : 2;
    const amplitude = edgeScale * Math.hypot(real[index], imaginary[index]) / coefficientSum;
    const dbfs = Math.max(-120, 20 * Math.log10(Math.max(amplitude, 1e-6)));
    magnitudesDbfs[index] = dbfs;
    if (index > 0 && dbfs > peakDbfs) { peakDbfs = dbfs; peakIndex = index; }
  }
  const audiblePeak = peakDbfs > -100;
  return { sampleRateHz, fftSize: size, binWidthHz: sampleRateHz / size, magnitudesDbfs, peakFrequencyHz: audiblePeak ? peakIndex * sampleRateHz / size : null, peakDbfs: audiblePeak ? peakDbfs : null };
}

export function appendSpectrogramFrame(history: readonly Float32Array[], frame: SpectrumFrame, maxFrames = 120): Float32Array[] {
  if (!Number.isInteger(maxFrames) || maxFrames < 1) throw new Error('Spectrogram history limit must be a positive integer.');
  const next = [...history, new Float32Array(frame.magnitudesDbfs)];
  return next.length > maxFrames ? next.slice(next.length - maxFrames) : next;
}

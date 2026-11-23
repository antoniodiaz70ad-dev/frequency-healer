import { compositionMix, validateComposition, type ComposerRecipe } from './composer';
import { AUDIO_MIN_HZ, AUDIO_MAX_HZ, computeModalField } from '../cymatics/physics';
import type { CymaticsConfigV1, ModalField } from '../cymatics/types';

export type ComposerChannel = 'left' | 'right';
export type SpectralComponent = { hz: number; real: number; imaginary: number };

/** Cosine phasors of the actual sine-oscillator mixer, before master volume/fades.
 * A pulse is amplitude modulation: (1-d/2)sin(fc*t) + d/4 cos((fc-fm)t) - d/4 cos((fc+fm)t).
 * Equal frequencies combine coherently; the binaural difference is never an extra tone.
 */
export function composerSpectrum(recipe: ComposerRecipe, channel: ComposerChannel): SpectralComponent[] {
  validateComposition(recipe);
  const components = new Map<number, SpectralComponent>();
  const add = (hz: number, real: number, imaginary: number) => {
    const frequency = Math.abs(hz), previous = components.get(frequency) ?? { hz: frequency, real: 0, imaginary: 0 };
    previous.real += real;
    previous.imaginary += hz < 0 ? -imaginary : imaginary;
    components.set(frequency, previous);
  };
  for (const layer of compositionMix(recipe)) {
    if (layer.mode === 'pulse') {
      add(layer.carrierHz, 0, -layer.gain * (1 - layer.depth / 2));
      add(layer.carrierHz - layer.rateHz, layer.gain * layer.depth / 4, 0);
      add(layer.carrierHz + layer.rateHz, -layer.gain * layer.depth / 4, 0);
    } else {
      add(layer.carrierHz + (layer.mode === 'binaural' && channel === 'right' ? layer.rateHz : 0), 0, -layer.gain);
    }
  }
  return [...components.values()].filter(value => Math.hypot(value.real, value.imaginary) > 0).sort((a, b) => a.hz - b.hz);
}

export type ComposerCymaticsResult = {
  components: SpectralComponent[]; field: ModalField | null; notices: string[];
};

/** Long-time RMS of a linear surface, not an instantaneous multifrequency phasor.
 * Each distinct frequency contributes |H(f)F(f)|²/2. This intentionally averages
 * beats/slow envelopes. Never pass the returned field to vibration/phase renderers.
 */
export function computeComposerCymatics(recipe: ComposerRecipe, channel: ComposerChannel, config: CymaticsConfigV1, size = 48): ComposerCymaticsResult {
  const components = composerSpectrum(recipe, channel);
  if (!components.length) return { components, field: null, notices: ['Activa una capa con nivel mayor que cero para ver su respuesta.'] };
  const unsupported = components.filter(value => value.hz < AUDIO_MIN_HZ || value.hz > AUDIO_MAX_HZ);
  if (unsupported.length) return { components, field: null, notices: [`La mezcla contiene componentes fuera del modelo de 0.1–2000 Hz (${unsupported.map(value => Number(value.hz.toFixed(6))).join(', ')} Hz). Puedes escucharla, pero esta vista no la simula parcialmente.`] };
  const energy = new Float64Array(size * size);
  const fields = components.map(component => {
    const field = computeModalField(config, component.hz, size);
    const weight = (component.real ** 2 + component.imaginary ** 2) / 2;
    for (let i = 0; i < energy.length; i++) energy[i] += field.values[i] ** 2 * weight;
    return field;
  });
  const values = Float32Array.from(energy, value => Math.sqrt(value));
  let maxAmplitude = 0, sum = 0, samples = 0;
  for (let i = 0; i < values.length; i++) {
    if (config.surfaceType === 'circular-membrane' && Math.hypot(2 * ((i % size + .5) / size) - 1, 2 * ((Math.floor(i / size) + .5) / size) - 1) > 1) continue;
    maxAmplitude = Math.max(maxAmplitude, values[i]); sum += values[i] ** 2; samples++;
  }
  const outside = fields.some(field => field.status === 'outside-modeled-range');
  const notices = outside ? ['Algún componente queda fuera de la cobertura de los modos calculados; interpreta la figura con cautela.'] : [];
  if (fields.every(field => field.status === 'weak')) notices.push('Estas frecuencias no están cerca de una resonancia fuerte de esta placa.');
  return { components, notices, field: {
    ...fields[0], values, maxAmplitude, rmsAmplitude: Math.sqrt(sum / Math.max(1, samples)),
    // No single complex phase describes a long-time RMS mixture.
    realValues: new Float32Array(values.length), imaginaryValues: new Float32Array(values.length),
    status: outside ? 'outside-modeled-range' : components.length > 1 ? 'mixed' : fields[0].status,
  } };
}

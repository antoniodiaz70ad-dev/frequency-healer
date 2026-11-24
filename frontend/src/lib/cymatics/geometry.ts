import { COMPOSER_VERSION, type ComposerRecipe } from '../marina/composer';

export const GEOMETRY_VERSION = 'geometry-intention-1' as const;
export const INTERVALS = [
  { id: 'unison', name: 'Unísono', numerator: 1, denominator: 1 },
  { id: 'fourth', name: 'Cuarta justa', numerator: 4, denominator: 3 },
  { id: 'fifth', name: 'Quinta justa', numerator: 3, denominator: 2 },
  { id: 'sixth', name: 'Sexta mayor justa', numerator: 5, denominator: 3 },
  { id: 'octave', name: 'Octava', numerator: 2, denominator: 1 },
] as const;
export const FIGURES = [
  { id: 'flower', name: 'Flor de la Vida', kind: 'Construcción geométrica', description: 'Círculos de igual radio sobre una retícula hexagonal. Ajusta las capas y observa sus intersecciones.', sourceIds: ['construction'] },
  { id: 'lissajous', name: 'Lissajous', kind: 'Relación matemática', description: 'La razón musical controla las oscilaciones de los dos ejes. La fase cambia el trazado; el marcador puede recorrerlo a velocidad visual reducida.', sourceIds: ['construction'] },
  { id: 'russell', name: 'Ciclo inspirado en Russell', kind: 'Interpretación visual', description: 'Dos espirales y un contorno ilustran compresión, expansión y retorno. Es una interpretación propia de su ciclo; el dibujo no calcula fuerzas ni campos.', sourceIds: ['russell'] },
  { id: 'pentagons', name: 'Ensamblaje pentangular', kind: 'Modelo geométrico exploratorio', description: 'Seis paneles pentagonales regulares con apertura y copias ajustables. Construcción propia inspirada en el estudio de Howard; no reproduce su CAD ni calcula resonancias de un objeto.', sourceIds: ['howard-flight', 'howard-patent'] },
] as const;
export type FigureId = typeof FIGURES[number]['id'];
export type GeometryConfig = {
  baseHz: number; interval: typeof INTERVALS[number]['id']; figure: FigureId;
  phaseDegrees: number; rotationDegrees: number; openingDegrees: number;
  copies: number; flowerRings: number; animate: boolean;
};
export const defaultGeometry = (): GeometryConfig => ({ baseHz: 256, interval: 'fifth', figure: 'lissajous', phaseDegrees: 90, rotationDegrees: 20, openingDegrees: 30, copies: 1, flowerRings: 2, animate: false });
export const GEOMETRY_SOURCES = [
  { id: 'construction', title: 'Construcciones de Resonance Lab', kind: 'Cálculo propio', locator: 'Razones exactas y ecuaciones de esta vista', claim: 'La frecuencia del segundo tono es f₀ × numerador / denominador. Lissajous: x = sin(d·t), y = sin(n·t + φ). La retícula de círculos usa coordenadas hexagonales.', limit: 'La asociación entre una figura y una práctica personal es una elección del usuario.', url: null },
  { id: 'russell', title: 'Walter Russell · The Secret of Light', kind: 'Fuente filosófica', locator: 'The Universal Octave · figuras 67–68', claim: 'Russell describe ciclos de compresión, expansión y retorno a la quietud.', limit: 'La visualización es una interpretación propia, no una validación física de su cosmología.', url: 'https://avalonlibrary.net/ebooks/Walter%20Russell%20-%20The%20Secret%20of%20Light.pdf' },
  { id: 'howard-flight', title: 'Howard, Molter, Seely y Yee · vuelo Lynchpin', kind: 'Publicación de ingeniería', locator: 'SAE Int. J. Aerospace 16(3), 291–303 (2023) · DOI 10.4271/01-16-03-0018', claim: 'El artículo presenta una geometría aeronáutica, control y pruebas de un prototipo con motores y hélices bidireccionales.', limit: 'Su resultado se refiere al diseño de vuelo. No proporciona frecuencias de manifestación ni una prueba de éter.', url: 'https://saemobilus.sae.org/articles/lynchpin-a-novel-geometry-modular-tangential-omnidirectional-flight-01-16-03-0018' },
  { id: 'howard-patent', title: 'Howard · patente US11117065B2', kind: 'Documento de diseño', locator: 'Reivindicaciones 1–8', claim: 'Describe un vehículo formado por estructuras pentangulares y dispositivos de propulsión.', limit: 'El ensamblaje ajustable de esta pantalla es propio; no se presenta como el sólido exacto de la patente.', url: 'https://patents.google.com/patent/US11117065B2/en' },
  { id: 'emotion', title: 'Lieberman et al. · nombrar emociones', kind: 'Estudio experimental', locator: 'Psychological Science 18(5), 421–428 (2007) · DOI 10.1111/j.1467-9280.2007.01916.x', claim: 'En una tarea de neuroimagen, etiquetar afectos se asoció con menor respuesta de la amígdala ante imágenes emocionales.', limit: 'No estudió manifestación ni demuestra que una emoción garantice resultados externos.', url: 'https://pubmed.ncbi.nlm.nih.gov/17576282/' },
  { id: 'breathing', title: 'Yilmaz Balban et al. · prácticas respiratorias', kind: 'Estudio experimental', locator: 'Cell Reports Medicine 4(1), 100895 (2023) · DOI 10.1016/j.xcrm.2022.100895', claim: 'Comparó prácticas respiratorias breves y meditación durante un mes y encontró cambios en ánimo y respiración.', limit: 'Nuestro recorrido es una adaptación personalizable; no reproduce sus intervenciones ni estudia cristales.', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947/' },
  { id: 'chladni', title: 'University of Colorado · figuras de Chladni', kind: 'Demostración física', locator: 'Physics Undergraduate Labs · Chladni Figures', claim: 'Las formas de una placa vibrante dependen de su geometría, frecuencia y condiciones de apoyo.', limit: 'El modo Placas y membranas contiene ese modelo; las construcciones de esta vista no son mediciones de una placa.', url: 'https://physicslabs.colorado.edu/demos/oscillations-and-waves/instruments/resonance-in-plates-bars-solids/chladni-figures/' },
] as const;
export const PRACTICE_PHASES = [
  { name: 'Recoger la atención', guide: 'Observa el apoyo del cuerpo y nombra cómo estás. Respira con naturalidad; puedes mantener los ojos abiertos.' },
  { name: 'Formular', guide: 'Elige una sola intención y una escena concreta. Reconoce qué parte depende de tus acciones.' },
  { name: 'Representar', guide: 'Contempla la figura o tu escena. Observa imágenes, pensamientos y emociones sin exigir una sensación determinada.' },
  { name: 'Soltar y volver', guide: 'Deja de añadir instrucciones, vuelve al entorno y prepara una acción que corresponda a tu intención.' },
] as const;
const range = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
export function validateGeometry(value: unknown): GeometryConfig {
  if (!value || typeof value !== 'object') throw new Error('Configuración geométrica inválida.');
  const c = value as GeometryConfig;
  const keys = ['baseHz', 'interval', 'figure', 'phaseDegrees', 'rotationDegrees', 'openingDegrees', 'copies', 'flowerRings', 'animate'];
  if (Object.keys(c).length !== keys.length || !keys.every(k => k in c) || !range(c.baseHz, 40, 1000) || !INTERVALS.some(i => i.id === c.interval) || !FIGURES.some(f => f.id === c.figure) || !range(c.phaseDegrees, 0, 360) || !range(c.rotationDegrees, 0, 360) || !range(c.openingDegrees, 0, 80) || !range(c.copies, 1, 3) || !Number.isInteger(c.copies) || !range(c.flowerRings, 1, 3) || !Number.isInteger(c.flowerRings) || typeof c.animate !== 'boolean') throw new Error('Revisa los parámetros geométricos y la base de 40–1000 Hz.');
  return structuredClone(c);
}
export function geometryTones(c: GeometryConfig) {
  validateGeometry(c);
  const ratio = INTERVALS.find(i => i.id === c.interval)!;
  return c.interval === 'unison' ? [c.baseHz] : [c.baseHz, c.baseHz * ratio.numerator / ratio.denominator];
}
export function validatePhaseMinutes(value: unknown): [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(v => range(v, 1, 15) && Number.isInteger(v))) throw new Error('Cada fase debe durar de 1 a 15 minutos enteros.');
  return [...value] as [number, number, number, number];
}
export function geometryRecipe(c: GeometryConfig, minutes = 1): ComposerRecipe {
  return { version: COMPOSER_VERSION, name: 'Geometría e intención', intention: '', durationMinutes: minutes, transitionSeconds: .15, visual: true, layers: geometryTones(c).map((hz, index) => ({ id: `tone-${index}`, name: index ? 'Intervalo' : 'Base', enabled: true, mode: 'tone', carrierHz: hz, rateHz: 1, depth: 0, level: .5 })) };
}
export function practicePhaseAt(minutes: number[], elapsedMs: number) {
  let boundary = 0;
  return minutes.findIndex(m => { boundary += m * 60000; return elapsedMs < boundary; });
}
export type Point3 = [number, number, number];
export function pentagonalPanels(openingDegrees: number): Point3[][] {
  const opening = openingDegrees * Math.PI / 180;
  return Array.from({ length: 6 }, (_, panel) => {
    const angle = panel * Math.PI / 3, c = Math.cos(angle), s = Math.sin(angle);
    return Array.from({ length: 5 }, (_, vertex): Point3 => {
      const a = vertex * Math.PI * 2 / 5, u = .42 * Math.cos(a), v = .42 * Math.sin(a);
      return [.72 * c - s * u - c * Math.sin(opening) * v, .72 * s + c * u - s * Math.sin(opening) * v, Math.cos(opening) * v];
    });
  });
}
export function flowerCenters(rings: number): [number, number][] {
  const points: [number, number][] = [];
  for (let q = -rings; q <= rings; q++) for (let r = -rings; r <= rings; r++) if (Math.abs(q + r) <= rings) points.push([q + r / 2, Math.sqrt(3) * r / 2]);
  return points;
}
/** Reads the monotonic clock only when invoked by an event or a timer. */
export const geometryNow = () => performance.now();

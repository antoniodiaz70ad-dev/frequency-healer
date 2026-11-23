/** Crystal practice designs are app compositions; they are not measured mineral charging protocols. */
export const CRYSTAL_KEY = 'fh.crystals.v1';
export const CRYSTAL_DESIGN_VERSION = 'crystal-preparation-1';
export type CrystalPurpose = 'creation' | 'focus' | 'calm' | 'communication';
export type CrystalDuration = 10 | 15;
export type CrystalPreparation = {
  crystal: string; material: string; details: string; purpose: CrystalPurpose;
  intention: string; scene: string; duration: CrystalDuration; baseHz: number;
  sound: boolean; exposure: 'speaker' | 'headphones' | 'coils' | 'voice';
};
export type CrystalPhase = { id: string; title: string; seconds: number; guide: string; voices: number };
export type CrystalStep = { seconds: number; tones: { hz: number; level: number }[] };
export const CRYSTAL_PURPOSES = [
  { id: 'creation', label: 'Manifestación y creación', phrase: 'Desarrollo esta posibilidad con claridad, imaginación y acción.' },
  { id: 'focus', label: 'Concentración', phrase: 'Sostengo mi atención y regreso con claridad a lo que elijo.' },
  { id: 'calm', label: 'Serenidad', phrase: 'Reconozco mi estado y respondo con calma.' },
  { id: 'communication', label: 'Comunicación', phrase: 'Expreso mi intención con claridad y escucho con atención.' },
] as const;
export function defaultCrystalPreparation(): CrystalPreparation {
  return { crystal: '', material: 'Cuarzo', details: '', purpose: 'creation', intention: '', scene: '', duration: 15, baseHz: 256, sound: true, exposure: 'speaker' };
}
export function validatePreparation(input: unknown, ready = false): asserts input is CrystalPreparation {
  const p = input as CrystalPreparation;
  if (!p || typeof p !== 'object' || !['crystal', 'material', 'details', 'intention', 'scene'].every(key => typeof p[key as keyof CrystalPreparation] === 'string' && String(p[key as keyof CrystalPreparation]).length <= (key === 'crystal' || key === 'material' ? 120 : 6000)) || !CRYSTAL_PURPOSES.some(row => row.id === p.purpose) || ![10, 15].includes(p.duration) || !Number.isFinite(p.baseHz) || p.baseHz < 80 || p.baseHz > 2000 || typeof p.sound !== 'boolean' || !['speaker', 'headphones', 'coils', 'voice'].includes(p.exposure)) throw new Error('Revisa la preparación: base de 80 a 2000 Hz y recorrido de 10 o 15 minutos.');
  if (ready && (!p.crystal.trim() || !p.intention.trim())) throw new Error('Nombra tu cristal y escribe una intención antes de comenzar.');
}
export function crystalPhases(duration: CrystalDuration): CrystalPhase[] {
  if (![10, 15].includes(duration)) throw new Error('Elige un recorrido de 10 o 15 minutos.');
  const times = duration === 15 ? [180, 120, 300, 180, 120] : [120, 60, 240, 120, 60];
  return [
    { id: 'prepare', title: 'Preparar', seconds: times[0], voices: 1, guide: 'Sostén la pieza cómodamente o colócala frente a ti. Reconoce cómo estás. Respira con naturalidad, sin retenciones ni presión sobre las puntas.' },
    { id: 'define', title: 'Definir la intención', seconds: times[1], voices: 1, guide: 'Formula una sola intención. Reconoce qué papel eliges para esta herramienta. Reúne una escena concreta y un sentimiento que puedas sostener cómodamente.' },
    { id: 'program', title: 'Programación intencional', seconds: times[2], voices: 3, guide: 'Mantén juntos tu frase, la escena y el sentimiento. Puedes decir la frase suavemente tres veces, dejando espacio entre repeticiones. Observa sin forzar una sensación.' },
    { id: 'stabilize', title: 'Estabilizar', seconds: times[3], voices: 3, guide: 'Deja de añadir instrucciones. Las capas se retiran progresivamente. Permanece con la intención elegida sin aumentar su intensidad.' },
    { id: 'close', title: 'Cerrar en silencio', seconds: times[4], voices: 0, guide: 'Suelta la imagen y deja la pieza en su lugar. Permanece en silencio. Después registra lo vivido y una acción que corresponda a tu intención.' },
  ];
}
export function crystalPhaseAt(elapsedMs: number, duration: CrystalDuration) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= duration * 60000) return null;
  let startMs = 0;
  for (const phase of crystalPhases(duration)) {
    const endMs = startMs + phase.seconds * 1000;
    if (elapsedMs < endMs) return { ...phase, startMs, endMs };
    startMs = endMs;
  }
  return null;
}
/** Relative levels 1 : 1/2 : 1/4, normalized with a fixed divisor across all phases. */
export function crystalTimeline(preparation: CrystalPreparation): CrystalStep[] {
  validatePreparation(preparation);
  const phases = crystalPhases(preparation.duration);
  const tones = [1, 1.5, 2].map((ratio, index) => ({ hz: preparation.baseHz * ratio, level: [1, .5, .25][index] / 1.75 }));
  const step = (seconds: number, count: number): CrystalStep => ({ seconds, tones: preparation.sound && preparation.exposure !== 'voice' ? tones.slice(0, count).map(t => ({ ...t })) : [] });
  return [step(phases[0].seconds, 1), step(phases[1].seconds, 1),
    step(phases[2].seconds / 3, 1), step(phases[2].seconds / 3, 2), step(phases[2].seconds / 3, 3),
    step(phases[3].seconds / 3, 3), step(phases[3].seconds / 3, 2), step(phases[3].seconds / 3, 1), step(phases[4].seconds, 0)];
}
export type CrystalNotes = { experience: string; interpretation: string; action: string };
export type CrystalFollowUp = { id: string; at: string; text: string };
export type CrystalSession = {
  id: string; designVersion: typeof CRYSTAL_DESIGN_VERSION; startedAt: string; endedAt: string;
  status: 'completed' | 'stopped'; elapsedMs: number; preparation: CrystalPreparation;
  initialVolume: number; volumeChanges: { elapsedMs: number; level: number }[];
  notes: CrystalNotes; followUps: CrystalFollowUp[];
};
export type CrystalNotebook = { schemaVersion: 1; preparation: CrystalPreparation | null; sessions: CrystalSession[] };
export type CrystalStore = Pick<Storage, 'getItem' | 'setItem'>;
const date = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
const text = (v: unknown, max = 6000): v is string => typeof v === 'string' && v.length <= max;
export function validateCrystalSession(input: unknown): asserts input is CrystalSession {
  const s = input as CrystalSession;
  if (!s || typeof s !== 'object') throw new Error('Sesión de cristal inválida.');
  validatePreparation(s.preparation, true);
  if (!text(s.id, 120) || !s.id || s.designVersion !== CRYSTAL_DESIGN_VERSION || !date(s.startedAt) || !date(s.endedAt) || Date.parse(s.endedAt) < Date.parse(s.startedAt) || !['completed', 'stopped'].includes(s.status) || !Number.isFinite(s.elapsedMs) || s.elapsedMs < 0 || s.elapsedMs > s.preparation.duration * 60000 || (s.status === 'completed' && s.elapsedMs !== s.preparation.duration * 60000) || !s.notes || !['experience', 'interpretation', 'action'].every(key => text(s.notes[key as keyof CrystalNotes])) || !Array.isArray(s.followUps) || s.followUps.length > 1000) throw new Error('Sesión de cristal inválida.');
  if (!Number.isFinite(s.initialVolume) || s.initialVolume < 0 || s.initialVolume > .6 || !Array.isArray(s.volumeChanges) || s.volumeChanges.some((v, i) => !v || !Number.isFinite(v.elapsedMs) || v.elapsedMs < 0 || v.elapsedMs > s.elapsedMs || (i > 0 && v.elapsedMs < s.volumeChanges[i - 1].elapsedMs) || !Number.isFinite(v.level) || v.level < 0 || v.level > .6)) throw new Error('Historial de volumen inválido.');
  const ids = new Set<string>();
  for (const f of s.followUps) {
    if (!f || !text(f.id, 120) || !f.id || ids.has(f.id) || !date(f.at) || !text(f.text) || !f.text.trim()) throw new Error('Observación posterior inválida.');
    ids.add(f.id);
  }
}
export function parseCrystalNotebook(raw: string | null): CrystalNotebook {
  if (raw === null) return { schemaVersion: 1, preparation: null, sessions: [] };
  try {
    const book = JSON.parse(raw) as CrystalNotebook;
    if (!book || book.schemaVersion !== 1 || !Array.isArray(book.sessions) || book.sessions.length > 1000) throw new Error();
    if (book.preparation !== null) validatePreparation(book.preparation);
    const ids = new Set<string>();
    for (const session of book.sessions) { validateCrystalSession(session); if (ids.has(session.id)) throw new Error(); ids.add(session.id); }
    return book;
  } catch { throw new Error('El cuaderno no se pudo leer. Se conserva el original; expórtalo antes de continuar.'); }
}
export function readCrystalNotebook(store: CrystalStore) { return parseCrystalNotebook(store.getItem(CRYSTAL_KEY)); }
export function saveCrystalPreparation(store: CrystalStore, preparation: CrystalPreparation) {
  validatePreparation(preparation);
  const book = readCrystalNotebook(store), next = { ...book, preparation: structuredClone(preparation) };
  store.setItem(CRYSTAL_KEY, JSON.stringify(next)); return next;
}
export function saveCrystalSession(store: CrystalStore, session: CrystalSession) {
  validateCrystalSession(session);
  const book = readCrystalNotebook(store), existing = book.sessions.find(s => s.id === session.id);
  if (existing && JSON.stringify(existing) !== JSON.stringify(session)) throw new Error('Esta sesión ya existe con otro contenido.');
  if (existing) return book;
  if (book.sessions.length >= 1000) throw new Error('El cuaderno alcanzó 1000 sesiones. Exporta tus datos.');
  const next = { ...book, sessions: [...book.sessions, structuredClone(session)] };
  store.setItem(CRYSTAL_KEY, JSON.stringify(next)); return next;
}
export function appendCrystalFollowUp(store: CrystalStore, sessionId: string, followUp: CrystalFollowUp) {
  const book = readCrystalNotebook(store), session = book.sessions.find(s => s.id === sessionId);
  if (!session) throw new Error('No se encontró la sesión.');
  const existing = session.followUps.find(f => f.id === followUp.id);
  if (existing) { if (JSON.stringify(existing) !== JSON.stringify(followUp)) throw new Error('La observación ya existe con otro contenido.'); return book; }
  const updated = { ...session, followUps: [...session.followUps, followUp] }; validateCrystalSession(updated);
  const next = { ...book, sessions: book.sessions.map(s => s.id === sessionId ? updated : s) };
  store.setItem(CRYSTAL_KEY, JSON.stringify(next)); return next;
}
/** Imported sessions merge by immutable ID; the current local preparation is preserved. */
export function importCrystalNotebook(store: CrystalStore, raw: string) {
  if (raw.length > 5_000_000) throw new Error('El archivo supera el límite de 5 MB de texto.');
  const incoming = parseCrystalNotebook(raw), current = readCrystalNotebook(store);
  const sessions = new Map(current.sessions.map(s => [s.id, s]));
  for (const row of incoming.sessions) {
    const prior = sessions.get(row.id);
    if (!prior) { sessions.set(row.id, row); continue; }
    const { followUps: oldUpdates, ...oldCore } = prior, { followUps: newUpdates, ...newCore } = row;
    if (JSON.stringify(oldCore) !== JSON.stringify(newCore)) throw new Error('Hay una sesión con el mismo identificador y distinto contenido. No se cambió el cuaderno.');
    const updates = new Map(oldUpdates.map(f => [f.id, f]));
    for (const update of newUpdates) {
      if (updates.has(update.id) && JSON.stringify(updates.get(update.id)) !== JSON.stringify(update)) throw new Error('Hay observaciones en conflicto. No se cambió el cuaderno.');
      updates.set(update.id, update);
    }
    sessions.set(row.id, { ...prior, followUps: [...updates.values()] });
  }
  const next: CrystalNotebook = { schemaVersion: 1, preparation: current.preparation ?? incoming.preparation, sessions: [...sessions.values()] };
  parseCrystalNotebook(JSON.stringify(next));
  store.setItem(CRYSTAL_KEY, JSON.stringify(next)); return next;
}
export const CRYSTAL_SOURCES = [
  { title: 'Vogel · intención y participación', text: 'El método de su legado vincula preparación, intención, respiración y bienestar del operador. Aquí usamos respiración natural; no reproducimos su procedimiento terapéutico.', href: 'https://marcelvogel.org/vogel-healing-method.html' },
  { title: 'Cannon · cristal como instrumento', text: 'The Convoluted Universe, Book Two: páginas PDF 54–55 y 122–123 describen un soporte y amplificador; 147–149 relacionan tonos y colores sin indicar hercios. Son relatos de regresión.', href: null },
  { title: 'Resonancia física del cuarzo', text: 'NIST explica la función del cuarzo en un oscilador. La respuesta depende del corte, dimensiones y montaje. Esta guía sonora no mide la resonancia de tu pieza.', href: 'https://www.nist.gov/pml/time-and-frequency-division/popular-links/time-frequency-z/time-and-frequency-z-q-ra' },
  { title: 'Cuidado de la pieza', text: 'GIA advierte que el calor y la luz intensa prolongada pueden afectar a la amatista. Identifica el material antes de limpiarlo; utiliza un soporte estable y evita presión sobre las puntas.', href: 'https://www.gia.edu/amethyst-care-cleaning' },
] as const;

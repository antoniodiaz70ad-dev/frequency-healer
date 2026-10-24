// Executable contract only. Neither application imports this module yet.
export const VERSION = 1;
export const MAX_BYTES = 32768;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message) => { throw new TypeError(message); };
function exact(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(name);
  const own = Object.keys(value);
  if (own.length !== keys.length || own.some(k => !keys.includes(k))) fail(`${name}: campos desconocidos o ausentes`);
}
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) fail('Fecha UTC inválida');
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value) fail('Fecha inexistente');
  return ms;
}
function textOrNull(value) {
  if (value !== null && (typeof value !== 'string' || value.length > 5000)) fail('Texto inválido');
}
export function validateSummary(input) {
  exact(input, ['schemaVersion','source','practice','sessionId','protocolVersion','startedAt','endedAt','elapsedActiveMs','status','mode','interruptionCount','shared','observation','interpretation','action','scores'], 'Resumen');
  if (input.schemaVersion !== VERSION || input.source !== 'frequency-healer' || input.practice !== 'bentov' || input.protocolVersion !== 'bentov-respiration-v1.1') fail('Versión/origen/protocolo no soportado');
  if (typeof input.sessionId !== 'string' || !uuid.test(input.sessionId)) fail('ID de sesión inválido');
  const wall = timestamp(input.endedAt) - timestamp(input.startedAt);
  if (!Number.isSafeInteger(input.elapsedActiveMs) || input.elapsedActiveMs < 0 || input.elapsedActiveMs > 600000 || wall < input.elapsedActiveMs) fail('Duración incoherente');
  if (!['completed','stopped','interrupted'].includes(input.status) || !['paced','natural','mixed'].includes(input.mode)) fail('Estado/modalidad inválido');
  if (input.status === 'completed' && input.elapsedActiveMs !== 600000) fail('Completada requiere 600000 ms');
  if (!Number.isSafeInteger(input.interruptionCount) || input.interruptionCount < 0 || input.interruptionCount > 10000) fail('Interrupciones inválidas');
  exact(input.shared, ['observation','interpretation','action','scores'], 'Selección');
  for (const key of ['observation','interpretation','action','scores']) {
    if (typeof input.shared[key] !== 'boolean') fail('Selección debe ser booleana');
    if (!input.shared[key] && input[key] !== null) fail('Contenido no autorizado');
    if (key !== 'scores') textOrNull(input[key]);
  }
  if (input.scores !== null) {
    exact(input.scores, ['tensionPre','tensionPost','clarityPre','clarityPost'], 'Escalas');
    for (const score of Object.values(input.scores)) {
      if (score !== null && (!Number.isInteger(score) || score < 0 || score > 10)) fail('Escala fuera de 0–10');
    }
  }
  const serialized = JSON.stringify(input);
  if (new TextEncoder().encode(serialized).length > MAX_BYTES) fail('Resumen demasiado grande');
  return JSON.parse(serialized);
}

// Build only the selected fields; never spread a local session into an export.
export function selectSummary(session, shared) {
  exact(shared, ['observation','interpretation','action','scores'], 'Selección');
  return validateSummary({
    schemaVersion: VERSION, source: 'frequency-healer', practice: 'bentov',
    sessionId: session.id, protocolVersion: session.protocolVersion,
    startedAt: session.startedAt, endedAt: session.endedAt,
    elapsedActiveMs: session.elapsedActiveMs, status: session.status,
    mode: session.actualMode, interruptionCount: session.interruptions.length,
    shared: { ...shared },
    observation: shared.observation ? session.observation : null,
    interpretation: shared.interpretation ? session.interpretation : null,
    action: shared.action ? session.action : null,
    scores: shared.scores ? {
      tensionPre: session.tensionPre, tensionPost: session.tensionPost,
      clarityPre: session.clarityPre, clarityPost: session.clarityPost,
    } : null,
  });
}

// Correlation is not authentication. Server must verify user + flow ownership.
export function acceptSummaryEvent(event, expected) {
  if (!expected.window || !expected.origin || event.source !== expected.window || event.origin !== expected.origin) fail('Emisor no permitido');
  const parsed = new URL(expected.origin);
  if (parsed.origin !== expected.origin || parsed.protocol !== 'https:') fail('Origen HTTPS exacto requerido');
  const data = event.data;
  exact(data, ['type','version','flowId','channel','summary'], 'Mensaje');
  if (data.type !== 'fh.summary' || data.version !== VERSION || !uuid.test(data.flowId) || !uuid.test(data.channel) || data.flowId !== expected.flowId || data.channel !== expected.channel) fail('Canal incorrecto');
  if (!Number.isFinite(expected.expiresAt) || !Number.isFinite(expected.now) || expected.now >= expected.expiresAt) fail('Canal caducado');
  return validateSummary(data.summary);
}

export function validateFollowup(input) {
  exact(input, ['expectedRevision','status','observation','nextAction'], 'Seguimiento');
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || !['pending','done','changed'].includes(input.status)) fail('Revisión/estado inválido');
  textOrNull(input.observation); textOrNull(input.nextAction);
  if (input.status === 'changed' && (typeof input.nextAction !== 'string' || !input.nextAction.trim())) fail('Indica la nueva acción');
  return { ...input };
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

// Use AFTER an authenticated, owner-scoped lookup under the unique DB key.
// This comparison does not itself provide database atomicity or authentication.
export function classifyReplay(existing, incoming) {
  const a = validateSummary(existing), b = validateSummary(incoming);
  if (a.sessionId.toLowerCase() !== b.sessionId.toLowerCase()) fail('Sesiones distintas');
  a.sessionId = a.sessionId.toLowerCase(); b.sessionId = b.sessionId.toLowerCase();
  return canonical(a) === canonical(b) ? 'same' : 'conflict';
}

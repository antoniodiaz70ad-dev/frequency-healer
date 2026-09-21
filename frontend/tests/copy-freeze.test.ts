import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EVIDENCE_CATEGORIES } from '../src/lib/protocolLibrary';
import { OBE_CONTENT_CLASSIFICATION } from '../src/lib/commandCards';

const source = (...parts: string[]) => readFileSync(join(process.cwd(), 'src', ...parts), 'utf8');
const activeUI = [
  ['app','page.tsx'], ['app','landing','page.tsx'], ['app','biblioteca','page.tsx'],
  ['app','protocolos','page.tsx'], ['app','generador','page.tsx'], ['app','sesion-nueva','page.tsx'],
  ['app','diario','page.tsx'], ['components','Sidebar.tsx'], ['components','CommandCardItem.tsx'],
  ['components','SafetyDisclaimerModal.tsx'], ['components','voice','VoiceJourney.tsx'],
  ['components','voice','VoiceHistory.tsx'], ['components','voice','HarmonicLab.tsx'],
  ['components','lab','ProtocolRationale.tsx'], ['components','lab','StructureProfile.tsx'],
  ['components','lab','AdaptiveExplorer.tsx'],
].map(parts => source(...parts)).join('\n');

test('V1 canonical feature and explanation labels remain present', () => {
  for (const label of [
    'Sesión guiada', 'Laboratorio Armónico', 'Atlas de frecuencias', 'Protocolos históricos',
    'Generador manual', 'Exploración OBE', 'Diario OBE', '¿Por qué esta sesión?',
    'Propósito subjetivo', 'Complejidad estructural', 'Evidencia personal', 'Próxima sesión informativa',
  ]) assert.ok(activeUI.includes(label), label);
  for (const stale of ['Viaje por voz', 'Por qué funciona', 'Frecuencia milagro']) {
    assert.equal(activeUI.includes(stale), false, stale);
  }
});

test('V1 evidence taxonomy is closed and OBE framing remains exploratory', () => {
  assert.deepEqual(EVIDENCE_CATEGORIES, [
    'MATHEMATICAL', 'ACOUSTIC', 'PROTOCOL_DESIGN', 'TRADITIONAL_HISTORICAL',
    'EXPLORATORY', 'PERSONAL_N1', 'PUBLISHED_EVIDENCE', 'UNSUPPORTED_LEGACY_CLAIM',
  ]);
  assert.equal(OBE_CONTENT_CLASSIFICATION, 'EXPLORATORY');
  assert.match(activeUI, /Marco OBE exploratorio/);
  assert.match(activeUI, /EXPLORATORIO/);
});

test('HCI and legacy classification limitations remain intact', () => {
  const structureProfile = source('components','lab','StructureProfile.tsx');
  assert.match(structureProfile, /HCI describe la complejidad de la estructura armónica; no mide efectividad terapéutica\./);
  const protocols = source('app','protocolos','page.tsx');
  assert.match(protocols, /HISTÓRICO/);
  assert.match(protocols, /DEPRECADO/);
  assert.match(protocols, /LEGADO NO RESPALDADO/);
});

test('active safety UI contains no guaranteed binaural or literal OBE mechanism', () => {
  const disclaimer = source('components','SafetyDisclaimerModal.tsx');
  for (const unsafe of ['inducen estados alterados', 'atonía motora parcial', 'pérdida del campo visual espacial']) {
    assert.equal(disclaimer.includes(unsafe), false, unsafe);
  }
  assert.match(disclaimer, /pueden resultar absorbentes/);
  assert.match(disclaimer, /tu atención puede concentrarse en el audio/);
});

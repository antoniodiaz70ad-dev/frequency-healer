import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COMMAND_CARDS, COMMAND_PHASES_ORDERED, OBE_CONTENT_CLASSIFICATION } from '../src/lib/commandCards';
import { FOCUS_LEVEL_PRESETS } from '../src/lib/focusLevels';
import { loadSessionLogs } from '../src/lib/sessionLog';
import type { OBESessionLog } from '../src/lib/types';

const CARD_IDENTITY = [
  ['wbtb', 'preparacion'], ['caja-energia', 'preparacion'], ['respiracion-478', 'preparacion'],
  ['declaracion-intencion', 'preparacion'], ['checklist-fisico', 'preparacion'],
  ['estoicismo-emocional', 'induccion'], ['no-pasividad', 'induccion'], ['no-tragar', 'induccion'],
  ['rodar', 'salida'], ['sentarse', 'salida'], ['alejarse-rapido', 'salida'],
  ['no-mirar-atras', 'estabilizacion'], ['comando-claridad', 'estabilizacion'],
  ['manos-del-alma', 'estabilizacion'], ['voz-divina', 'estabilizacion'],
  ['destino-claro', 'exploracion'], ['no-dudar', 'exploracion'], ['telepatia', 'exploracion'],
  ['registro-inmediato', 'post'], ['descanso-burnout', 'post'], ['grounding', 'post'],
] as const;

test('OBE card identity, ordering, commands and phase sequence remain frozen', () => {
  assert.equal(OBE_CONTENT_CLASSIFICATION, 'EXPLORATORY');
  assert.deepEqual(COMMAND_PHASES_ORDERED, ['preparacion', 'induccion', 'salida', 'estabilizacion', 'exploracion', 'post']);
  assert.deepEqual(COMMAND_CARDS.map(card => [card.id, card.phase]), CARD_IDENTITY);
  assert.deepEqual(COMMAND_CARDS.filter(card => card.command).map(card => [card.id, card.command]), [
    ['declaracion-intencion', 'Tengo la intención de estar fuera de mi cuerpo con completa conciencia.'],
    ['comando-claridad', '¡Claridad! / Dame plena conciencia / Comando mi espacio'],
    ['destino-claro', 'Llévame a... / Quiero ver...'],
  ]);
});

test('OBE operational timing remains present while unsupported mechanisms are not asserted', () => {
  const content = COMMAND_CARDS.map(card => `${card.whenToUse} ${card.body} ${card.why}`).join('\n');
  for (const timing of ['4-6 horas', '2:00 y 3:00 a.m.', '4-6 ciclos', 'primeros 20 segundos', '3-7 días']) {
    assert.match(content, new RegExp(timing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const claim of [
    'cerebro está saturado de REM', 'Activa el nervio vago', 'campo magnético del cuerpo físico ejerce',
    'cuerpo del alma sin disparar', 'cuerda vocal del alma requiere', '80% del contenido se pierde',
    'sesiones binaurales profundas drenan', 'corteza ligeramente desacoplada',
  ]) assert.equal(content.includes(claim), false, claim);
});

test('every OBE card states an action, a use moment and a neutral purpose', () => {
  assert.equal(COMMAND_CARDS.length, 21);
  for (const card of COMMAND_CARDS) {
    assert.ok(card.whenToUse.trim().length > 0, card.id);
    assert.ok(card.body.trim().length > 0, card.id);
    assert.ok(card.why.trim().length > 0, card.id);
  }
});

test('OBE routes and subjective-purpose presentation remain available', () => {
  const root = join(process.cwd(), 'src');
  for (const route of ['app/biblioteca/page.tsx', 'app/diario/page.tsx', 'app/sesion-nueva/page.tsx']) {
    assert.match(readFileSync(join(root, route), 'utf8'), /export default function/);
  }
  const item = readFileSync(join(root, 'components/CommandCardItem.tsx'), 'utf8');
  assert.match(item, /Propósito subjetivo/);
  assert.doesNotMatch(item, /Por qué funciona/);
});

test('legacy OBE diary records remain readable without schema mutation', () => {
  const record: OBESessionLog = {
    id: 'legacy-obe-1', createdAt: 1, sessionDate: '2026-09-20', focusLabel: 'Focus 10',
    durationMinutes: 30, paralysisAchieved: false, vibrations: true, separation: false,
    visualClarity: 'partial', lookedBack: false, preEnergy: 0, postEnergy: 7,
    intention: 'Explorar', notes: 'Registro existente', tags: ['legacy'],
  };
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { getItem: (key: string) => key === 'fh:obe-session-logs-v1' ? JSON.stringify([record]) : null } },
  });
  try {
    assert.deepEqual(loadSessionLogs(), [record]);
    assert.deepEqual(Object.keys(loadSessionLogs()[0]), Object.keys(record));
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  }
});

test('OBE acoustic preset values remain frozen', () => {
  assert.deepEqual(FOCUS_LEVEL_PRESETS.map(({ id, durationMinutes, pinkNoiseGain, layers }) => ({
    id, durationMinutes, pinkNoiseGain,
    layers: layers.map(({ carrierHz, beatHz, gain, waveform }) => ({ carrierHz, beatHz, gain, waveform })),
  })), [
    { id: 'f10', durationMinutes: 30, pinkNoiseGain: 0.08, layers: [
      { carrierHz: 100, beatHz: 4, gain: 0.35, waveform: 'sine' },
      { carrierHz: 150, beatHz: 6.3, gain: 0.25, waveform: 'sine' },
    ] },
    { id: 'f12', durationMinutes: 30, pinkNoiseGain: 0.07, layers: [
      { carrierHz: 100, beatHz: 4, gain: 0.3, waveform: 'sine' },
      { carrierHz: 150, beatHz: 6.3, gain: 0.22, waveform: 'sine' },
      { carrierHz: 200, beatHz: 10.5, gain: 0.2, waveform: 'sine' },
    ] },
    { id: 'f15', durationMinutes: 45, pinkNoiseGain: 0.1, layers: [
      { carrierHz: 100, beatHz: 3.5, gain: 0.32, waveform: 'sine' },
      { carrierHz: 140, beatHz: 6.5, gain: 0.26, waveform: 'sine' },
      { carrierHz: 180, beatHz: 7.5, gain: 0.2, waveform: 'sine' },
    ] },
    { id: 'f21', durationMinutes: 45, pinkNoiseGain: 0.09, layers: [
      { carrierHz: 90, beatHz: 2.5, gain: 0.3, waveform: 'sine' },
      { carrierHz: 130, beatHz: 5.5, gain: 0.24, waveform: 'sine' },
      { carrierHz: 170, beatHz: 8.5, gain: 0.2, waveform: 'sine' },
    ] },
  ]);
});

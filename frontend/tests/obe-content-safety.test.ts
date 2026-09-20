import assert from 'node:assert/strict';
import test from 'node:test';
import { COMMAND_CARDS, COMMAND_PHASES_ORDERED, OBE_CONTENT_CLASSIFICATION } from '../src/lib/commandCards';

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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../src/lib/voice/commands';
import { VoiceOrchestrator } from '../src/lib/voice/orchestrator';
import { HarmonicEngine } from '../src/lib/harmonic/engine';
import { parseLocalIntent } from '../src/lib/voice/intentParser';
class EngineStub {
  active = false; volume = 20;
  async start() { this.active = true; return true; }
  snapshot() { return { stepIndex: 0, activeHz: [144, 216] }; }
  async duck() { return this.active; }
  restore() {} stop() { this.active = false; } dispose() {}
  getVolume() { return this.volume; } setVolume(v: number) { this.volume = v; }
}
test('commands are closed whole utterances; ambiguous phrases cannot reconfigure', () => {
  assert.deepEqual(parseCommand('Baja el volumen.'), { type: 'volume_relative', delta: -5 });
  assert.deepEqual(parseCommand('raise the volume 10'), { type: 'volume_relative', delta: 10 });
  assert.equal(parseCommand('No detén la sesión').type, 'none');
  assert.equal(parseCommand('cambia a algo más estable').type, 'none');
  assert.equal(parseCommand('Detén la sesión').type, 'stop_session');
});
test('orchestrator requires proposal and confirmation; commands record monotonic snapshots', async () => {
  const engine = new EngineStub(), o = new VoiceOrchestrator(engine as unknown as HarmonicEngine);
  await o.start(false); assert.equal(engine.active, false);
  o.move('review_transcript'); o.interpret('enfoque 5 minutos'); o.propose(parseLocalIntent('enfoque 5 minutos'));
  await o.start(false); assert.equal(o.state, 'playing');
  await o.beginMarkerCapture(); o.endMarkerCapture(); o.applyMarker('un momento interesante');
  assert.equal(o.record!.markers.length, 1); assert.ok(o.record!.markers[0].offsetMs >= 0); assert.deepEqual(o.record!.markers[0].harmonicSnapshot.activeHz, [144, 216]);
  assert.equal(o.applyMarker('detén la sesión'), 'confirm_stop'); assert.equal(o.state, 'playing');
  o.applyMarker('detén la sesión', true); assert.equal(o.state, 'reflection'); assert.equal(engine.active, false);
});
test('experimental consent cannot be bypassed by a proposal boolean', async () => {
  const engine = new EngineStub(), o = new VoiceOrchestrator(engine as unknown as HarmonicEngine);
  o.move('review_transcript'); o.interpret('creatividad 5 minutos'); o.propose(o.intent!);
  o.proposal!.requiresExplicitExperimentalConsent = false;
  await assert.rejects(o.start(false), /Confirma/); assert.equal(engine.active, false);
});

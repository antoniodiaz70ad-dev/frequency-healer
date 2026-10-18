import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultCymaticsConfig } from '../src/lib/cymatics/physics';
import { readVoiceSessions, saveVoiceSession, VOICE_SESSIONS_KEY, type VoiceSession } from '../src/lib/cymatics/voiceSessions';
function fixture(): VoiceSession {
  const capture = (hz: number) => { const config = defaultCymaticsConfig(); config.channelFrequenciesHz = [hz * 4]; config.modeledComponents = [hz * 4]; return { multiplier: 4 as const, reading: { frequencyHz: hz, confidence: .99, rms: .1, measuredAt: 100 }, config, createdAt: new Date().toISOString() }; };
  return { id: 'comparison-1', createdAt: new Date().toISOString(), captures: [capture(110), capture(120)] };
}
function memory() { const values = new Map<string,string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key,value); } }; }
test('voice comparisons survive a fresh read with original and applied frequencies', () => {
  const storage = memory(), row = fixture(); saveVoiceSession(row,storage);
  row.captures[0].reading.frequencyHz = 999;
  const saved = readVoiceSessions(storage); assert.equal(saved[0].captures[0].reading.frequencyHz,110); assert.equal(saved[0].captures[0].config.channelFrequenciesHz[0],440);
  assert.throws(() => saveVoiceSession(saved[0],storage));
});
test('invalid or corrupted comparisons never overwrite existing storage', () => {
  const storage = memory(), row = fixture(); saveVoiceSession(row,storage); const before = storage.getItem(VOICE_SESSIONS_KEY);
  row.id = 'invalid'; row.captures[1].config.channelFrequenciesHz[0] = 999;
  assert.throws(() => saveVoiceSession(row,storage)); assert.equal(storage.getItem(VOICE_SESSIONS_KEY),before);
  storage.setItem(VOICE_SESSIONS_KEY,'broken'); assert.throws(() => saveVoiceSession(fixture(),storage)); assert.equal(storage.getItem(VOICE_SESSIONS_KEY),'broken');
});

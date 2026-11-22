import assert from 'node:assert/strict';
import test from 'node:test';
import { acquirePlaybackSession, registerMarinaMediaSession } from '../src/lib/marina/backgroundPlayback';

test('playback policy is retained until the last user stops and is released only once', () => {
  const audioSession = { type: 'auto' };
  const first = acquirePlaybackSession({ audioSession });
  const second = acquirePlaybackSession({ audioSession });
  assert.equal(audioSession.type, 'playback');
  first(); first(); assert.equal(audioSession.type, 'playback');
  second(); assert.equal(audioSession.type, 'auto');
  const third = acquirePlaybackSession({ audioSession });
  audioSession.type = 'play-and-record'; third();
  assert.equal(audioSession.type, 'play-and-record', 'do not undo a microphone policy chosen by another owner');
});

test('missing or denied optional audio policies never prevent playback', () => {
  acquirePlaybackSession({})();
  acquirePlaybackSession({ audioSession: { get type() { return 'auto'; }, set type(_value) { throw new Error('unsupported'); } } })();
});

test('lock-screen transport dispatches actions, bounds position, and old cleanup cannot clear a newer session', () => {
  const actions = new Map<string, MediaSessionActionHandler | null>();
  const positions: (MediaPositionState | undefined)[] = [];
  const media = { playbackState: 'none', metadata: null,
    setActionHandler(action: string, callback: MediaSessionActionHandler | null) { actions.set(action, callback); },
    setPositionState(position?: MediaPositionState) { positions.push(position); },
  } as unknown as MediaSession;
  const called: string[] = [];
  const controls = { play: () => { called.push('play'); }, pause: () => { called.push('pause'); }, stop: () => { called.push('stop'); } };
  const first = registerMarinaMediaSession('Foco', 600000, controls, { mediaSession: media });
  first.update('playing', 5000);
  assert.equal(media.playbackState, 'playing');
  assert.deepEqual(positions.at(-1), { duration: 600, position: 5, playbackRate: 1 });
  for (const action of ['pause', 'play', 'stop'] as const) actions.get(action)?.({ action });
  assert.deepEqual(called, ['pause', 'play', 'stop']);
  const second = registerMarinaMediaSession('Punto Cero', 360000, controls, { mediaSession: media });
  second.update('paused', 999999); first.dispose();
  assert.equal(media.playbackState, 'paused');
  assert.ok(actions.get('play'));
  assert.equal(positions.at(-1)?.position, 360);
  second.dispose();
  assert.equal(media.playbackState, 'none');
  assert.ok([...actions.values()].every(value => value === null));
});

test('unsupported Media Session methods have no effect on the session engine', () => {
  const controls = { play() {}, pause() {}, stop() {} };
  const absent = registerMarinaMediaSession('Sin API', 1000, controls, {});
  absent.update('playing', 0); absent.dispose();
  const unsupported = registerMarinaMediaSession('API parcial', 1000, controls, { mediaSession: {
    setActionHandler() { throw new Error('unsupported action'); }, setPositionState() { throw new Error('unsupported position'); },
  } as unknown as MediaSession });
  unsupported.update('playing', 100); unsupported.dispose();
});

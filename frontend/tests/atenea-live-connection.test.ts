import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveVoiceConnection } from '../src/lib/atenea/liveConnection';
import { LIVE_CONSENT } from '../src/lib/atenea/liveTypes';

function fixture() {
  const events: unknown[] = [], sent: { type: string }[] = [], requests: { method: string; body: Record<string, unknown> }[] = [];
  let stopped = 0, peerClosed = 0, channelClosed = 0, played = 0;
  const track = { readyState: 'live', enabled: true, addEventListener() {}, removeEventListener() {}, stop() { stopped++; this.readyState = 'ended'; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
  const channel = {
    onmessage: null as ((event: { data: string }) => void) | null, onclose: null as (() => void) | null, readyState: 'open',
    send(data: string) { const event = JSON.parse(data); sent.push(event); if (event.type === 'session.close') queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ type: 'session.closed' }) })); },
    close() { channelClosed++; this.readyState = 'closed'; },
  };
  const peer = {
    ontrack: null, onconnectionstatechange: null, connectionState: 'connected', iceGatheringState: 'complete', localDescription: { sdp: 'v=0\r\noffer' },
    createDataChannel: (label: string) => { assert.equal(label, 'oai-events'); return channel; },
    addTrack() {}, createOffer: async () => { assert.ok(channel.onmessage); return { type: 'offer', sdp: 'v=0\r\noffer' }; },
    setLocalDescription: async () => {},
    setRemoteDescription: async (description: { sdp: string }) => { assert.equal(description.sdp, 'v=0\r\nanswer'); channel.onmessage?.({ data: JSON.stringify({ type: 'session.started' }) }); },
    close: () => { peerClosed++; },
    addEventListener() {}, removeEventListener() {},
  };
  const audio = { autoplay: false, muted: false, srcObject: null, play: async () => { played++; }, pause() {} };
  const http: typeof fetch = async (_url, init) => {
    const method = init!.method!; const body = JSON.parse(String(init!.body)); requests.push({ method, body });
    assert.equal(new Headers(init!.headers).get('authorization'), 'Bearer synthetic-identity');
    return method === 'DELETE' ? Response.json({ confirmed: true }) : Response.json({ session: { id: 'live_prefix' }, transport: { type: 'webrtc', sdp: 'v=0\r\nanswer' } });
  };
  const deps = { peer: () => peer as unknown as RTCPeerConnection, audio: () => audio as unknown as HTMLAudioElement, http, token: async () => 'synthetic-identity' };
  const connection = new LiveVoiceConnection(event => events.push(event), deps);
  return { connection, deps, stream, track, peer, channel, audio, events, sent, requests,
    stopped: () => stopped, peerClosed: () => peerClosed, channelClosed: () => channelClosed, played: () => played };
}

test('WebRTC listener order, SDP exchange, startup confirmation and restricted pause commands', async () => {
  const f = fixture(); await f.connection.start('observador', f.stream, LIVE_CONSENT, new AbortController().signal);
  assert.deepEqual(f.events, [{ type: 'active' }]); assert.equal(f.sent.length, 0); // Never sends session.start.
  assert.equal(f.requests[0].body.sdp, 'v=0\r\noffer');
  assert.equal('model' in f.requests[0].body, false);
  f.connection.pause(true); assert.equal(f.track.enabled, false); assert.equal(f.audio.muted, true);
  f.connection.pause(false); assert.equal(f.track.enabled, true);
  assert.deepEqual(f.sent.map(event => event.type), ['session.input_audio.mute', 'session.input_audio.unmute']);
  await f.connection.close();
});
test('close stops microphone immediately and waits for remote confirmation before releasing peer', async () => {
  const f = fixture(); await f.connection.start('diario', f.stream, LIVE_CONSENT, new AbortController().signal);
  const closing = f.connection.close(); assert.equal(f.stopped(), 1); assert.equal(f.peerClosed(), 0);
  assert.equal(await closing, true); assert.equal(f.peerClosed(), 1); assert.equal(f.channelClosed(), 1);
  assert.equal(await f.connection.close(), true); assert.equal(f.stopped(), 1);
  assert.equal(f.requests[1].method, 'DELETE'); assert.equal(f.requests[0].body.requestId, f.requests[1].body.requestId);
});
test('transcript fragments remain captions, never become final commands or consent', async () => {
  const f = fixture(); await f.connection.start('diario', f.stream, LIVE_CONSENT, new AbortController().signal);
  for (const delta of ['terminar', 'guarda solo el resumen']) f.channel.onmessage?.({ data: JSON.stringify({ type: 'session.input_transcript.delta', delta }) });
  assert.equal(f.stopped(), 0); assert.deepEqual(f.events.slice(1), [{ type: 'caption', fragment: 'terminar' }, { type: 'caption', fragment: 'guarda solo el resumen' }]);
  await f.connection.close();
});
test('no consent or aborted startup cannot create a remote session', async () => {
  const f = fixture(); await assert.rejects(f.connection.start('diario', f.stream, 'simulation', new AbortController().signal));
  const abort = new AbortController(); abort.abort(); await assert.rejects(f.connection.start('diario', f.stream, LIVE_CONSENT, abort.signal));
  assert.equal(f.requests.length, 0);
});
test('lost channel and failed backend closure report unconfirmed rather than successful finalization', async () => {
  const f = fixture(); const http: typeof fetch = async (url, init) => init?.method === 'DELETE' ? Response.json({ confirmed: false }, { status: 202 }) : f.deps.http(url, init);
  const connection = new LiveVoiceConnection(event => f.events.push(event), { ...f.deps, http });
  await connection.start('diario', f.stream, LIVE_CONSENT, new AbortController().signal);
  f.channel.readyState = 'closed'; assert.equal(await connection.close(), false);
  assert.deepEqual(f.events.at(-1), { type: 'closed', confirmed: false });
});
test('late successful create after cancellation is closed using the original reservation and identity', async () => {
  const f = fixture(); let finish!: (response: Response) => void; let posted!: () => void;
  const created = new Promise<void>(resolve => { posted = resolve; });
  const http: typeof fetch = async (url, init) => {
    if (init?.method === 'POST') { f.requests.push({ method: 'POST', body: JSON.parse(String(init.body)) }); posted(); return new Promise(resolve => { finish = resolve; }); }
    return f.deps.http(url, init);
  };
  const connection = new LiveVoiceConnection(event => f.events.push(event), { ...f.deps, http });
  const abort = new AbortController(); const starting = connection.start('diario', f.stream, LIVE_CONSENT, abort.signal);
  const rejected = assert.rejects(starting); await created; abort.abort(); await connection.close();
  finish(Response.json({ session: { id: 'live_late' }, transport: { type: 'webrtc', sdp: 'v=0\r\nanswer' } })); await rejected;
  assert.equal(f.stopped(), 1); assert.equal(f.requests.filter(item => item.method === 'DELETE').length, 2);
  assert.equal(f.requests.at(-1)!.body.requestId, f.requests[0].body.requestId);
});
test('closing during ICE gathering cancels startup immediately without creating a billable session', async () => {
  const f = fixture(); let gathering!: () => void;
  const entered = new Promise<void>(resolve => { gathering = resolve; });
  f.peer.iceGatheringState = 'gathering';
  f.peer.addEventListener = () => { gathering(); };
  const starting = f.connection.start('diario', f.stream, LIVE_CONSENT, new AbortController().signal);
  const rejected = assert.rejects(starting); await entered; await f.connection.close(); await rejected;
  assert.equal(f.requests.filter(item => item.method === 'POST').length, 0); assert.equal(f.stopped(), 1);
});
test('a channel closing during send still falls back to authenticated remote closure and frees resources', async () => {
  const f = fixture(); await f.connection.start('diario', f.stream, LIVE_CONSENT, new AbortController().signal);
  f.channel.send = () => { throw new Error('channel closed'); };
  assert.equal(await f.connection.close(), true); assert.equal(f.peerClosed(), 1); assert.equal(f.stopped(), 1);
});
test('blocked remote playback closes the microphone and billable session instead of listening inaudibly', async () => {
  const f = fixture(); await f.connection.start('diario', f.stream, LIVE_CONSENT, new AbortController().signal);
  f.audio.play = async () => { throw new Error('autoplay denied'); };
  (f.peer.ontrack as unknown as (event: { streams: MediaStream[] }) => void)({ streams: [f.stream] });
  await Promise.resolve(); assert.equal(f.stopped(), 1);
  assert.equal(await f.connection.close(), true);
});

import type { Mode } from './contracts';
import { LIVE_CONSENT, LIVE_MAX_SECONDS } from './liveTypes';

type Event = { type: 'active' } | { type: 'caption'; fragment: string } | { type: 'closed'; confirmed: boolean } | { type: 'error' };
interface BrowserDependencies {
  peer(): RTCPeerConnection;
  audio(): HTMLAudioElement;
  http: typeof fetch;
  /** Host authentication supplies a short-lived, scoped access token; never an OpenAI key. */
  token?(): Promise<string>;
}
const defaults = { peer: () => new RTCPeerConnection(), audio: () => new Audio(), http: fetch };

/** Dedicated Live transport. Intentionally not connected to the simulated domain/UI.
 * Live transcripts are fragments, not finalized turns: never reinterpret them as consent or commands. */
export class LiveVoiceConnection {
  private peer: RTCPeerConnection | null = null;
  private audio: HTMLAudioElement | null = null;
  private channel: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private ready = false;
  private requestId = '';
  private accessToken = '';
  private closePromise: Promise<boolean> | null = null;
  private resolveClosed: ((confirmed: boolean) => void) | null = null;
  private cancelStart: (() => void) | null = null;
  private used = false;
  private durationTimer: ReturnType<typeof setTimeout> | null = null;
  private unbindTracks: (() => void) | null = null;
  private startupAbort = new AbortController();
  private deps: BrowserDependencies;
  constructor(private emit: (event: Event) => void, dependencies: Partial<BrowserDependencies> = {}) {
    this.deps = { ...defaults, ...dependencies };
  }
  async start(mode: Mode, stream: MediaStream, consent: string, signal: AbortSignal) {
    if (this.used || this.peer || this.requestId || consent !== LIVE_CONSENT || signal.aborted || !stream.getAudioTracks().some(track => track.readyState === 'live')) throw new Error('Live session not ready');
    this.used = true; // One transport per session; recovery always requires a fresh, explicit start.
    this.requestId = crypto.randomUUID(); this.closePromise = null; this.stream = stream;
    const requestId = this.requestId;
    const startupSignal = AbortSignal.any([signal, this.startupAbort.signal]);
    const abort = () => { void this.close(); };
    for (const track of stream.getAudioTracks()) track.addEventListener('ended', abort);
    this.unbindTracks = () => { for (const track of stream.getAudioTracks()) track.removeEventListener('ended', abort); };
    signal.addEventListener('abort', abort, { once: true });
    this.cancelStart = () => signal.removeEventListener('abort', abort);
    try {
      const accessToken = await this.deps.token?.() ?? '';
      if (startupSignal.aborted || this.closePromise) throw new Error('Cancelled');
      this.accessToken = accessToken;
      const peer = this.deps.peer(); this.peer = peer;
      const audio = this.deps.audio(); this.audio = audio; audio.autoplay = true;
      peer.ontrack = event => {
        if (this.closePromise) return;
        audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void audio.play().catch(() => { this.emit({ type: 'error' }); void this.close(); });
      };
      peer.onconnectionstatechange = () => { if (['failed', 'disconnected'].includes(peer.connectionState)) void this.close(); };
      for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);
      const channel = peer.createDataChannel('oai-events'); this.channel = channel;
      let started!: () => void, failed!: () => void;
      const waiting = new Promise<void>((resolve, reject) => { started = resolve; failed = () => reject(new Error('Live startup failed')); });
      // Register all listeners before SDP negotiation, including the finalization listener.
      channel.onmessage = event => {
        try {
          if (typeof event.data !== 'string' || event.data.length > 65536) return;
          const message = JSON.parse(event.data);
          if (message.type === 'session.started') { this.ready = true; started(); }
          else if (message.type === 'session.closed') { this.resolveClosed?.(true); if (!this.closePromise) { void this.close(true); } }
          else if (message.type === 'session.input_transcript.delta' && typeof message.delta === 'string') this.emit({ type: 'caption', fragment: message.delta.slice(0, 4000) });
          else if (message.type === 'error') { failed(); this.emit({ type: 'error' }); }
        } catch { failed(); }
      };
      channel.onclose = () => { failed(); this.resolveClosed?.(false); if (!this.closePromise) void this.close(); };
      // Handle early rejection even while ICE/fetch is pending.
      void waiting.catch(() => {});
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      await this.gather(peer, startupSignal);
      if (this.closePromise || startupSignal.aborted) throw new Error('Cancelled');
      const response = await this.deps.http('/api/atenea-voz/session', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}) },
        // Do not abort a possibly successful create: receive its ID, then close if cancelled.
        signal: AbortSignal.timeout(25000), body: JSON.stringify({ requestId, mode, consent, sdp: peer.localDescription?.sdp }),
      });
      if (!response.ok) throw new Error('Live unavailable');
      const answer = await response.json();
      if (this.closePromise || startupSignal.aborted) {
        const confirmed = await this.remoteClose(requestId, accessToken);
        this.emit({ type: 'closed', confirmed }); throw new Error('Cancelled');
      }
      await peer.setRemoteDescription({ type: 'answer', sdp: answer.transport.sdp });
      await Promise.race([waiting, new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error('Live start timeout')), 10000);
        void waiting.finally(() => clearTimeout(timer)).catch(() => {});
      })]);
      if (this.closePromise || startupSignal.aborted) throw new Error('Cancelled');
      this.durationTimer = setTimeout(() => { void this.close(); }, LIVE_MAX_SECONDS * 1000);
      this.emit({ type: 'active' });
    } catch { this.emit({ type: 'error' }); await this.close(); throw new Error('Live connection unavailable'); }
  }
  private gather(peer: RTCPeerConnection, signal: AbortSignal): Promise<void> {
    if (peer.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const finish = (ok: boolean) => { clearTimeout(timer); peer.removeEventListener('icegatheringstatechange', check); signal.removeEventListener('abort', abort); if (ok) resolve(); else reject(new Error('ICE incomplete')); };
      const check = () => { if (peer.iceGatheringState === 'complete') finish(true); };
      const abort = () => finish(false); const timer = setTimeout(abort, 10000);
      peer.addEventListener('icegatheringstatechange', check); signal.addEventListener('abort', abort, { once: true }); check();
    });
  }
  pause(paused: boolean) {
    this.stream?.getAudioTracks().forEach(track => { track.enabled = !paused; });
    if (this.audio) this.audio.muted = paused;
    if (this.ready && this.channel?.readyState === 'open') {
      try { this.channel.send(JSON.stringify({ type: paused ? 'session.input_audio.mute' : 'session.input_audio.unmute' })); }
      catch { void this.close(); }
    }
  }
  private async remoteClose(requestId = this.requestId, accessToken = this.accessToken) {
    if (!requestId) return false;
    try {
      const response = await this.deps.http('/api/atenea-voz/session', { method: 'DELETE', keepalive: true, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        signal: AbortSignal.timeout(15000), body: JSON.stringify({ requestId }) });
      return response.ok && (await response.json()).confirmed === true;
    } catch { return false; }
  }
  close(alreadyConfirmed = false): Promise<boolean> {
    if (this.closePromise) return this.closePromise;
    this.startupAbort.abort();
    if (this.durationTimer) clearTimeout(this.durationTimer); this.durationTimer = null;
    this.unbindTracks?.(); this.unbindTracks = null;
    // Stop capture/playback immediately, but retain the transport for remote finalization.
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    if (this.audio) { this.audio.pause(); this.audio.srcObject = null; }
    this.closePromise = Promise.resolve().then(async () => {
      let confirmed = alreadyConfirmed;
      if (!confirmed && this.ready && this.channel?.readyState === 'open') {
        const terminal = new Promise<boolean>(resolve => { this.resolveClosed = resolve; });
        try { this.channel.send(JSON.stringify({ type: 'session.close' })); }
        catch { this.resolveClosed?.(false); }
        let timer: ReturnType<typeof setTimeout> | undefined;
        confirmed = await Promise.race([terminal, new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 2000); })]);
        if (timer) clearTimeout(timer);
      }
      // Always notify the authenticated backend: ownership and persistent lock release are server-owned.
      const backendConfirmed = await this.remoteClose(); confirmed ||= backendConfirmed;
      if (this.channel) { this.channel.onmessage = null; this.channel.onclose = null; this.channel.close(); }
      if (this.peer) { this.peer.ontrack = null; this.peer.onconnectionstatechange = null; this.peer.close(); }
      this.peer = null; this.channel = null; this.audio = null; this.ready = false; this.resolveClosed = null;
      this.cancelStart?.(); this.cancelStart = null; this.accessToken = ''; this.requestId = '';
      this.emit({ type: 'closed', confirmed }); return confirmed;
    });
    return this.closePromise;
  }
}

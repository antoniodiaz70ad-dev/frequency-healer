import WebSocket from 'ws';
import { facilitatorPolicy, introduction, type Mode } from './contracts';
import { readBounded } from '../voice/serverBoundary';
import type { LiveProvider } from './liveTypes';

export class OpenAILiveProvider implements LiveProvider {
  constructor(private key: string, private http: typeof fetch = fetch,
    private socketFactory = (url: string, options: WebSocket.ClientOptions) => new WebSocket(url, options)) {}
  async create(sdp: string, mode: Mode, user: string) {
    // No automatic retry: a timeout can leave a billable session on the provider.
    const response = await this.http('https://api.openai.com/v1/live/sessions', {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json', 'OpenAI-Safety-Identifier': user },
      body: JSON.stringify({
        session: { model: 'gpt-live-1', store: false, audio: { output: { voice: 'marin' } },
          instructions: `${facilitatorPolicy} Modo inicial: ${mode}. ${introduction[mode]} Tolera pausas de 60 segundos. No llenes silencios ni delegues análisis automáticamente.`,
          delegation: { type: 'client' },
          // A modified browser cannot enable hosted tools, change policy, or trigger paid delegation.
          client: { data_channel: { allowed_client_events: ['session.close', 'session.input_audio.mute', 'session.input_audio.unmute'],
            allowed_server_events: [{ type: 'session.started' }, { type: 'session.closed' }, { type: 'session.input_transcript.delta' }, { type: 'error' }] } },
        }, transport: { type: 'webrtc', sdp },
      }),
    });
    if (!response.ok) throw new Error('Live creation unavailable');
    const result = JSON.parse(new TextDecoder().decode(await readBounded(response.body, 65536)));
    if (typeof result.session?.id !== 'string' || !/^[a-zA-Z0-9_-]{1,256}$/.test(result.session.id) ||
        result.transport?.type !== 'webrtc' || typeof result.transport.sdp !== 'string' || !result.transport.sdp.startsWith('v=0')) throw new Error('Invalid Live response');
    return { id: result.session.id as string, sdp: result.transport.sdp as string };
  }
  close(id: string): Promise<boolean> {
    if (!/^[a-zA-Z0-9_-]{1,256}$/.test(id)) return Promise.resolve(false);
    return new Promise(resolve => {
      const socket = this.socketFactory(`wss://api.openai.com/v1/live/sessions/${encodeURIComponent(id)}/attach`, {
        headers: { Authorization: `Bearer ${this.key}` }, handshakeTimeout: 5000, maxPayload: 65536,
      });
      let done = false;
      const finish = (confirmed: boolean) => { if (done) return; done = true; clearTimeout(timer); socket.terminate(); resolve(confirmed); };
      const timer = setTimeout(() => finish(false), 12000);
      socket.on('message', data => {
        try { const event = JSON.parse(data.toString()); if (event.type === 'session.closed') finish(true); } catch { finish(false); }
      });
      socket.once('open', () => socket.send(JSON.stringify({ type: 'session.close' })));
      socket.once('error', () => finish(false)); socket.once('close', () => finish(false));
    });
  }
}

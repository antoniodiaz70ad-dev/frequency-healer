import { introduction, type AnalysisAdapter, type Microphone, type Mode, type Snapshot, type VoiceAdapter, type VoiceEvent } from './contracts';

const activeStates = ['active', 'paused'];
const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!.,;:]/g, '').replace(/^atenea\s*/, '').trim();

export class AteneaSession {
  private snapshot: Snapshot = { state: 'idle', mode: 'observador', message: '', microphone: false, consent: 'none', summary: '', proPending: false };
  private listeners = new Set<() => void>();
  private run = 0;
  private abort = new AbortController();
  private analysisAbort: AbortController | null = null;
  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastPrompt = '';
  private context = '';
  private analysisBusy = false;
  private analyses = 0;
  private proAnalyses = 0;
  constructor(private voice: VoiceAdapter, private analysis: AnalysisAdapter, private microphone?: Microphone) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(values: Partial<Snapshot>) { this.snapshot = { ...this.snapshot, ...values }; this.listeners.forEach(fn => fn()); }
  private say(message: string) { this.lastPrompt = message; this.voice.say(message); this.update({ message }); }
  async start(mode: Mode, consent: boolean, useMicrophone: boolean) {
    if (!consent || !['idle', 'ended', 'error'].includes(this.snapshot.state)) return;
    const run = ++this.run;
    this.abort = new AbortController();
    this.context = ''; this.analyses = 0; this.proAnalyses = 0;
    this.update({ mode, state: 'requesting_permission', consent: 'none', summary: '', proPending: false, message: '' });
    try {
      if (useMicrophone) {
        if (!this.microphone) throw new Error('Micrófono no disponible');
        const stream = await this.microphone.open();
        if (run !== this.run) { stream.getTracks().forEach(t => t.stop()); return; }
        this.stream = stream;
        stream.getTracks().forEach(track => { track.onended = () => this.fail(); });
      }
      this.update({ state: 'connecting', microphone: Boolean(this.stream) });
      await this.voice.connect(this.stream, this.abort.signal, event => { if (run === this.run) this.event(event); });
      if (run !== this.run) return;
      this.update({ state: 'active' });
      this.say(introduction[mode]);
      // Hard local session ceiling, never a silence-triggered response.
      this.timer = setTimeout(() => this.end(), 10 * 60 * 1000);
    } catch { if (run === this.run) this.fail(); }
  }
  event(event: VoiceEvent) {
    if (!activeStates.includes(this.snapshot.state)) return;
    if (event.type === 'disconnected') { this.fail(); return; }
    if (event.type === 'speech_started') { this.voice.interrupt(); this.cancelAnalysis(); return; }
    if (!event.final || event.text.length > 4000) return;
    const command = normalize(event.text);
    if (['terminar', 'finalizar', 'cerrar sesion'].includes(command)) { this.end(); return; }
    if (command === 'no guardar') { this.update({ consent: 'none', summary: '', proPending: false }); return; }
    if (command === 'pausa') { this.pause(); return; }
    if (command === 'continua') { this.resume(); return; }
    if (this.snapshot.state === 'paused') return;
    this.voice.interrupt();
    if (['mas silencio', 'menos voz', 'silencio'].includes(command)) { this.cancelAnalysis(); this.update({ message: 'Silencio. El micrófono sigue activo si lo autorizaste; di continúa o terminar.' }); return; }
    if (command === 'repite') { this.say(this.lastPrompt); return; }
    const mode: Mode | undefined = command === 'modo observador' || command === 'vuelve al modo observador' ? 'observador' : command === 'necesito decidir' ? 'decision' : command === 'diario hablado' ? 'diario' : undefined;
    if (mode) { this.cancelAnalysis(); this.context = ''; this.update({ mode, proPending: false }); this.say(introduction[mode]); return; }
    if (command === 'guarda solo el resumen') { this.update({ consent: 'summary', message: 'Revisa y edita el resumen antes de descargarlo. Nada se guarda automáticamente.' }); return; }
    if (command === 'solo metricas') { this.update({ consent: 'metrics', summary: '' }); return; }
    if (command === 'profundiza') { this.update({ proPending: true }); this.say('El análisis profundo requiere confirmación y tiene un límite. Di confirmar profundizar o cancelar.'); return; }
    if (command === 'cancelar') { this.cancelAnalysis(); this.update({ proPending: false }); return; }
    if (command === 'confirmar profundizar') { if (this.snapshot.proPending) void this.delegate(true); return; }
    if (command === 'analiza') { void this.delegate(false); return; }
    this.context = event.text; // Latest turn only, memory only; never persisted or logged.
    this.say(this.snapshot.mode === 'decision' ? '¿Qué parte es un hecho y qué parte es tu interpretación?' : this.snapshot.mode === 'diario' ? '¿Qué te gustaría rescatar de lo que acabas de contar?' : 'Nota lo que tú observas, sin necesidad de interpretarlo. Podemos continuar en silencio.');
  }
  private async delegate(pro: boolean) {
    if (this.analysisBusy || this.analyses >= 3 || (pro && this.proAnalyses >= 1) || !this.context) {
      this.update({ proPending: false, message: 'Análisis no disponible: aporta contexto o espera; máximo tres análisis y uno profundo por sesión simulada.' }); return;
    }
    this.analyses++; if (pro) this.proAnalyses++;
    this.analysisBusy = true;
    const abort = new AbortController(); this.analysisAbort = abort; const run = this.run;
    this.update({ proPending: false, message: 'Puedes continuar en silencio mientras se prepara el análisis simulado.' });
    try {
      const answer = await this.analysis.analyze({ context: this.context, level: pro ? 'pro' : 'standard', explicitlyConfirmed: pro }, abort.signal);
      if (run === this.run && !abort.signal.aborted && this.snapshot.state === 'active') this.say(answer);
    } catch { if (run === this.run && !abort.signal.aborted) this.update({ message: 'Análisis no disponible. Puedes continuar sin IA.' }); }
    finally { if (this.analysisAbort === abort) { this.analysisBusy = false; this.analysisAbort = null; } }
  }
  private cancelAnalysis() { this.analysisAbort?.abort(); this.analysisAbort = null; this.analysisBusy = false; }
  pause() {
    if (this.snapshot.state !== 'active') return;
    this.cancelAnalysis(); this.voice.pause(true);
    this.stream?.getTracks().forEach(t => { t.enabled = false; });
    this.update({ state: 'paused', microphone: false, proPending: false, message: 'Pausa: micrófono silenciado. Usa Continuar o Terminar; las órdenes de voz se simulan en esta versión.' });
  }
  resume() {
    if (!activeStates.includes(this.snapshot.state)) return;
    this.voice.pause(false); this.stream?.getTracks().forEach(t => { t.enabled = true; });
    this.update({ state: 'active', microphone: Boolean(this.stream), message: 'Continúa cuando quieras.' });
  }
  editSummary(summary: string) { this.update({ summary: summary.slice(0, 2000) }); }
  setConsent(consent: Snapshot['consent']) { this.update({ consent, ...(consent !== 'summary' ? { summary: '' } : {}) }); }
  approvedExport() {
    if (this.snapshot.consent === 'none') return null;
    return { version: 'atenea-local-summary-v1', mode: this.snapshot.mode, consentScope: this.snapshot.consent, ...(this.snapshot.consent === 'summary' ? { summary: this.snapshot.summary } : {}) };
  }
  end() {
    ++this.run; this.update({ state: 'ending' }); this.abort.abort(); this.cancelAnalysis();
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    this.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); }); this.stream = null;
    this.voice.close(); this.context = ''; this.lastPrompt = '';
    this.update({ state: 'ended', microphone: false, proPending: false, message: 'Sesión finalizada. Micrófono y simulador cerrados.' });
  }
  private fail() { this.end(); this.update({ state: 'error', message: 'Conexión o micrófono no disponible. Puedes reintentar o practicar sin micrófono.' }); }
}

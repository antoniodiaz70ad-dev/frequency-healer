export interface NativeSpeechResult { text: string; confidence?: number }

type SpeechRecognitionAlternative = { transcript: string; confidence?: number };
type SpeechRecognitionResult = { readonly length: number; isFinal: boolean; item(index: number): SpeechRecognitionAlternative; [index: number]: SpeechRecognitionAlternative };
type SpeechRecognitionEvent = Event & { resultIndex: number; results: { readonly length: number; item(index: number): SpeechRecognitionResult; [index: number]: SpeechRecognitionResult } };
type SpeechRecognitionErrorEvent = Event & { error?: string; message?: string };
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onaudioend: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onstart: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechWindow = typeof globalThis & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function getNativeSpeechRecognition(): SpeechRecognitionConstructor | null {
  const scope = globalThis as SpeechWindow;
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function supportsNativeSpeechRecognition() {
  return getNativeSpeechRecognition() !== null;
}

const aborted = () => new DOMException('Dictado cancelado', 'AbortError');

export class NativeSpeechController {
  private recognition: SpeechRecognitionLike | null = null;
  private busy = false;

  listen(signal: AbortSignal, onListening: () => void, lang = 'es-MX'): Promise<NativeSpeechResult> {
    if (this.busy) throw new Error('Ya hay una captura activa.');
    if (signal.aborted) throw aborted();
    const Constructor = getNativeSpeechRecognition();
    if (!Constructor) throw new Error('Este navegador no ofrece dictado nativo. Escribe tu texto.');
    this.busy = true;
    const recognition = new Constructor();
    this.recognition = recognition;
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    return new Promise((resolve, reject) => {
      let transcript = '';
      let confidence: number | undefined;
      let settled = false;
      const cleanup = () => {
        signal.removeEventListener('abort', abort);
        recognition.onaudioend = null;
        recognition.onend = null;
        recognition.onerror = null;
        recognition.onresult = null;
        recognition.onstart = null;
        if (this.recognition === recognition) this.recognition = null;
        this.busy = false;
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        const text = transcript.trim();
        if (!text) reject(new Error('No se detectó voz. Intenta de nuevo o escribe tu intención.'));
        else resolve({ text, confidence });
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const abort = () => {
        if (settled) return;
        settled = true;
        try { recognition.abort(); } catch {}
        cleanup();
        reject(aborted());
      };
      signal.addEventListener('abort', abort, { once: true });
      recognition.onstart = () => onListening();
      recognition.onresult = (event) => {
        let next = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const alternative = result?.[0] ?? result?.item?.(0);
          if (alternative?.transcript) {
            next += alternative.transcript;
            if (typeof alternative.confidence === 'number') confidence = alternative.confidence;
          }
        }
        if (next.trim()) transcript = next;
      };
      recognition.onerror = (event) => {
        const code = event.error ?? 'unknown';
        if (code === 'not-allowed' || code === 'service-not-allowed') fail(new DOMException('Permiso denegado', 'NotAllowedError'));
        else if (code === 'no-speech') fail(new Error('No se detectó voz. Intenta de nuevo o escribe tu intención.'));
        else fail(new Error(event.message || `No se pudo usar el dictado nativo (${code}). Usa texto.`));
      };
      recognition.onend = finish;
      try { recognition.start(); } catch (error) { fail(error as Error); }
    });
  }

  stop() { this.recognition?.stop(); }
  cancel() { this.recognition?.abort(); this.recognition = null; this.busy = false; }
}

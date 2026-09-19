'use client';
import { useEffect, useRef, useState } from 'react';
import { VoiceCaptureController, type VoiceBlob } from '@/lib/voice/capture';
import { ServerTranscriptionProvider } from '@/lib/voice/transcription';
import { countTechnical } from '@/lib/voice/privacy';
import styles from './voice.module.css';
type Phase = 'requesting_permission' | 'listening' | 'transcribing';
interface Props {
  kind: VoiceBlob['kind']; remoteEnabled: boolean;
  onText: (text: string) => void; onPhase?: (phase: Phase) => void;
  beforeCapture?: () => Promise<boolean>; afterCapture?: () => void;
  onCancel?: () => void;
}
export default function VoiceCapture({ kind, remoteEnabled, onText, onPhase, beforeCapture, afterCapture, onCancel }: Props) {
  const [capture] = useState(() => new VoiceCaptureController());
  const current = useRef<AbortController | null>(null); const held = useRef(false);
  const [phase, setPhase] = useState<Phase | null>(null); const [error, setError] = useState(''); const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const cancel = () => { current.current?.abort(); capture.cancel(); };
    const hidden = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', cancel);
    return () => { cancel(); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', cancel); };
  }, [capture]);
  useEffect(() => { if (phase !== 'listening') return; const start = performance.now(); const timer = setInterval(() => setElapsed((performance.now() - start) / 1000), 200); return () => clearInterval(timer); }, [phase]);
  const begin = async () => {
    if (current.current) return;
    const run = new AbortController(); current.current = run; held.current = true; setError(''); setElapsed(0);
    const update = (p: Phase) => { setPhase(p); onPhase?.(p); };
    try {
      update('requesting_permission');
      if (beforeCapture && !(await beforeCapture())) throw new DOMException('Cancelado', 'AbortError');
      if (!held.current || run.signal.aborted) return;
      const input = await capture.capture(kind, run.signal, () => update('listening'));
      afterCapture?.(); run.signal.throwIfAborted();
      if (!remoteEnabled) { setError('Captura terminada y descartada. Sin proveedor de transcripción: escribe tus palabras abajo.'); onText(''); return; }
      update('transcribing');
      const result = await new ServerTranscriptionProvider().transcribe(input, run.signal);
      if (!run.signal.aborted) onText(result.text);
    } catch (e) {
      if (!run.signal.aborted && (e as Error).name !== 'AbortError') {
        if ((e as Error).name === 'NotAllowedError') { countTechnical('voice_permission_denied'); setError('Permiso denegado. Puedes escribir o habilitar el micrófono en tu navegador.'); }
        else { countTechnical('capture_failed'); setError((e as Error).message || 'Micrófono no disponible. Usa texto.'); }
        onText('');
      }
    } finally {
      afterCapture?.();
      if (current.current === run) { current.current = null; held.current = false; setPhase(null); }
    }
  };
  const release = () => { held.current = false; if (phase === 'requesting_permission') { current.current?.abort(); onCancel?.(); } else capture.stop(); };
  const cancel = () => { held.current = false; current.current?.abort(); capture.cancel(); afterCapture?.(); setPhase(null); onCancel?.(); };
  return <div>
    <button type="button" aria-pressed={phase === 'listening'} disabled={phase === 'transcribing'} style={{ touchAction: 'none', userSelect: 'none' }}
      onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); void begin(); }}
      onPointerUp={release} onPointerCancel={cancel} onLostPointerCapture={() => { if (held.current) release(); }}
      onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); void begin(); } }}
      onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); release(); } }} onBlur={() => { if (held.current) cancel(); }}>
      {phase === 'listening' ? 'Grabando — suelta para terminar' : phase === 'transcribing' ? 'Transcribiendo…' : 'Mantén presionado para hablar'}
    </button>
    {phase && <><p role="status" className={phase === 'listening' ? styles.recording : ''}>{phase === 'listening' ? `● Micrófono activo · ${elapsed.toFixed(0)} s / ${kind === 'intention' ? 60 : 30} s` : phase === 'requesting_permission' ? 'Solicitando micrófono…' : 'Micrófono apagado. Transcribiendo…'}</p><button type="button" onClick={cancel}>Cancelar captura</button></>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <p className={styles.muted}>{remoteEnabled ? 'Solo esta captura se envía al proveedor configurado. Revisa la transcripción antes de continuar.' : 'Sin transcripción remota configurada. Puedes grabar; el audio se descarta y puedes escribir el texto.'}</p>
  </div>;
}

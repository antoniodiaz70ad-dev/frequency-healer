'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { VoiceOrchestrator } from '@/lib/voice/orchestrator';
import { RATIOS, type RatioId } from '@/lib/harmonic/math';
import type { ParsedIntentionV1, SelfRatingV1 } from '@/lib/voice/types';
import type { ProposalEdits } from '@/lib/voice/rules';
import { getAudioEngine } from '@/lib/audioEngine';
import { IntentFields, RatingFields, goalLabels, stateLabels } from './Fields';
import VoiceCapture from './VoiceCapture';
import SessionPlan from './SessionPlan';
import styles from './voice.module.css';

export default function VoiceJourney({ transcriptionEnabled = false, aiEnabled = false }: { transcriptionEnabled?: boolean; aiEnabled?: boolean }) {
  const [flow] = useState(() => new VoiceOrchestrator());
  const state = useSyncExternalStore(flow.subscribe, flow.getState, () => 'idle');
  const [useAI, setUseAI] = useState(false);
  const [words, setWords] = useState(''); const [intent, setIntent] = useState<ParsedIntentionV1 | null>(null);
  const [edits, setEdits] = useState<ProposalEdits>({}); const [experimental, setExperimental] = useState(false);
  const [before, setBefore] = useState<Partial<SelfRatingV1>>({}); const [after, setAfter] = useState<Partial<SelfRatingV1>>({});
  const [reflection, setReflection] = useState(''); const [error, setError] = useState(''); const [elapsed, setElapsed] = useState(0);
  const active = ['playing', 'marker_listening', 'starting'].includes(state);
  useEffect(() => {
    const hidden = () => { if (document.hidden && !['idle', 'reflection', 'saved', 'storage_error'].includes(flow.state)) flow.stop('hidden'); };
    const leave = () => flow.stop('pagehide');
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', leave);
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leave); flow.dispose(); };
  }, [flow]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setElapsed(flow.elapsedMs()), 250);
    return () => clearInterval(timer);
  }, [flow, active]);
  const reset = () => { flow.cancel(); setWords(''); setIntent(null); setEdits({}); setBefore({}); setAfter({}); setReflection(''); setError(''); setExperimental(false); setElapsed(0); };
  const proposal = flow.proposal;
  return <div className={styles.workspace}>
    <span className={styles.tag}>Exploración sonora · reglas locales</span><h1>Viaje por voz</h1>
    <p>Intención → propuesta → confirmación → experiencia → observación.</p>
    <p className={styles.muted}>Las relaciones son matemáticas y musicales. Tus registros describen una experiencia subjetiva; no demuestran efectos médicos ni que un tono cause un cambio.</p>
    <p role="status" aria-live="polite">{active ? 'Sesión en curso' : state === 'reflection' ? 'Sesión detenida. Reflexión opcional.' : 'Nada se reproduce sin tu confirmación.'}</p>
    {(error || flow.error) && <p role="alert" className={styles.error}>{error || flow.error}</p>}
    {state === 'idle' && <section><h2>Tu intención</h2><p>El flujo completo funciona por texto, sin micrófono ni IA.</p><button className={styles.primary} onClick={() => flow.move('review_transcript')}>Escribir intención</button></section>}
    {['review_transcript', 'interpretation_error', 'requesting_permission', 'listening', 'transcribing', 'permission_denied', 'unsupported', 'transcription_error'].includes(state) && <section><h2>1. Revisa tus palabras</h2><VoiceCapture kind="intention" remoteEnabled={transcriptionEnabled} onPhase={p => flow.move(p)} onCancel={() => { flow.cancel(); flow.move('review_transcript'); }} onText={result => { if (result) setWords(result); if (flow.state !== 'review_transcript') { flow.cancel(); flow.move('review_transcript'); } }} /><form onSubmit={async e => { e.preventDefault(); if (state === 'interpretation_error') flow.move('review_transcript'); if (useAI) await flow.interpretRemote(words); else flow.interpret(words); setIntent(flow.intent); }}><label>¿Qué quieres explorar?<textarea maxLength={500} value={words} onChange={e => setWords(e.target.value)} placeholder="Quiero explorar una decisión con claridad durante veinte minutos." required /></label>{aiEnabled && <label className={styles.check}><input type="checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)} />Enviar este texto al asistente remoto (opcional)</label>}<button type="submit" disabled={!['review_transcript', 'interpretation_error'].includes(state)}>Continuar</button><button type="button" onClick={reset}>Cancelar</button></form></section>}
    {state === 'interpreting' && <section><p role="status">Estructurando la intención…</p><button onClick={reset}>Cancelar</button></section>}
    {state === 'review_intent' && intent && <section><h2>2. Revisa la intención y el diseño</h2><form onSubmit={e => { e.preventDefault(); setExperimental(false); flow.propose(intent, edits); }}>
      <IntentFields value={intent} onChange={setIntent} />
      <div className={styles.grid}>
        <label>Base (Hz)<input type="number" min={40} max={2000} step="any" value={edits.baseHz ?? 144} onChange={e => setEdits({ ...edits, baseHz: Number(e.target.value) })} /></label>
        <label>Volumen inicial (0–100)<input type="number" min={0} max={100} value={edits.uiVolume ?? (intent.intensity === 'gentle' || intent.goal === 'sleep_preparation' ? 15 : 20)} onChange={e => setEdits({ ...edits, uiVolume: Number(e.target.value) })} /></label>
        <label>Modo<select value={edits.mode ?? 'sequence'} onChange={e => setEdits({ ...edits, mode: e.target.value as 'sequence' | 'simultaneous' })}><option value="sequence">Secuencia</option><option value="simultaneous">Simultáneo</option></select></label>
        <label>Relación<select value={edits.ratioId ?? 'rule'} onChange={e => { const next = { ...edits }; if (e.target.value === 'rule') delete next.ratioId; else next.ratioId = e.target.value as RatioId; setEdits(next); }}><option value="rule">Regla según mi objetivo</option>{Object.entries(RATIOS).filter(([id]) => id !== 'root').map(([id, r]) => <option key={id} value={id}>{r.label} ({r.p}:{r.q})</option>)}</select></label>
      </div>
      {(edits.ratioId === 'cascade-13-12' || intent.intensity === 'experimental' || intent.goal === 'creative_exploration') && <div className={styles.grid}><label>Incrementos<input type="number" min={1} max={8} value={edits.increments ?? 3} onChange={e => setEdits({ ...edits, increments: Number(e.target.value) })} /></label><label>Trayectoria<select value={edits.direction ?? 'return'} onChange={e => setEdits({ ...edits, direction: e.target.value as ProposalEdits['direction'] })}><option value="ascending">Ascendente</option><option value="descending">Descendente</option><option value="return">Expansión y retorno</option></select></label></div>}
      <button type="submit">Generar propuesta</button><button type="button" onClick={() => flow.move('review_transcript')}>Volver al texto</button>
    </form></section>}
    {['review_session', 'audio_error'].includes(state) && proposal && <section><h2>3. Propuesta para confirmar</h2>
      <p><strong>{proposal.intent.intention}</strong></p><p>{goalLabels[proposal.intent.goal]} · {proposal.intent.desiredStates.map(s => stateLabels[s]).join(', ') || 'Sin estado específico'}</p>
      <p className={styles.muted}>Fuente: {proposal.source === 'local-rule' ? 'regla local' : 'selección del usuario sobre regla local'} · {proposal.ruleId} · {proposal.ruleVersion}</p>
      {proposal.rationale.map(r => <p key={r}>{r}</p>)}<SessionPlan config={proposal.harmonicConfig} schedule={proposal.schedule} />
      {proposal.warnings.map(w => <p key={w} className={styles.muted}>{w}</p>)}<RatingFields title="Antes de empezar" value={before} onChange={setBefore} />
      {proposal.requiresExplicitExperimentalConsent && <label className={styles.check}><input type="checkbox" checked={experimental} onChange={e => setExperimental(e.target.checked)} />Acepto explorar la cascada o intensidad experimental, sin promesas de resultados.</label>}
      <button className={styles.primary} disabled={proposal.requiresExplicitExperimentalConsent && !experimental} onClick={async () => { setError(''); try { if (state === 'audio_error') flow.move('review_session'); getAudioEngine().stopProtocol(); await flow.start(experimental, before); } catch (e) { setError((e as Error).message); } }}>Confirmar e iniciar</button>
      <button onClick={() => { if (state === 'audio_error') flow.move('review_session'); flow.move('review_intent'); }}>Editar propuesta</button><button onClick={reset}>Cancelar</button>
    </section>}
    {active && proposal && <section><h2>{state === 'starting' ? 'Preparando audio…' : 'Exploración en curso'}</h2><progress className={styles.progress} aria-label="Progreso de la sesión" value={elapsed} max={proposal.schedule.durationSeconds * 1000} /><p>{Math.floor(elapsed / 60000)}:{String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')} / {proposal.intent.durationMinutes} min</p><p>Micrófono apagado. Puedes detenerte en cualquier momento.</p><button className={styles.stop} onClick={() => flow.stop('user')}>Detener sesión</button></section>}
    {state === 'reflection' && <section><h2>4. ¿Qué cambió desde el inicio?</h2><RatingFields title="Después de la sesión" value={after} onChange={setAfter} /><VoiceCapture kind="reflection" remoteEnabled={transcriptionEnabled} onText={result => { if (result) setReflection(result); }} /><label>Reflexión opcional<textarea maxLength={500} value={reflection} onChange={e => setReflection(e.target.value)} /></label><p>Estas escalas describen tu percepción personal.</p><button onClick={reset}>Terminar sin guardar</button></section>}
  </div>;
}

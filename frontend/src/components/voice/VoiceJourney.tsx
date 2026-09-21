'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { parseCommand } from '@/lib/voice/commands';
import { VoiceOrchestrator } from '@/lib/voice/orchestrator';
import { RATIOS, type RatioId } from '@/lib/harmonic/math';
import type { ParsedIntentionV1, SelfRatingV1, VoiceSessionProposalV1, VoiceSessionRecordV1 } from '@/lib/voice/types';
import type { ProposalEdits } from '@/lib/voice/rules';
import { getAudioEngine } from '@/lib/audioEngine';
import { IntentFields, RatingFields, goalLabels, stateLabels } from './Fields';
import { VoiceStore, SESSIONS_KEY, loadSettings, saveSettings } from '@/lib/voice/storage';
import { SETTINGS_KEY } from '@/lib/voice/privacy';
import VoiceHistory, { exportJSON } from './VoiceHistory';
import VoiceCapture from './VoiceCapture';
import PersonalEvidence from '../lab/PersonalEvidence';
import { personalEvidence, guidanceBoundary } from '@/lib/guided/recommendations';
import ProtocolRationale from '../lab/ProtocolRationale';
import { protocolRationale } from '@/lib/guided/rationale';
import SessionPlan from './SessionPlan';
import styles from './voice.module.css';
import { FHPageHeader, FHPageShell } from '../ui/FHLayout';
import { DiscoveryStore, DISCOVERY_KEY } from '@/lib/discovery/storage';
import type { ProtocolDiscoveryPlanV1 } from '@/lib/discovery/model';
import { discoverySeedEvidence, evidenceFingerprint, personalSeedEvidence } from '@/lib/voice/seedSelection';
import { buildProposal } from '@/lib/voice/rules';

export default function VoiceJourney({ transcriptionEnabled = false, aiEnabled = false, buildCommit = 'local' }: { transcriptionEnabled?: boolean; aiEnabled?: boolean; buildCommit?: string }) {
  const [flow] = useState(() => new VoiceOrchestrator());
  const state = useSyncExternalStore(flow.subscribe, flow.getState, () => 'idle');
  const [records, setRecords] = useState<VoiceSessionRecordV1[]>([]); const [memory, setMemory] = useState<VoiceSessionRecordV1[]>([]); const [storageError, setStorageError] = useState(''); const [keepOriginal, setKeepOriginal] = useState(false);
  const [discoveryPlans,setDiscoveryPlans]=useState<ProtocolDiscoveryPlanV1[]>([]);
  const [marker, setMarker] = useState(''); const [markerMessage, setMarkerMessage] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [words, setWords] = useState(''); const [intent, setIntent] = useState<ParsedIntentionV1 | null>(null);
  const [edits, setEdits] = useState<ProposalEdits>({}); const [experimental, setExperimental] = useState(false);
  const [before, setBefore] = useState<Partial<SelfRatingV1>>({}); const [after, setAfter] = useState<Partial<SelfRatingV1>>({});
  const [reflection, setReflection] = useState(''); const [error, setError] = useState(''); const [elapsed, setElapsed] = useState(0);
  const [confirmationFor, setConfirmationFor] = useState<VoiceSessionProposalV1 | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const history = useRef<HTMLDetailsElement>(null);
  const active = ['playing', 'marker_listening', 'starting'].includes(state);
  useEffect(() => {
    let alive = true;
    const refresh = () => { if (!alive) return; try { setRecords(new VoiceStore(localStorage).load()); setKeepOriginal(loadSettings(localStorage).keepOriginal); setStorageError(''); void new DiscoveryStore(localStorage).load().then(rows=>{if(alive)setDiscoveryPlans(rows);}).catch(()=>{if(alive)setDiscoveryPlans([]);}); } catch (e) { setStorageError((e as Error).message); } };
    queueMicrotask(refresh);
    const changed = (e: StorageEvent) => { if (e.key === SESSIONS_KEY || e.key === SETTINGS_KEY || e.key === DISCOVERY_KEY || e.key === null) refresh(); };
    window.addEventListener('storage', changed);
    return () => { alive = false; window.removeEventListener('storage', changed); };
  }, []);
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
  const reset = () => { flow.cancel(); setConfirmationFor(null); setWords(''); setIntent(null); setEdits({}); setBefore({}); setAfter({}); setReflection(''); setError(''); setExperimental(false); setElapsed(0); setMarker(''); setMarkerMessage(''); };
  const proposal = flow.proposal;
  const evidence = useMemo(() => proposal ? personalEvidence(proposal, storageError ? null : records) : null, [proposal, records, storageError]);
  const confirming = proposal !== null && confirmationFor === proposal;
  const step = state === 'saved' ? 7 : ['reflection', 'storage_error'].includes(state) ? 6 : active ? 5 : ['review_session', 'audio_error'].includes(state) ? (confirming ? 4 : 3) : ['review_intent', 'building_session'].includes(state) ? 2 : 1;
  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => { if (state === 'storage_error' && history.current) history.current.open = true; }, [state]);
  const showHistory = () => { if (history.current) { history.current.open = true; history.current.querySelector('summary')?.focus(); } };
  const evidenceLabel = !evidence?.available ? 'Evidencia personal no disponible' : ({ none: 'Evidencia personal insuficiente', insufficient: 'Evidencia personal insuficiente', preliminary: 'Señal personal preliminar', descriptive: 'Patrón personal descriptivo' })[evidence.evidenceLevel];
  const sessionStyle = proposal?.harmonicConfig.mode === 'simultaneous' ? 'Tonos simultáneos' : 'Secuencia de tonos';
  return <FHPageShell width="narrow"><div className={`${styles.workspace} ${styles.guided}`}>
    <FHPageHeader eyebrow="Exploración sonora · reglas locales" title="Sesión guiada" description="Una intención, una propuesta revisable y una observación personal." />
    {step < 7 && <div className={styles.journeyProgress} aria-label={`Paso ${step} de 6`}><span>{String(step).padStart(2, '0')} / 06</span><i style={{ width: `${Math.min(100, step / 6 * 100)}%` }} /></div>}
    <details className={styles.technicalInfo}><summary>Información técnica</summary><p>Build: {buildCommit}</p><p>Rules: voice-rules-v2</p></details>
    {(error || flow.error) && <p role="alert" className={styles.error}>{error || flow.error}</p>}
    {['idle', 'review_transcript', 'interpretation_error', 'requesting_permission', 'listening', 'transcribing', 'permission_denied', 'unsupported', 'transcription_error'].includes(state) && <section><h2 ref={heading} tabIndex={-1}>¿Qué quieres explorar hoy?</h2><p>Puedes escribir tu intención o usar voz si lo prefieres. El micrófono es opcional.</p><form onSubmit={async e => { e.preventDefault(); const boundary = guidanceBoundary(words); if (boundary) { setError(boundary); return; } setError(''); if (state === 'idle' || state === 'interpretation_error') flow.move('review_transcript'); if (useAI) await flow.interpretRemote(words); else flow.interpret(words); setIntent(flow.intent); }}><label>¿Qué quieres explorar?<textarea maxLength={500} value={words} onChange={e => setWords(e.target.value)} placeholder="Quiero explorar una decisión con claridad durante veinte minutos." required /></label>{aiEnabled && <label className={styles.check}><input type="checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)} />Enviar este texto al asistente remoto (opcional)</label>}<button type="submit" disabled={!['idle', 'review_transcript', 'interpretation_error'].includes(state)}>Interpretar intención</button><button type="button" onClick={reset}>Cancelar</button></form><details><summary>Usar voz · opcional</summary><VoiceCapture kind="intention" remoteEnabled={transcriptionEnabled} onPhase={p => flow.move(p)} onCancel={() => { flow.cancel(); flow.move('review_transcript'); }} onText={result => { if (result) setWords(result); if (flow.state !== 'review_transcript') { flow.cancel(); flow.move('review_transcript'); } }} /></details></section>}
    {state === 'interpreting' && <section><p role="status">Estructurando la intención…</p><button onClick={reset}>Cancelar</button></section>}
    {state === 'review_intent' && intent && <section><h2 ref={heading} tabIndex={-1}>Entendimos</h2><p>{intent.intention}</p><p>Objetivo: {goalLabels[intent.goal]}</p><p>Estado buscado: {intent.desiredStates.map(s => stateLabels[s]).join(", ") || "No indicado"} · {intent.durationMinutes} minutos</p>{intent.requiresReview.length > 0 && <p role="status">Revisa y ajusta la interpretación antes de continuar.</p>}<form onSubmit={e => { e.preventDefault(); const boundary = guidanceBoundary(intent.intention); if (boundary) { setError(boundary); return; } setError(''); setExperimental(false);const baseline=buildProposal(intent,edits); flow.propose(intent, edits,{personal:personalSeedEvidence(intent,baseline.harmonicConfig,records),discovery:discoverySeedEvidence(intent,baseline.harmonicConfig,discoveryPlans),fingerprint:evidenceFingerprint(localStorage.getItem(SESSIONS_KEY),localStorage.getItem(DISCOVERY_KEY))}); }}>
      <details><summary>Cambiar interpretación</summary><IntentFields value={intent} onChange={setIntent} /></details>
      <details><summary>Ajustes armónicos avanzados</summary><div className={styles.grid}>
        <label>Base personalizada (Hz, opcional)<input type="number" min={40} max={2000} step="any" value={edits.baseHz ?? ''} placeholder="Selección automática" onChange={e => {const next={...edits};if(e.target.value==='')delete next.baseHz;else next.baseHz=Number(e.target.value);setEdits(next);}} /></label>
        <label>Volumen inicial (0–100)<input type="number" min={0} max={100} value={edits.uiVolume ?? (intent.intensity === 'gentle' || intent.goal === 'sleep_preparation' ? 15 : 20)} onChange={e => setEdits({ ...edits, uiVolume: Number(e.target.value) })} /></label>
        <label>Modo<select value={edits.mode ?? 'sequence'} onChange={e => setEdits({ ...edits, mode: e.target.value as 'sequence' | 'simultaneous' })}><option value="sequence">Secuencia</option><option value="simultaneous">Simultáneo</option></select></label>
        <label>Relación<select value={edits.ratioId ?? 'rule'} onChange={e => { const next = { ...edits }; if (e.target.value === 'rule') delete next.ratioId; else next.ratioId = e.target.value as RatioId; setEdits(next); }}><option value="rule">Regla según mi objetivo</option>{Object.entries(RATIOS).filter(([id]) => id !== 'root').map(([id, r]) => <option key={id} value={id}>{r.label} ({r.p}:{r.q})</option>)}</select></label>
      </div>
      {(edits.ratioId === 'cascade-13-12' || intent.intensity === 'experimental' || intent.goal === 'creative_exploration') && <div className={styles.grid}><label>Incrementos<input type="number" min={1} max={8} value={edits.increments ?? 3} onChange={e => setEdits({ ...edits, increments: Number(e.target.value) })} /></label><label>Trayectoria<select value={edits.direction ?? 'return'} onChange={e => setEdits({ ...edits, direction: e.target.value as ProposalEdits['direction'] })}><option value="ascending">Ascendente</option><option value="descending">Descendente</option><option value="return">Expansión y retorno</option></select></label></div>}
      </details><button type="submit">Generar recomendación</button><button type="button" onClick={() => flow.move('review_transcript')}>Volver al texto</button>
    </form></section>}
    {['review_session', 'audio_error'].includes(state) && proposal && <section>
      <h2 ref={heading} tabIndex={-1}>{confirming ? 'Lista para comenzar' : 'Sesión propuesta'}</h2>
      <p><strong>{goalLabels[proposal.intent.goal]}</strong></p><p>Frecuencia base sugerida: <strong>{proposal.harmonicConfig.baseHz} Hz</strong></p><p>{proposal.intent.durationMinutes} minutos · {{ gentle: 'Suave', deep: 'Profunda', experimental: 'Experimental' }[proposal.intent.intensity]} · {sessionStyle}</p>
      {!confirming ? <>
        <p>{evidenceLabel}.</p><p>Basada en tu intención mediante reglas locales. El historial aporta observaciones descriptivas, sin modificar esta propuesta.</p>
        <details><summary>¿Por qué esta sesión?</summary>
          <p>Explora: {proposal.intent.desiredStates.map(s => stateLabels[s]).join(', ') || proposal.intent.intention}.</p>
          <p>{proposal.source === 'local-rule' ? 'Seleccionada mediante una regla local según la intención revisada.' : 'Incluye tus ajustes sobre una regla local.'}</p>
          <ProtocolRationale summaryLabel="Detalles de la recomendación" value={protocolRationale(proposal)} config={proposal.harmonicConfig}>
            <p>Fuente: {proposal.source} · {proposal.ruleId} · {proposal.ruleVersion}</p>{proposal.rationale.map(r => <p key={r}>{r}</p>)}
            {proposal.seedSelection&&<details><summary>¿Por qué esta frecuencia base?</summary><p>{proposal.harmonicConfig.baseHz} Hz · {proposal.seedSelection.seedRegistryVersion} · {proposal.seedSelection.seedSelectionVersion}.</p><p>{proposal.seedSelection.candidates.filter(c=>c.valid).length} candidatas válidas. La tolerancia de 0.10 octava define equivalencia estructural para este producto V1; no es un umbral científico.</p><p>Esta base organiza una estructura acústica; no se considera terapéutica por sí misma.</p></details>}
          </ProtocolRationale>
          {evidence && <details><summary>Evidencia personal</summary><PersonalEvidence value={evidence}/></details>}
          <details><summary>Detalles armónicos</summary><SessionPlan config={proposal.harmonicConfig} schedule={proposal.schedule} /></details>
        </details>
        <button className={styles.primary} onClick={() => setConfirmationFor(proposal)}>Continuar</button>
        <button onClick={() => { setConfirmationFor(null); if (state === 'audio_error') flow.move('review_session'); flow.move('review_intent'); }}>Editar propuesta</button><button onClick={reset}>Cancelar</button>
      </> : <>
        <p>Volumen: {proposal.harmonicConfig.uiVolume}/100. Puedes detener la sesión en cualquier momento.</p>
        {proposal.warnings.map(w => <p key={w} className={styles.muted}>{w}</p>)}
        <details><summary>Detalles armónicos</summary><SessionPlan config={proposal.harmonicConfig} schedule={proposal.schedule} /></details>
        <details><summary>Cómo te sientes antes · opcional</summary><RatingFields title="Antes de empezar" value={before} onChange={setBefore} /></details>
        {proposal.requiresExplicitExperimentalConsent && <label className={styles.check}><input type="checkbox" checked={experimental} onChange={e => setExperimental(e.target.checked)} />Acepto explorar la cascada o intensidad experimental, sin promesas de resultados.</label>}
      <button className={styles.primary} disabled={proposal.requiresExplicitExperimentalConsent && !experimental} onClick={async () => { setError(''); try { if (state === 'audio_error') flow.move('review_session'); getAudioEngine().stopProtocol(); await flow.start(experimental, before,evidenceFingerprint(localStorage.getItem(SESSIONS_KEY),localStorage.getItem(DISCOVERY_KEY))); } catch (e) { setError((e as Error).message); } }}>Iniciar sesión</button>
        <button onClick={() => setConfirmationFor(null)}>Volver</button>
      </>}
    </section>}
    {active && proposal && <section><h2 ref={heading} tabIndex={-1}>{state === 'starting' ? 'Preparando audio…' : 'Sesión en curso'}</h2><progress className={styles.progress} aria-label="Progreso de la sesión" value={elapsed} max={proposal.schedule.durationSeconds * 1000} /><p>{Math.floor(elapsed / 60000)}:{String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')} / {proposal.intent.durationMinutes} min</p><p>{state === 'marker_listening' ? 'Captura de marcador; el volumen baja temporalmente.' : 'Micrófono apagado salvo al mantener pulsado. Puedes detenerte en cualquier momento.'}</p>
      {state !== 'starting' && <details><summary>Marcadores y volumen · opcional</summary><VoiceCapture kind="marker" remoteEnabled={transcriptionEnabled} beforeCapture={() => flow.beginMarkerCapture()} afterCapture={() => flow.endMarkerCapture()} onCancel={() => flow.cancelMarkerCapture()} onText={result => { if (result) setMarker(result); }} />
      <label>Marcador o comando (revisa antes de aplicar)<textarea maxLength={500} value={marker} onChange={e => setMarker(e.target.value)} /></label>
      <p className={styles.muted}>Comandos: “baja el volumen”, “sube el volumen”, “marca este momento”, “detén la sesión”. Las demás frases se registran como observaciones. Cambiar la arquitectura requiere detener y crear una nueva propuesta.</p>
      <button disabled={!marker.trim() || state !== 'playing'} onClick={() => { try { if (flow.applyMarker(marker) === 'confirm_stop') { setMarkerMessage('Confirma abajo para detener la sesión.'); return; } setMarker(''); setMarkerMessage('Marcador registrado. Solo se conservará si guardas la sesión.'); } catch (e) { setError((e as Error).message); } }}>Aplicar texto revisado</button>
      {parseCommand(marker).type === 'stop_session' && <button onClick={() => flow.applyMarker(marker, true)}>Confirmar detención por voz</button>}
      <p role="status">{markerMessage}</p><p>Marcadores: {flow.record?.markers.length ?? 0} · volumen {flow.engine.getVolume()}/100</p></details>}
      <button className={styles.stop} onClick={() => flow.stop('user')}>Detener sesión</button></section>}
    {['reflection', 'storage_error'].includes(state) && <section><h2 ref={heading} tabIndex={-1}>¿Cómo te sentiste?</h2><p>La sesión aún no está guardada. Las valoraciones son opcionales.</p><RatingFields title="Después de la sesión" value={after} onChange={setAfter} /><details><summary>Reflexión y opciones · opcional</summary><VoiceCapture kind="reflection" remoteEnabled={transcriptionEnabled} onText={result => { if (result) setReflection(result); }} /><label>Reflexión opcional<textarea maxLength={500} value={reflection} onChange={e => setReflection(e.target.value)} /></label><p>Estas escalas describen tu percepción personal. Al guardar se conserva la intención revisada, las escalas, los marcadores y esta reflexión; nunca el audio.</p>
      <label className={styles.check}><input type="checkbox" checked={keepOriginal} onChange={e => { setKeepOriginal(e.target.checked); try { saveSettings(localStorage, e.target.checked); } catch (error) { setStorageError((error as Error).message); } }} />Guardar también mis palabras originales de intención (opcional)</label></details>
      <button className={styles.primary} onClick={async () => {
        const record = flow.finishRecord(after, reflection, keepOriginal ? words : undefined);
        try { setRecords(await new VoiceStore(localStorage).save(record)); setMemory(rows => rows.filter(r => r.id !== record.id)); setStorageError(''); flow.move('saved'); setWords(''); }
        catch (e) { setMemory(rows => [record, ...rows.filter(r => r.id !== record.id)]); setStorageError(`No se guardó en el dispositivo. Sesión disponible en memoria para exportar. ${(e as Error).message}`); flow.move('storage_error'); }
      }}>Guardar sesión</button><button onClick={() => { if (flow.record) setMemory(rows => rows.filter(r => r.id !== flow.record!.id)); reset(); }}>Terminar sin guardar</button></section>}
    {state === 'saved' && <section><h2 ref={heading} tabIndex={-1}>Sesión guardada</h2><p role="status">Sesión guardada en este dispositivo.</p><Link href="/">Volver al inicio</Link><button onClick={showHistory}>Ver historial</button><button onClick={reset}>Nueva sesión</button></section>}
    {storageError && <p role="alert" className={styles.error}>{storageError}</p>}
    {!active && <details ref={history}><summary>Historial de sesiones</summary><VoiceHistory records={[...memory, ...records.filter(r => !memory.some(m => m.id === r.id))]} rawExport={() => { try { exportJSON({ key: SESSIONS_KEY, original: localStorage.getItem(SESSIONS_KEY) }, 'frequency-healer-voice-original.json'); } catch { setStorageError('No se puede leer el almacenamiento. Exporta las sesiones visibles.'); } }} onDelete={async id => {
      try { const store = new VoiceStore(localStorage); setRecords(id === null ? await store.clear() : await store.remove(id)); setMemory(rows => id === null ? [] : rows.filter(r => r.id !== id)); setStorageError(''); } catch (e) { setStorageError((e as Error).message); }
    }} /></details>}
  </div></FHPageShell>;
}

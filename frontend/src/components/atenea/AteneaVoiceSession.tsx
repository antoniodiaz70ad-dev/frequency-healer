'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { AteneaSession } from '@/lib/atenea/session';
import { MockVoiceAdapter, MockAnalysisAdapter } from '@/lib/atenea/mock';
import type { Mode } from '@/lib/atenea/contracts';
import styles from './atenea.module.css';

const labels = { idle: 'Lista', requesting_permission: 'Solicitando permiso', connecting: 'Conectando', active: 'Sesión activa', paused: 'En pausa', ending: 'Cerrando', ended: 'Finalizada', error: 'Error recuperable' };
export default function AteneaVoiceSession() {
  const [{ voice, session }] = useState(() => {
    const voice = new MockVoiceAdapter();
    return { voice, session: new AteneaSession(voice, new MockAnalysisAdapter(), {
      open: () => {
        if (!navigator.mediaDevices?.getUserMedia) return Promise.reject(new Error('Micrófono no compatible'));
        return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      },
    }) };
  });
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [accepted, setAccepted] = useState(false);
  const [mic, setMic] = useState(false);
  const [mode, setMode] = useState<Mode>('observador');
  const [text, setText] = useState('');
  const busy = !['idle', 'ended', 'error'].includes(snapshot.state);
  const listening = ['active', 'paused'].includes(snapshot.state);
  useEffect(() => {
    const close = () => session.end();
    window.addEventListener('pagehide', close);
    window.addEventListener('offline', close);
    return () => { window.removeEventListener('pagehide', close); window.removeEventListener('offline', close); session.end(); };
  }, [session]);
  function send(value: string) { voice.simulate({ type: 'speech_started' }); voice.simulate({ type: 'transcript', text: value, final: true }); setText(''); }
  function download() {
    const data = session.approvedExport(); if (!data) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'atenea-resumen.json'; link.click(); URL.revokeObjectURL(url);
  }
  return <main className={styles.main}>
    <p className={styles.badge}>ATENEA · Laboratorio de voz</p>
    <h1>Un espacio para escucharte</h1>
    <p>Observa, considera una decisión o expresa tu día, desde una sola pantalla.</p>
    <aside className={styles.notice}><strong>Simulación local · sin IA conectada</strong><p>Esta versión no reconoce ni reproduce voz. Los controles simulan turnos y órdenes; el micrófono opcional sirve para comprobar permisos y cierre. El audio no se graba ni se transmite. La conversación manos libres queda pendiente de pruebas con la API real.</p></aside>
    <section aria-label="Preparar sesión" className={styles.card}>
      <label>Modo <select value={mode} disabled={busy} onChange={e => setMode(e.target.value as Mode)}><option value="observador">Observador</option><option value="decision">Decisión consciente</option><option value="diario">Diario hablado</option></select></label>
      <label><input type="checkbox" checked={accepted} disabled={busy} onChange={e => setAccepted(e.target.checked)} /> Entiendo que nada se guarda automáticamente y que esto no es diagnóstico ni tratamiento.</label>
      <label><input type="checkbox" checked={mic} disabled={busy} onChange={e => setMic(e.target.checked)} /> Probar mi micrófono durante la simulación (sin grabar ni enviar audio).</label>
      <button disabled={!accepted || busy} onClick={() => void session.start(mode, accepted, mic)}>Iniciar simulación</button>
    </section>
    <section className={styles.card} aria-label="Sesión">
      <p role="status" aria-live="polite"><strong>{labels[snapshot.state]}</strong> · Micrófono {snapshot.microphone ? 'activo' : 'apagado o silenciado'} · Modo {snapshot.mode}</p>
      <p aria-live="polite">{snapshot.message || 'El micrófono está apagado. Puedes practicar sin utilizarlo.'}</p>
      <div className={styles.controls}><button disabled={!listening} onClick={() => snapshot.state === 'paused' ? session.resume() : session.pause()}>{snapshot.state === 'paused' ? 'Continuar' : 'Pausa'}</button><button disabled={!busy} onClick={() => session.end()}>Terminar</button></div>
      <form onSubmit={e => { e.preventDefault(); if (text.trim()) send(text); }}>
        <label>Simular una frase reconocida<input maxLength={4000} value={text} disabled={!listening} onChange={e => setText(e.target.value)} placeholder="ATENEA, necesito decidir" /></label>
        <button disabled={!listening || !text.trim()}>Enviar turno simulado</button>
      </form>
      <div className={styles.controls}>{['más silencio', 'continúa', 'repite', 'analiza', 'profundiza', 'terminar'].map(command => <button key={command} disabled={!listening} onClick={() => send(command)}>{command}</button>)}</div>
      {snapshot.proPending && <div><p>Confirmar análisis profundo simulado. En la API real tendrá coste adicional.</p><button onClick={() => send('confirmar profundizar')}>Confirmar profundizar</button><button onClick={() => send('cancelar')}>Cancelar</button></div>}
    </section>
    <section className={styles.card} aria-label="Privacidad y resumen">
      <h2>Solo lo que tú elijas</h2><p>Sin historial de audio ni transcripción. Puedes escribir un resumen y descargarlo, después de revisarlo. No se comparte con Base 60.</p>
      <label>Contenido permitido<select value={snapshot.consent} onChange={e => {
        // Consent is explicit even after a session ends; never inferred from silence.
        if (e.target.value === 'none') session.setConsent('none');
        else session.setConsent(e.target.value === 'metrics' ? 'metrics' : 'summary');
      }}><option value="none">No guardar</option><option value="metrics">Solo modo de sesión</option><option value="summary">Resumen revisado</option></select></label>
      {snapshot.consent === 'summary' && <label>Resumen que apruebas<textarea maxLength={2000} value={snapshot.summary} onChange={e => session.editSummary(e.target.value)} /></label>}
      <button disabled={snapshot.consent === 'none' || (snapshot.consent === 'summary' && !snapshot.summary.trim())} onClick={download}>Descargar contenido aprobado</button>
    </section>
    <p>Si prefieres una práctica sin tecnología, nota el apoyo de tus pies y el entorno. Mantén los ojos abiertos y usa este ejercicio en un lugar seguro, sin conducir.</p>
  </main>;
}

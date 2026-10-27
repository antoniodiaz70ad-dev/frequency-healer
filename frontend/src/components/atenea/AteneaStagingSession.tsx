'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LiveVoiceConnection } from '@/lib/atenea/liveConnection';
import type { StagingAccess } from '@/lib/atenea/stagingClient';
import { LIVE_CONSENT } from '@/lib/atenea/liveTypes';
import type { Mode } from '@/lib/atenea/contracts';
import styles from './atenea.module.css';

interface IdentityConfig { url: string; publishableKey: string }
export default function AteneaStagingSession({ available, loginPath, identity = null }: { available: boolean; loginPath: string | null; identity?: IdentityConfig | null }) {
  const [authenticated, setAuthenticated] = useState(false), [accepted, setAccepted] = useState(false);
  const [mode, setMode] = useState<Mode>('observador'), [busy, setBusy] = useState(false), [paused, setPaused] = useState(false);
  const [message, setMessage] = useState('Comprobando acceso de pruebas…');
  const [canLogout, setCanLogout] = useState(false), [signingOut, setSigningOut] = useState(false);
  const accessClosing = useRef(false), authenticating = useRef(false);
  const providerAccess = useRef<StagingAccess | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const revoke = () => fetch('/api/atenea-voz/access', { method: 'DELETE', credentials: 'same-origin', cache: 'no-store', redirect: 'error', keepalive: true, signal: AbortSignal.timeout(15000) });
  const connection = useRef<LiveVoiceConnection | null>(null), permission = useRef<AbortController | null>(null), mounted = useRef(false);
  const update = (text: string) => { if (mounted.current) setMessage(text); };
  useEffect(() => {
    mounted.current = true;
    const request = new AbortController();
    void fetch('/api/atenea-voz/access', { credentials: 'same-origin', cache: 'no-store', signal: request.signal }).then(async response => {
      if (!response.ok) throw new Error('Acceso no disponible');
      const status = await response.json();
      if (mounted.current && !authenticating.current && !providerAccess.current) { setAuthenticated(!identity && status.authenticated === true); setCanLogout(status.authenticated === true); setMessage(status.authenticated && !identity ? 'Acceso de pruebas verificado.' : 'Inicia sesión con el acceso de pruebas para continuar.'); }
    }).catch(() => { if (mounted.current) setMessage('El acceso de pruebas todavía no está disponible.'); });
    const stop = () => {
      permission.current?.abort(); void connection.current?.close();
      if (providerAccess.current) {
        providerAccess.current.stop(); providerAccess.current = null; void revoke().catch(() => {});
        if (mounted.current) { setAuthenticated(false); setAccepted(false); setCanLogout(true); setMessage('Acceso interrumpido. El cierre requiere verificación antes de volver a entrar.'); }
      }
    };
    window.addEventListener('pagehide', stop); window.addEventListener('offline', stop);
    return () => { mounted.current = false; request.abort(); stop(); window.removeEventListener('pagehide', stop); window.removeEventListener('offline', stop); };
  }, [identity]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identity || authenticating.current || accessClosing.current) return;
    authenticating.current = true; setLoginBusy(true);
    const form = event.currentTarget, data = new FormData(form);
    const email = String(data.get('email') ?? ''), password = String(data.get('password') ?? '');
    form.reset(); update('Verificando cuenta y sesión de aplicación…');
    try {
      const { createStagingAccess } = await import('@/lib/atenea/stagingClient');
      if (!mounted.current) return;
      const current = providerAccess.current ??= createStagingAccess(identity.url, identity.publishableKey);
      await current.login(email, password); await current.establish();
      if (mounted.current) { setAuthenticated(true); setCanLogout(true); setAccepted(false); update('Sesión de aplicación verificada. La voz requiere sus propios controles.'); }
    } catch {
      providerAccess.current?.stop(); providerAccess.current = null;
      // An exchange may have rejected a different existing owner (409).
      // Preserve that session until explicit logout; never claim success or replay the write.
      if (mounted.current) { setAuthenticated(false); setCanLogout(true); update('No se pudo confirmar el acceso de aplicación. Puedes reintentar cerrar el acceso.'); }
    } finally { authenticating.current = false; if (mounted.current) setLoginBusy(false); }
  }
  async function renew() {
    if (!providerAccess.current || authenticating.current || accessClosing.current) return;
    authenticating.current = true; setLoginBusy(true);
    try { await providerAccess.current.establish(); update('Acceso renovado.'); }
    catch { if (mounted.current) setAuthenticated(false); update('No se pudo renovar el acceso. Cierra el acceso antes de volver a entrar.'); }
    finally { authenticating.current = false; if (mounted.current) setLoginBusy(false); }
  }
  async function start() {
    if (!available || !authenticated || !accepted || permission.current || authenticating.current || accessClosing.current) return;
    const controller = new AbortController(); permission.current = controller; setBusy(true); setPaused(false);
    let started = false, acquired: MediaStream | null = null;
    try {
      if (identity) {
        if (!providerAccess.current) throw new Error('Provider identity unavailable');
        await providerAccess.current.establish(660);
        if (controller.signal.aborted) return;
      }
      update('Solicitando permiso de micrófono…');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      acquired = stream;
      if (controller.signal.aborted) { stream.getTracks().forEach(track => track.stop()); return; }
      const transport = new LiveVoiceConnection(event => {
        if (connection.current !== transport) return;
        if (event.type === 'active') update('Conversación remota activa. Puedes pausar o terminar aquí.');
        if (event.type === 'closed') {
          update(event.confirmed ? 'Micrófono apagado y cierre remoto confirmado.' : 'Micrófono apagado. Cierre remoto sin confirmar; requiere seguimiento del entorno de pruebas.');
          if (mounted.current) { setBusy(false); setAccepted(false); }
          if (connection.current === transport) { connection.current = null; permission.current = null; }
        }
        if (event.type === 'error') update('No se pudo completar la conexión. Puedes terminar o reintentar.');
        // Captions are intentionally not retained or interpreted as consent/final commands.
      });
      connection.current = transport;
      await transport.start(mode, stream, LIVE_CONSENT, controller.signal);
      started = true;
    } catch { if (permission.current === controller) update('No se pudo iniciar la conversación. Micrófono apagado; revisa el acceso de pruebas.'); }
    finally {
      if (!started || controller.signal.aborted) {
        acquired?.getTracks().forEach(track => track.stop());
        if (permission.current === controller) {
          permission.current = null; connection.current = null;
          if (mounted.current) setBusy(false);
        }
      }
    }
  }
  async function stop() {
    permission.current?.abort();
    await connection.current?.close(); connection.current = null; permission.current = null;
    if (mounted.current) { setBusy(false); setPaused(false); setAccepted(false); }
  }
  async function logout() {
    if (accessClosing.current || authenticating.current) return;
    accessClosing.current = true; setSigningOut(true); setAuthenticated(false);
    providerAccess.current?.cancelRequests();
    await stop();
    try {
      const response = await revoke();
      const result = await response.json();
      if (mounted.current) setCanLogout(!response.ok);
      update(response.ok && result.remoteConfirmed ? 'Acceso cerrado y audio remoto finalizado.' : 'Acceso local cerrado. La revocación o el cierre remoto requieren verificación.');
    } catch { update('Micrófono apagado. No se pudo confirmar la revocación del acceso. Puedes reintentar cerrar el acceso.'); }
    finally {
      try { await providerAccess.current?.logout(); } catch { update('Sesión local cerrada; cierre del proveedor sin confirmar.'); if (mounted.current) setCanLogout(true); }
      providerAccess.current?.stop(); providerAccess.current = null;
      accessClosing.current = false; if (mounted.current) setSigningOut(false); }
  }
  return <main className={styles.main}>
    <p className={styles.badge}>ATENEA · Entorno de pruebas</p><h1>Prueba de conversación remota</h1>
    <p role="status" aria-live="polite">{message}</p>
    {!available && <aside className={styles.notice}>La voz remota está deshabilitada. Esta pantalla no la activa ni configura servicios.</aside>}
    {!identity && !authenticated && loginPath && <a href={loginPath}>Iniciar sesión de pruebas</a>}
    {identity && !authenticated && <form className={styles.card} onSubmit={login}>
      <label>Correo de prueba<input type="email" name="email" autoComplete="off" maxLength={254} required /></label>
      <label>Contraseña<input type="password" name="password" autoComplete="off" maxLength={256} required /></label>
      <button disabled={loginBusy || signingOut}>Entrar a pruebas</button>
      <p>Credenciales solo para este proyecto de pruebas. Los tokens del proveedor permanecen en memoria; la sesión de aplicación usa una cookie HttpOnly con vencimiento. Recargar requiere volver a entrar.</p>
    </form>}
    {identity && authenticated && <button disabled={busy || loginBusy || signingOut} onClick={() => void renew()}>Renovar acceso</button>}
    <section className={styles.card}>
      <label>Modo <select value={mode} disabled={busy} onChange={event => setMode(event.target.value as Mode)}><option value="observador">Observador</option><option value="decision">Decisión consciente</option><option value="diario">Diario hablado</option></select></label>
      <p>Al iniciar, el audio se enviará al proveedor de voz configurado. La aplicación no guarda audio ni transcripciones. El proveedor aplica las condiciones de retención revisadas para este entorno. No uses información sensible durante las pruebas.</p>
      <label><input type="checkbox" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)} /> Autorizo enviar audio para esta sesión de prueba remota. Entiendo que el consentimiento del simulador no sirve para esta conexión.</label>
      <button disabled={!available || !authenticated || !accepted || busy || loginBusy || signingOut} onClick={() => void start()}>Iniciar prueba remota</button>
      <button disabled={!busy} onClick={() => { const next = !paused; connection.current?.pause(next); setPaused(next); }}> {paused ? 'Continuar' : 'Pausa'} </button>
      <button disabled={!busy} onClick={() => void stop()}>Terminar</button>
      <button disabled={!canLogout || signingOut || loginBusy} onClick={() => void logout()}>Cerrar acceso de pruebas</button>
    </section>
    <p>Usa un lugar seguro y estacionario. Durante esta preparación, utiliza Terminar: los fragmentos de voz todavía no acreditan órdenes verbales finales. Estas pruebas no guardan ni comparten contenido con Base 60.</p>
  </main>;
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { FHSurface } from '@/components/ui/FHLayout';
import { composerCloudClient, supabaseComposerCloud } from '@/lib/marina/composerCloud';
import { bindComposer, COMPOSER_CHANGED, readSyncBinding, synchronizeComposer, type SyncBinding } from '@/lib/marina/composerSync';
import styles from './marina.module.css';

/** Account state never changes the playing recipe or starts an audio source. */
export default function ComposerAccount({ onRefresh }: { onRefresh: () => void }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [binding, setBinding] = useState<SyncBinding | null>(null);
  const [email, setEmail] = useState(''), [token, setToken] = useState(''), [sent, setSent] = useState(false);
  const [status, setStatus] = useState('Preparando tu cuenta…'), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const generation = useRef(0), syncing = useRef(false), rerun = useRef(false), refresh = useRef(onRefresh);
  const live = useRef<{ client: SupabaseClient | null; session: Session | null }>({ client: null, session: null });
  useEffect(() => { refresh.current = onRefresh; }, [onRefresh]);
  const sync = useCallback(async function runSync() {
    const current = live.current;
    if (!current.client || !current.session || document.visibilityState === 'hidden') return;
    if (syncing.current) { rerun.current = true; return; }
    let link: SyncBinding | null;
    try { link = readSyncBinding(localStorage); }
    catch (e) { setError((e as Error).message); return; }
    if (!link?.enabled || link.userId !== current.session.user.id) return;
    syncing.current = true; const ticket = generation.current;
    setStatus('Sincronizando…'); setError('');
    try {
      const result = await synchronizeComposer(localStorage, supabaseComposerCloud(current.client), current.session.user.id, () => generation.current === ticket);
      if (generation.current !== ticket) return;
      setBinding(readSyncBinding(localStorage)); setPending(false);
      setStatus(result.conflicts ? `Sincronizado. Se conservaron ${result.conflicts} versiones distintas.` : 'Sincronizado');
      refresh.current();
    } catch (e) {
      if (generation.current === ticket) { setPending(true); setStatus('Cambios pendientes de sincronizar'); setError((e as Error).message); refresh.current(); }
    } finally {
      syncing.current = false;
      if (rerun.current) { rerun.current = false; window.setTimeout(() => void runSync(), 0); }
    }
  }, []);
  useEffect(() => {
    const generationRef = generation;
    let supabase: SupabaseClient | null = null, unsubscribe = () => {};
    const timer = window.setTimeout(() => {
      try {
        supabase = composerCloudClient(); setClient(supabase); live.current.client = supabase;
        setBinding(readSyncBinding(localStorage));
        if (!supabase) { setStatus('Cuenta privada pendiente de configuración'); return; }
        const { data } = supabase.auth.onAuthStateChange((_event, next) => {
          if (live.current.session?.user.id !== next?.user.id) generationRef.current++;
          live.current.session = next; setSession(next); setError('');
          setStatus(next ? 'Cuenta conectada' : 'Entra para sincronizar tus dispositivos');
          window.setTimeout(() => void sync(), 0);
        });
        unsubscribe = () => data.subscription.unsubscribe();
      } catch (e) { setError((e as Error).message); setStatus('Tus datos locales siguen disponibles'); }
    }, 0);
    const changes = () => { setPending(true); void sync(); };
    const visible = () => { if (document.visibilityState === 'visible') void sync(); };
    const interval = window.setInterval(() => void sync(), 15000);
    window.addEventListener(COMPOSER_CHANGED, changes); window.addEventListener('storage', changes);
    window.addEventListener('online', changes); window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible);
    return () => { generationRef.current++; window.clearTimeout(timer); window.clearInterval(interval); unsubscribe(); window.removeEventListener(COMPOSER_CHANGED, changes); window.removeEventListener('storage', changes); window.removeEventListener('online', changes); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); };
  }, [sync]);
  async function requestCode() {
    if (!client) return;
    setBusy(true); setError('');
    try {
      const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
      if (error) throw new Error('No se pudo enviar el código. Verifica tu correo o vuelve a intentarlo más tarde.');
      setSent(true); setStatus('Revisa tu correo e introduce el código.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function verify() {
    if (!client) return;
    setBusy(true); setError('');
    try {
      const { error } = await client.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
      if (error) throw new Error('El código no es válido o ya venció. Solicita uno nuevo.');
      setToken(''); setSent(false);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const linked = session && binding?.userId === session.user.id;
  return <FHSurface className="p-5 md:p-7">
    <p className={styles.eyebrow}>Tus dispositivos</p><h2>Mi cuenta y sincronización</h2>
    <p className={styles.muted}>Usa el mismo correo en iPhone, Samsung y computadora. Se sincronizan las recetas guardadas y el diario del compositor, con sus planes y seguimientos.</p>
    <p role="status" className={styles.syncStatus}>{status}{pending && session && binding?.enabled ? ' · hay cambios por comprobar' : ''}</p>
    {!session ? <form onSubmit={event => { event.preventDefault(); void (sent ? verify() : requestCode()); }}>
      <label className={styles.field}>Correo de mi cuenta<input type="email" autoComplete="email" required disabled={busy || !client || sent} value={email} onChange={event => setEmail(event.target.value)} /></label>
      {sent && <label className={styles.field}>Código del correo<input type="text" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={8} value={token} onChange={event => setToken(event.target.value)} /></label>}
      <div className={styles.actions}><button type="submit" className="fh-action fh-action--primary" disabled={busy || !client}>{busy ? 'Conectando…' : sent ? 'Verificar código' : 'Recibir código de acceso'}</button>{sent && <button type="button" className="fh-action fh-action--secondary" disabled={busy} onClick={() => { setSent(false); setToken(''); }}>Usar otro correo o pedir otro código</button>}</div>
      <p className={styles.muted}>La primera vez se crea tu cuenta. Los datos se subirán cuando actives la sincronización después de entrar.</p>
    </form> : <>
      <p className={styles.muted}>Cuenta: {session.user.email}</p>
      {binding && !linked ? <p role="alert">Este navegador conserva datos de otra cuenta. Usa esa cuenta o un perfil de navegador separado.</p> : <div className={styles.actions}>
        {!linked || !binding?.enabled ? <button type="button" className="fh-action fh-action--primary" onClick={() => {
          try { setBinding(bindComposer(localStorage, session.user.id)); void sync(); } catch (e) { setError((e as Error).message); }
        }}>Activar sincronización y combinar mis datos</button> : <><button type="button" className="fh-action fh-action--secondary" onClick={() => void sync()}>Sincronizar ahora</button><button type="button" className="fh-action fh-action--secondary" onClick={() => { generation.current++; try { setBinding(bindComposer(localStorage, session.user.id, false)); setStatus('Sincronización pausada'); } catch (e) { setError((e as Error).message); } }}>Pausar sincronización</button></>}
      </div>}
      {linked && binding?.lastSyncedAt && <p className={styles.muted}>Última sincronización: {new Date(binding.lastSyncedAt).toLocaleString('es-MX')}</p>}
      <button type="button" className="fh-action fh-action--secondary" onClick={async () => { generation.current++; const { error } = await client!.auth.signOut({ scope: 'local' }); if (error) setError('No se pudo cerrar la sesión; inténtalo de nuevo.'); }}>Cerrar mi sesión</button>
    </>}
    <p className={styles.muted}>Al activarla, las recetas e intenciones guardadas y las notas del compositor se envían a tu cuenta privada en Supabase. Conservamos una copia en este navegador. Puedes seguir practicando sin conexión mientras la página permanezca abierta; los cambios pendientes se combinan al reconectar.</p>
    <p className={styles.muted}>Las grabaciones de voz, el diario de la práctica guiada y el cuaderno de cristales se guardan por separado en cada dispositivo. Cerrar sesión conserva la copia local: usa un dispositivo personal.</p>
    {error && <p role="alert" className={styles.message}>{error}</p>}
  </FHSurface>;
}

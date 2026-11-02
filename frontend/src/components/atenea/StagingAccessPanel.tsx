'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createStagingAccess, type StagingAccess } from '@/lib/atenea/stagingClient';
import { FHPageHeader, FHPageShell, FHSurface } from '@/components/ui/FHLayout';

export default function StagingAccessPanel({ url, publishableKey }: { url: string; publishableKey: string }) {
  const access = useRef<StagingAccess | null>(null);
  const [busy, setBusy] = useState(false), [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState('Usa una cuenta de prueba previamente autorizada.');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void fetch('/api/atenea-voz/access', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        const status = await response.json();
        if (alive.current && status.authenticated === true) {
          setAuthorized(true);
          setMessage('Sesión de aplicación verificada. La voz requiere sus propios controles.');
        }
      })
      .catch(() => { if (alive.current && !controller.signal.aborted) setMessage('Inicia sesión con una cuenta de prueba previamente autorizada.'); });
    return () => { alive.current = false; controller.abort(); access.current?.stop(); access.current = null; };
  }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget, data = new FormData(form);
    const email = String(data.get('email') ?? ''), password = String(data.get('password') ?? '');
    form.reset(); setBusy(true); setMessage('Comprobando acceso…');
    let phase: 'provider' | 'identity' | 'session' = 'provider';
    try {
      const current = access.current ??= createStagingAccess(url, publishableKey);
      await current.login(email, password, stage => {
        phase = stage;
        if (alive.current) setMessage(stage === 'provider' ? 'Comprobando credenciales con Supabase…' : 'Verificando autorización con ATENEA…');
      });
      phase = 'session';
      if (alive.current) setMessage('Creando sesión privada de ATENEA…');
      await current.establish();
      if (alive.current) { setAuthorized(true); setMessage('Sesión de aplicación verificada. No se inicia conversación ni se activa el micrófono.'); }
    } catch {
      access.current?.stop(); access.current = null;
      const failureMessages: Record<'provider' | 'identity' | 'session', string> = {
        provider: 'El proveedor de identidad no completó el inicio de sesión. Comprueba tus credenciales o recupera el acceso desde Supabase.',
        identity: 'Supabase aceptó la sesión, pero ATENEA no pudo verificar la autorización. Se requiere revisar la configuración del servidor.',
        session: 'ATENEA verificó la identidad, pero no pudo crear la sesión privada. Se requiere comprobar el servicio de sesiones.',
      };
      const safeMessage = failureMessages[phase];
      if (alive.current) { setAuthorized(false); setMessage(safeMessage); }
    }
    finally { if (alive.current) setBusy(false); }
  }
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/atenea-voz/access', {
        method: 'DELETE', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok || result.revocationConfirmed !== true) throw new Error();
      await access.current?.logout();
      access.current?.stop(); access.current = null;
      if (alive.current) { setAuthorized(false); setMessage('Sesión de aplicación revocada.'); }
    } catch { if (alive.current) setMessage('No se pudo confirmar el cierre de acceso. Intenta de nuevo.'); }
    finally { if (alive.current) setBusy(false); }
  }
  return <FHPageShell width="narrow">
    <FHPageHeader eyebrow="ATENEA · PRUEBA PRIVADA" title="Acceso de prueba" description="Comprueba tu cuenta antes de probar ATENEA." />
    <FHSurface className="p-6">
      <p role="status" aria-live="polite">{message}</p>
      {!authorized && <form onSubmit={login} className="grid gap-4 mt-4">
        <label>Correo de prueba<input name="email" type="email" autoComplete="off" maxLength={254} required className="block w-full mt-2 p-3 border rounded-lg border-[var(--fh-border-strong)] bg-[var(--fh-surface-strong)]" /></label>
        <label>Contraseña<input name="password" type="password" autoComplete="off" maxLength={256} required className="block w-full mt-2 p-3 border rounded-lg border-[var(--fh-border-strong)] bg-[var(--fh-surface-strong)]" /></label>
        <button className="fh-action fh-action--primary" disabled={busy}>Entrar</button>
      </form>}
      {authorized && <button className="fh-action fh-action--secondary" disabled={busy} onClick={logout}>Cerrar acceso</button>}
      <p className="mt-4">La sesión de prueba se conserva solo en memoria y se pierde al recargar. Esta pantalla no graba ni envía audio.</p>
    </FHSurface>
  </FHPageShell>;
}

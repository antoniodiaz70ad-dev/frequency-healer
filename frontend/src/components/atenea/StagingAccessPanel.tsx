'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createStagingAccess, type StagingAccess } from '@/lib/atenea/stagingClient';
import { FHPageHeader, FHPageShell, FHSurface } from '@/components/ui/FHLayout';

export default function StagingAccessPanel({ url, publishableKey }: { url: string; publishableKey: string }) {
  const access = useRef<StagingAccess | null>(null);
  const [busy, setBusy] = useState(false), [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState('Usa una cuenta de prueba previamente autorizada.');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; access.current?.stop(); access.current = null; }; }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget, data = new FormData(form);
    const email = String(data.get('email') ?? ''), password = String(data.get('password') ?? '');
    form.reset(); setBusy(true); setMessage('Comprobando acceso…');
    try {
      const current = access.current ??= createStagingAccess(url, publishableKey);
      await current.login(email, password);
      if (alive.current) { setAuthorized(true); setMessage('Cuenta autorizada. Esta prueba no inicia una conversación ni activa el micrófono.'); }
    } catch {
      access.current?.stop(); access.current = null;
      if (alive.current) { setAuthorized(false); setMessage('No se pudo autorizar esta cuenta de prueba.'); }
    }
    finally { if (alive.current) setBusy(false); }
  }
  async function logout() {
    if (busy) return;
    setBusy(true);
    try { await access.current?.logout(); if (alive.current) { setAuthorized(false); setMessage('Acceso cerrado.'); } }
    catch { if (alive.current) setMessage('No se pudo confirmar el cierre de acceso. Intenta de nuevo.'); }
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

'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { StagingInvitation } from '@/lib/atenea/stagingInvitation';
import { FHPageHeader, FHPageShell, FHSurface } from '@/components/ui/FHLayout';

type Step = 'code' | 'password' | 'closing' | 'done' | 'cancelled';
export default function StagingInvitationPanel({ url, publishableKey }: { url: string; publishableKey: string }) {
  const invitation = useRef<StagingInvitation | null>(null);
  const alive = useRef(true), cancelled = useRef(false), running = useRef(false);
  const [step, setStep] = useState<Step>('code'), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Escribe el correo invitado y el código que recibiste.');
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; invitation.current?.dispose(); invitation.current = null; };
  }, []);
  const active = () => alive.current && !cancelled.current;
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || cancelled.current) return;
    running.current = true; setBusy(true); setMessage('Confirmando invitación…');
    const form = event.currentTarget, data = new FormData(form);
    const email = String(data.get('email') ?? ''), code = String(data.get('code') ?? '');
    form.reset();
    try {
      const { createStagingInvitation } = await import('@/lib/atenea/stagingInvitation');
      if (!active()) return;
      const current = invitation.current ??= createStagingInvitation(url, publishableKey);
      await current.verify(email, code);
      if (active()) { setStep('password'); setMessage('Correo confirmado. Crea una contraseña para tu cuenta.'); }
    } catch {
      if (active()) setMessage('No se pudo confirmar la invitación. Revisa el código o solicita ayuda al administrador.');
    } finally { running.current = false; if (alive.current) setBusy(false); }
  }
  async function finish() {
    try {
      await invitation.current?.close();
      if (active()) { setStep('done'); setMessage('Cuenta preparada. Ya puedes iniciar sesión.'); }
    } catch {
      if (active()) setMessage('La contraseña quedó guardada, pero no se pudo confirmar el cierre del alta. Reintenta el cierre.');
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || !invitation.current || cancelled.current) return;
    const form = event.currentTarget, data = new FormData(form);
    const password = String(data.get('password') ?? ''), confirmation = String(data.get('confirmation') ?? '');
    form.reset();
    if (password !== confirmation) { setMessage('Las contraseñas no coinciden. Escríbelas de nuevo.'); return; }
    running.current = true; setBusy(true); setMessage('Guardando contraseña…');
    try {
      await invitation.current.savePassword(password);
      if (!active()) return;
      setStep('closing'); await finish();
    } catch {
      if (active()) setMessage('No se pudo confirmar el guardado. Puedes reintentar o salir e intentar iniciar sesión con esa contraseña.');
    } finally { running.current = false; if (alive.current) setBusy(false); }
  }
  function cancel() {
    cancelled.current = true; invitation.current?.dispose();
    setStep('cancelled'); setMessage('Alta cerrada. Si el código ya no funciona, solicita ayuda al administrador.');
  }
  async function retryClose() {
    if (running.current) return;
    running.current = true; setBusy(true);
    try { await finish(); } finally { running.current = false; if (alive.current) setBusy(false); }
  }
  const input = 'block w-full mt-2 p-3 border rounded-lg border-[var(--fh-border-strong)] bg-[var(--fh-surface-strong)]';
  return <FHPageShell width="narrow">
    <FHPageHeader eyebrow="ATENEA · INVITACIÓN PRIVADA" title="Activa tu cuenta" description="Confirma tu invitación y elige una contraseña." />
    <FHSurface className="p-6">
      <p role="status" aria-live="polite">{message}</p>
      {step === 'code' && <form onSubmit={verify} className="grid gap-4 mt-4">
        <label>Correo invitado<input name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy} className={input} /></label>
        <label>Código de invitación<input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required disabled={busy} className={input} /></label>
        <button className="fh-action fh-action--primary" disabled={busy}>Confirmar código</button>
      </form>}
      {step === 'password' && <form onSubmit={save} className="grid gap-4 mt-4">
        <p>Completa este paso en los próximos 10 minutos. Usa al menos 12 caracteres y una contraseña que no uses en otros sitios.</p>
        <label>Nueva contraseña<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} className={input} /></label>
        <label>Repite la contraseña<input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} className={input} /></label>
        <button className="fh-action fh-action--primary" disabled={busy}>Guardar contraseña</button>
      </form>}
      {step === 'closing' && <button className="fh-action fh-action--secondary mt-4" disabled={busy} onClick={retryClose}>Reintentar cierre</button>}
      {(step === 'code' || step === 'password') && <button className="fh-action fh-action--secondary mt-4" disabled={step === 'password' && busy} onClick={cancel}>Salir del alta</button>}
      {(step === 'done' || step === 'cancelled') && <a className="fh-action fh-action--primary mt-4" href="/atenea-acceso">Ir al acceso de prueba</a>}
      <p className="mt-4">Completa el alta en esta pestaña. Crear tu cuenta no inicia una conversación ni activa el micrófono.</p>
    </FHSurface>
  </FHPageShell>;
}

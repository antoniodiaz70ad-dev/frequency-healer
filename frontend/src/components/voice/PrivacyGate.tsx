'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { consentVersion, loadConsent, saveConsent } from '@/lib/voice/privacy';
import styles from './voice.module.css';
export default function PrivacyGate({ transcriptionEnabled, aiEnabled, processingVersion, children }: { transcriptionEnabled: boolean; aiEnabled: boolean; processingVersion: string; children: ReactNode }) {
  const [accepted, setAccepted] = useState(false); const [loaded, setLoaded] = useState(false); const [error, setError] = useState('');
  const version = consentVersion(transcriptionEnabled, aiEnabled, processingVersion);
  useEffect(() => { let alive = true; queueMicrotask(() => { if (!alive) return; try { setAccepted(loadConsent(version)); } catch { setError('No se pudo leer el consentimiento. Puedes continuar solo en esta visita; no sobrescribiremos datos inválidos.'); } setLoaded(true); }); return () => { alive = false; }; }, [version]);
  if (!loaded) return <p role="status">Preparando privacidad…</p>;
  if (accepted) return children;
  return <div className={styles.workspace}><h1>Tu voz, bajo tu control</h1><section><h2>Antes de empezar</h2>
    <p>El micrófono se activa únicamente cuando mantienes presionado el botón. Al soltar se apaga. También puedes completar todo escribiendo.</p>
    <p>{transcriptionEnabled ? 'Esta versión envía únicamente la captura solicitada al proveedor de transcripción configurado en servidor. No usa escucha continua.' : 'Esta versión no tiene transcripción remota configurada. La captura se descarta; utiliza texto para continuar.'}</p>
    <p>{aiEnabled ? 'Puedes elegir enviar el texto a un asistente remoto para estructurar tu intención. Es opcional: las reglas locales siempre están disponibles.' : 'La intención se interpreta con un diccionario local, sin enviarse a una IA.'}</p>
    <p>La aplicación no guarda audio. Solo guarda notas y reflexiones en este dispositivo cuando eliges Guardar sesión. Puedes borrar tus registros. La voz no se usa para diagnosticar ni tratar.</p>
    <p>Los proveedores remotos, cuando estén habilitados, deben tener políticas de retención y uso aprobadas por el propietario antes de activarlos. El audio no se registra en los logs de esta aplicación.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button className={styles.primary} onClick={() => { try { if (!error) saveConsent(version); } catch { setError('Consentimiento solo en memoria para esta visita.'); } setAccepted(true); }}>Entendido, continuar</button>
  </section></div>;
}

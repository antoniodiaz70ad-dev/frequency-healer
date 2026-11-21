'use client';

import { useEffect, useRef, useState } from 'react';
import { MARINA_PHRASE_LIMIT, marinaPhraseStore } from '@/lib/marina/phrase';
import styles from './marina.module.css';

type Props = { active: boolean; autoPlay: boolean; volume: number; onBusy: (busy: boolean) => void; onAvailable: (available: boolean) => void };
export default function MarinaPhrase({ active, autoPlay, volume, onBusy, onAvailable }: Props) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const player = useRef<HTMLAudioElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ticket = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const busyCallback = useRef(onBusy);
  useEffect(() => { busyCallback.current = onBusy; }, [onBusy]);
  useEffect(() => {
    mounted.current = true;
    const generation = ++ticket.current;
    void marinaPhraseStore().then(value => { if (generation === ticket.current && mounted.current) setBlob(value); }).catch(error => { if (mounted.current) setMessage((error as Error).message); });
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach(track => track.stop());
      busyCallback.current(false);
    };
  }, []);
  useEffect(() => { onAvailable(!!blob); }, [blob, onAvailable]);
  useEffect(() => {
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    const update = setTimeout(() => setUrl(objectUrl), 0);
    return () => { clearTimeout(update); URL.revokeObjectURL(objectUrl); };
  }, [blob]);
  useEffect(() => {
    if (!player.current) return;
    player.current.volume = volume;
  }, [volume, url]);
  useEffect(() => {
    const audio = player.current;
    if (!audio) return;
    if (autoPlay) {
      audio.currentTime = 0;
      void audio.play().catch(() => setMessage('El navegador bloqueó la reproducción automática. Pulsa reproducir en tu frase.'));
    } else if (active) audio.pause();
    return () => { audio.pause(); };
  }, [autoPlay, active, url]);
  function stopRecording() {
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
  }
  useEffect(() => {
    const hidden = () => { if (document.hidden) { stopRecording(); player.current?.pause(); } };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, []);
  async function retain(value: Blob | null) {
    if (!mounted.current) return;
    setBlob(value); setUrl(''); onAvailable(!!value);
    try { await marinaPhraseStore(value); if (mounted.current) setMessage(value ? 'Frase guardada en este navegador.' : 'Grabación eliminada.'); }
    catch (error) { if (mounted.current) setMessage((error as Error).message); }
  }
  async function record() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMessage('Este navegador no permite grabar aquí. Puedes cargar un archivo de audio.'); return;
    }
    const generation = ++ticket.current;
    setBusy(true); onBusy(true); setMessage('Solicitando micrófono…');
    player.current?.pause();
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || generation !== ticket.current || document.hidden) { input.getTracks().forEach(track => track.stop()); if (mounted.current) { setBusy(false); onBusy(false); } return; }
      stream.current = input;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(input, mimeType ? { mimeType } : undefined);
      recorder.current = next;
      const chunks: Blob[] = []; let bytes = 0;
      next.ondataavailable = event => { chunks.push(event.data); bytes += event.data.size; if (bytes > MARINA_PHRASE_LIMIT) stopRecording(); };
      next.onerror = () => { if (mounted.current) setMessage('La grabación se interrumpió. Comprueba el audio antes de usarlo.'); stopRecording(); };
      next.onstop = () => {
        input.getTracks().forEach(track => track.stop());
        if (timer.current) clearTimeout(timer.current);
        if (!mounted.current) return;
        setBusy(false); onBusy(false);
        const result = new Blob(chunks, { type: next.mimeType || 'audio/webm' });
        if (result.size && result.size <= MARINA_PHRASE_LIMIT) void retain(result);
        else setMessage('La grabación está vacía o supera 10 MB. Inténtalo de nuevo.');
      };
      next.start(1000); setMessage('Grabando tu frase. Máximo 60 segundos.');
      timer.current = setTimeout(stopRecording, 60000);
    } catch {
      stream.current?.getTracks().forEach(track => track.stop());
      if (mounted.current && generation === ticket.current) { setBusy(false); onBusy(false); setMessage('No se pudo usar el micrófono. Revisa el permiso o carga un audio.'); }
    }
  }
  return <div className={styles.phraseBox}>
    <h3>Mi frase con mi voz</h3>
    <p className={styles.muted}>Graba hasta 60 segundos o carga audio de hasta 10 MB. Se conserva solo en este navegador y puedes descargarlo. En la práctica de 12 minutos se escucha una vez durante Expresión; puedes volver a reproducirlo.</p>
    <div className={styles.actions}>
      {!busy ? <button type="button" className="fh-action fh-action--secondary" disabled={active} onClick={() => void record()}>Grabar mi frase</button> : <button type="button" className="fh-action fh-action--danger" onClick={() => { ticket.current++; if (recorder.current?.state === 'recording') stopRecording(); else { setBusy(false); onBusy(false); } }}>Terminar grabación</button>}
      <label>Cargar audio<input aria-label="Cargar mi frase en audio" disabled={active || busy} type="file" accept="audio/*" onChange={e => {
        const file = e.target.files?.[0]; e.target.value = '';
        if (!file) return;
        ticket.current++;
        if (!file.type.startsWith('audio/') || file.size > MARINA_PHRASE_LIMIT) { setMessage('Elige audio de hasta 10 MB.'); return; }
        void retain(file);
      }} /></label>
    </div>
    {blob && url && <>
      <audio ref={player} controls src={url} preload="metadata" aria-label="Mi frase grabada" />
      <div className={styles.actions}><a href={url} download={`marina-mi-frase.${blob.type.includes('mp4') ? 'm4a' : blob.type.includes('mpeg') ? 'mp3' : blob.type.includes('wav') ? 'wav' : 'webm'}`}>Descargar mi frase</a><button type="button" disabled={active || busy} onClick={() => { player.current?.pause(); ticket.current++; void retain(null); }}>Eliminar grabación</button></div>
    </>}
    {message && <p role="status">{message}</p>}
  </div>;
}

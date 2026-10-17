'use client';

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Ref } from 'react';
import { FHSurface } from '@/components/ui/FHLayout';
import { detectPitch } from '@/lib/cymatics/pitch';
import { compareVoiceFrequency, voiceInputRms, voiceReading, type VoiceReading } from '@/lib/cymatics/voice';
import { computeModalField, surfaceLabel } from '@/lib/cymatics/physics';
import type { CymaticsConfigV1 } from '@/lib/cymatics/types';
import { analyzeSpectrum, appendSpectrogramFrame, type SpectrumFrame } from '@/lib/cymatics/spectral';
import CymaticsCanvas from './CymaticsCanvas';
import SpectralAnalyzer from './SpectralAnalyzer';
import styles from './cymatics.module.css';

export interface VoiceCymaticsHandle { stop: () => void; }
interface Capture { reading: VoiceReading; config: CymaticsConfigV1; createdAt: string; }
interface Props { config: CymaticsConfigV1; controlRef: Ref<VoiceCymaticsHandle>; onStart: () => void; onApply: (config: CymaticsConfigV1) => void; }
function toneConfig(base: CymaticsConfigV1, hz: number, view: CymaticsConfigV1['view']): CymaticsConfigV1 {
  return { ...base, audioMode: 'mono', channelFrequenciesHz: [hz], modeledComponents: [hz], waveform: 'sine', excitationRelativeStrength: 1, autoExposure: false, visualScale: 'fixed', renderQuality: 'low', view };
}

export default function VoiceCymatics({ config, controlRef, onStart, onApply }: Props) {
  const [status, setStatus] = useState<'off' | 'requesting' | 'active'>('off');
  const [reading, setReading] = useState<VoiceReading | null>(null);
  const [referenceHz, setReferenceHz] = useState(432);
  const [voiceView, setVoiceView] = useState<CymaticsConfigV1['view']>('particles');
  const [base, setBase] = useState<CymaticsConfigV1>(() => structuredClone(config));
  const [captures, setCaptures] = useState<[Capture | null, Capture | null]>([null, null]);
  const [spectrum, setSpectrum] = useState<SpectrumFrame | null>(null);
  const [history, setHistory] = useState<Float32Array[]>([]);
  const [error, setError] = useState('');
  const [inputRms, setInputRms] = useState(0);
  const [inputName, setInputName] = useState('Predeterminado del sistema');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [audioSuspended, setAudioSuspended] = useState(false);
  const setupContext = useRef<AudioContext | null>(null);
  const session = useRef<{ stream: MediaStream; context: AudioContext; source: MediaStreamAudioSourceNode; analyser: AnalyserNode; raf: number } | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const release = useCallback(() => {
    generation.current++; pending.current = false;
    const setup = setupContext.current; setupContext.current = null;
    if (setup && setup.state !== 'closed') void setup.close().catch(() => {});
    const active = session.current; session.current = null;
    if (active) { cancelAnimationFrame(active.raf); active.stream.getTracks().forEach(track => track.stop()); active.source.disconnect(); active.analyser.disconnect(); void active.context.close().catch(() => {}); }
  }, []);
  const stop = useCallback(() => { release(); setStatus('off'); setReading(null); setSpectrum(null); setHistory([]); setInputRms(0); setAudioSuspended(false); }, [release]);
  useImperativeHandle(controlRef, () => ({ stop }), [stop]);
  useEffect(() => {
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); release(); };
  }, [release, stop]);

  const start = async () => {
    if (pending.current || session.current) return;
    onStart(); // Release other audio sources before requesting this input.
    const token = ++generation.current;
    pending.current = true; setStatus('requesting'); setError(''); setReading(null); setCaptures([null, null]); setBase(structuredClone(config));
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('El micrófono requiere HTTPS y un navegador compatible.');
      // Create/resume inside the button gesture, before the permission await (Safari).
      context = new AudioContext(); setupContext.current = context;
      void context.resume().catch(() => {});
      stream = await navigator.mediaDevices.getUserMedia({ audio: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (token !== generation.current) { stream.getTracks().forEach(track => track.stop()); return; }
      if (context.state === 'suspended') await context.resume();
      if (token !== generation.current) { stream.getTracks().forEach(track => track.stop()); await context.close(); return; }
      const source = context.createMediaStreamSource(stream), analyser = context.createAnalyser();
      analyser.fftSize = 4096; source.connect(analyser); // Never connect microphone to speakers.
      const active = { stream, context, source, analyser, raf: 0 };
      session.current = active; setupContext.current = null; pending.current = false; setStatus('active');
      setInputName(stream.getAudioTracks()[0]?.label || 'Micrófono predeterminado');
      void navigator.mediaDevices.enumerateDevices?.().then(rows => { if (session.current === active) setDevices(rows.filter(row => row.kind === 'audioinput')); }).catch(() => {});
      stream.getTracks().forEach(track => track.addEventListener('ended', stop, { once: true }));
      const samples = new Float32Array(analyser.fftSize);
      let lastUpdate = -Infinity;
      const tick = (now: number) => {
        if (session.current !== active) return;
        // Pitch, FFT and modal fields update at 10 Hz; canvas animation stays independent.
        if (now - lastUpdate >= 100) {
          lastUpdate = now; analyser.getFloatTimeDomainData(samples);
          setInputRms(voiceInputRms(samples)); setAudioSuspended(active.context.state !== 'running');
          setReading(voiceReading(detectPitch(samples, active.context.sampleRate, 60, 1200, .001), now, .001));
          const frame = analyzeSpectrum(samples, active.context.sampleRate); setSpectrum(frame); setHistory(rows => appendSpectrogramFrame(rows, frame));
        }
        active.raf = requestAnimationFrame(tick);
      };
      active.raf = requestAnimationFrame(tick);
    } catch (cause) {
      stream?.getTracks().forEach(track => track.stop());
      if (context && context.state !== 'closed') void context.close().catch(() => {});
      if (token === generation.current) { stop(); setError(cause instanceof DOMException ? ({ NotAllowedError: 'Permiso denegado: permite el micrófono en los ajustes del sitio de Chrome y revisa el permiso de Chrome en el sistema.', NotFoundError: 'No hay un micrófono disponible. Conecta o habilita una entrada de audio.', NotReadableError: 'El sistema no puede abrir el micrófono. Revisa la entrada elegida y si otra aplicación la está usando.', OverconstrainedError: 'El micrófono seleccionado ya no está disponible. Selecciona el predeterminado.' }[cause.name] ?? cause.message) : cause instanceof Error ? cause.message : 'No se pudo acceder al micrófono.'); }
    }
  };
  const physical = base;
  const liveConfig = useMemo(() => reading ? toneConfig(physical, reading.frequencyHz, voiceView) : null, [physical, reading, voiceView]);
  const referenceConfig = useMemo(() => toneConfig(physical, referenceHz, voiceView), [physical, referenceHz, voiceView]);
  const liveField = useMemo(() => liveConfig ? computeModalField(liveConfig, liveConfig.channelFrequenciesHz[0], 40) : null, [liveConfig]);
  const referenceField = useMemo(() => computeModalField(referenceConfig, referenceHz, 40), [referenceConfig, referenceHz]);
  const sharedScale = Math.max(liveField?.maxAmplitude ?? 0, referenceField.maxAmplitude, 1e-20);
  const difference = reading ? compareVoiceFrequency(reading.frequencyHz, referenceHz) : null;
  const capture = (index: 0 | 1) => {
    if (!reading || !liveConfig) return;
    const value = { reading: { ...reading }, config: structuredClone(liveConfig), createdAt: new Date().toISOString() };
    setCaptures(rows => index === 0 ? [value, rows[1]] : [rows[0], value]);
  };
  const capturedFields = useMemo(() => captures.map(row => row ? computeModalField(row.config, row.reading.frequencyHz, 40) : null), [captures]);
  const capturedScale = Math.max(...capturedFields.map(field => field?.maxAmplitude ?? 0), 1e-20);
  const capturedDifference = captures[0] && captures[1] ? compareVoiceFrequency(captures[1].reading.frequencyHz, captures[0].reading.frequencyHz) : null;
  const exportCaptures = () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, kind: 'voice-cymatics-comparison', interpretation: 'Fundamental estimada; simulación monofrecuencia, no vibración corporal medida.', captures }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'mi-voz-cimatica.json'; link.click(); URL.revokeObjectURL(url);
  };
  return <FHSurface className={styles.voicePanel}>
    <p className={styles.kicker}>INTERACCIÓN EN VIVO · MICRÓFONO</p>
    <h2>Mi frecuencia · Mi voz</h2>
    <p>Sostén una vocal «aaa» o «mmm» y cambia suavemente de tono. Observa tu figura junto a una referencia, o captura dos tonos de tu voz para compararlos.</p>
    <div className={styles.voiceControls}>
      {status === 'off' ? <button onClick={() => void start()}>Conectar mi voz en vivo</button> : <button onClick={stop}>{status === 'requesting' ? 'Cancelar solicitud de micrófono' : 'Detener mi voz'}</button>}
      <label>Vista de mi voz<select aria-label="Visualización de mi voz" value={voiceView} onChange={event => setVoiceView(event.target.value as CymaticsConfigV1['view'])}><option value="particles">Partículas ilustrativas en vivo</option><option value="field">Campo de amplitud</option><option value="vibration">Vibración ilustrativa en vivo</option><option value="nodal-lines">Contornos de amplitud mínima</option></select></label>
      <label>Referencia (Hz)<input aria-label="Referencia de voz en Hz" type="number" min="60" max="1200" step=".1" value={referenceHz} onChange={event => { const hz = Number(event.target.value); if (Number.isFinite(hz) && hz >= 60 && hz <= 1200) setReferenceHz(hz); }}/></label>
      <button disabled={!reading} onClick={() => reading && setReferenceHz(reading.frequencyHz)}>Usar mi tono como referencia</button>
    </div>
    <div className={styles.voiceControls}><label>Micrófono<select aria-label="Micrófono de entrada" value={deviceId} onChange={event => { stop(); setDeviceId(event.target.value); }}><option value="">Predeterminado del sistema</option>{devices.filter(device => device.deviceId && device.deviceId !== 'default').map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Entrada ${index + 1}`}</option>)}</select></label><small>Para cambiar de entrada: elígela y vuelve a conectar.</small></div>
    {status === 'active' && <div className={styles.voiceInput}><p>Entrada: {inputName}</p><label>Nivel de entrada <meter aria-label="Nivel de entrada del micrófono" min="0" max="1" value={Math.min(1, inputRms * 20)}/></label><p>{inputRms >= .001 ? 'Llega sonido al micrófono.' : 'Sin señal suficiente: habla cerca del micrófono o selecciona otra entrada.'} Nivel digital: {inputRms > 0 ? `${(20 * Math.log10(inputRms)).toFixed(0)} dBFS RMS` : 'silencio'}. No mide presión sonora.</p>{audioSuspended && <button onClick={() => { void session.current?.context.resume().catch(() => setError('No se pudo reactivar el audio. Detén y vuelve a conectar.')); }}>Reactivar análisis de audio</button>}</div>}
    {error && <p role="alert">No se pudo conectar: {error}. Revisa el permiso del micrófono y vuelve a intentar.</p>}
    <p role="status">{status === 'requesting' ? 'Esperando permiso del micrófono…' : status === 'active' ? reading ? 'Tono detectado · voz conectada a la simulación' : 'Sin tono estable · sostén una vocal sin forzar la voz' : 'Micrófono apagado'}</p>
    <div className={styles.voiceMetrics}>
      <span>Mi tono <strong>{reading ? `${reading.frequencyHz.toFixed(1)} Hz` : '—'}</strong></span>
      <span>Diferencia <strong>{difference ? `${difference.differenceHz >= 0 ? '+' : ''}${difference.differenceHz.toFixed(1)} Hz` : '—'}</strong></span>
      <span>Intervalo <strong>{difference ? `${difference.semitones.toFixed(2)} semitonos` : '—'}</strong></span>
      <span>Confianza de detección <strong>{reading ? `${Math.round(reading.confidence * 100)}%` : '—'}</strong></span>
    </div>
    <div className={styles.channels}>
      <section><h3>Mi voz ahora</h3>{liveConfig && liveField ? <CymaticsCanvas config={liveConfig} field={liveField} label="Cimática de mi voz en vivo" scaleMax={sharedScale} showContours={voiceView !== 'particles'}/> : <div className={styles.hidden}>La figura aparece al detectar un tono estable.</div>}</section>
      <section><h3>Referencia · {referenceHz.toFixed(1)} Hz</h3><CymaticsCanvas config={referenceConfig} field={referenceField} label="Cimática de referencia vocal" scaleMax={sharedScale} showContours={voiceView !== 'particles'}/></section>
    </div>
    <p>{surfaceLabel(physical.surfaceType)}. Ambas vistas comparten superficie, material, excitación, fuerza virtual y escala de color. {voiceView === 'particles' ? 'Las partículas migran de forma ilustrativa hacia regiones de menor amplitud. Al cambiar de tono conservan su posición; sostén la vocal unos segundos para observar la organización.' : 'La escala se ajusta al máximo de la pareja en cada lectura; no compares brillo entre momentos distintos.'} Los parámetros físicos quedan fijados al conectar; reconecta para tomar los cambios del laboratorio.</p>
    {liveField?.status === 'outside-modeled-range' && <p>Tu tono está fuera del rango modal calculado: la respuesta puede ser débil y no se fuerza una figura.</p>}
    <div className={styles.voiceControls}><button disabled={!reading} onClick={() => capture(0)}>Capturar tono vocal A</button><button disabled={!reading} onClick={() => capture(1)}>Capturar tono vocal B</button><button disabled={!captures[0] || !captures[1]} onClick={exportCaptures}>Exportar comparación de voz</button></div>
    {captures.some(Boolean) && <div className={styles.channels}>{captures.map((row, index) => row && <section key={index}><h3>Tono vocal {index === 0 ? 'A' : 'B'} · {row.reading.frequencyHz.toFixed(1)} Hz</h3><CymaticsCanvas config={row.config} field={capturedFields[index]!} label={`Captura vocal ${index === 0 ? 'A' : 'B'}`} scaleMax={capturedScale} showContours={row.config.view !== 'particles'}/><button onClick={() => { stop(); onApply(structuredClone(row.config)); }}>Explorar tono vocal {index === 0 ? 'A' : 'B'} en el laboratorio</button></section>)}</div>}
    {capturedDifference && <p>B respecto de A: {capturedDifference.differenceHz.toFixed(1)} Hz · {capturedDifference.semitones.toFixed(2)} semitonos. Mismas condiciones físicas y escala común.</p>}
    {spectrum && <details><summary>Ver espectro y armónicos de mi voz</summary><SpectralAnalyzer frame={spectrum} history={history}/></details>}
    <p><small>Se analiza la fundamental estimada (60–1200 Hz), no una «frecuencia única personal». El espectro muestra otros componentes; la figura usa solo la fundamental, con fuerza virtual fija, no el timbre completo ni el volumen vocal. Es una respuesta estacionaria ideal recalculada en vivo; no una medición física de tu cuerpo. El audio se procesa localmente, sin grabar ni transmitir. Las capturas contienen números y configuración, nunca audio. Al conectar se detienen generador, barrido y sesión guiada; iniciar otra fuente detiene este micrófono.</small></p>
  </FHSurface>;
}

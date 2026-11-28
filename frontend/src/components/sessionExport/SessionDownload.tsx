'use client';
import { useEffect, useRef, useState } from 'react';
import { exportFormat, type ExportScore } from '@/lib/sessionExport/score';
import { prepareDownload } from '@/lib/sessionExport/browser';

type Result = { audio: string; metadata: string; title: string; filename: string };
export default function SessionDownload({ score, disabled = false }: { score: () => ExportScore; disabled?: boolean }) {
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [message, setMessage] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const operation = useRef<AbortController | null>(null), urls = useRef<string[]>([]);
  useEffect(() => () => { operation.current?.abort(); urls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  let description = '', invalid = '';
  try {
    const current = score(), format = exportFormat(current);
    description = `${current.seconds / 60} min · WAV estéreo · ${(format.bytes / 1_000_000).toFixed(1)} MB · ${current.voice.cues.length ? `Arthur ${current.voice.cues.length}/${current.voice.phases} fases` : 'Sin narración'}.`;
  } catch (error) { invalid = (error as Error).message; }
  async function prepare() {
    if (operation.current) return;
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setProgress(0); setMessage('Cargando las grabaciones disponibles…');
    urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current = []; setResult(null);
    try {
      const snapshot = structuredClone(score());
      const ready = await prepareDownload(snapshot, controller.signal, value => { setProgress(value); setMessage('Preparando el archivo en este equipo…'); });
      if (controller.signal.aborted) return;
      const audio = URL.createObjectURL(ready.audio), metadata = URL.createObjectURL(ready.metadata);
      urls.current = [audio, metadata]; setResult({ audio, metadata, title: ready.title, filename: ready.filename });
      setMessage('Archivo listo. Pulsa Guardar audio para conservarlo en tu equipo.');
    } catch (error) { if (!controller.signal.aborted) setMessage((error as Error).message); }
    finally { if (operation.current === controller) { operation.current = null; setBusy(false); } }
  }
  return <details className="rl-session-download">
    <summary>Escuchar sin conexión · descargar sesión</summary>
    <p>{invalid || description}</p>
    <p>Exporta la configuración completa desde el inicio, con los volúmenes actuales fijos. Las fases sin Arthur conservan su tiempo sin narración. No incluye cambios manuales de una práctica anterior, voz del dispositivo, grabaciones personales ni visuales.</p>
    <div className="rl-quick-controls">
      <button type="button" className="fh-action fh-action--secondary" disabled={disabled || busy || !!invalid} onClick={() => void prepare()}>Preparar descarga</button>
      {busy && <button type="button" className="fh-action fh-action--secondary" onClick={() => { operation.current?.abort(); setMessage('Preparación cancelada.'); }}>Cancelar descarga</button>}
    </div>
    {busy && <progress aria-label="Preparación de descarga" max={1} value={progress} />}
    <p role="status" aria-live="polite">{message}</p>
    {result && <div><p><strong>Archivo preparado:</strong> {result.title}. Refleja los ajustes del momento en que pulsaste Preparar descarga.</p><div className="rl-quick-controls"><a className="fh-action fh-action--primary" href={result.audio} download={`${result.filename}.wav`}>Guardar audio WAV</a><a className="fh-action fh-action--secondary" href={result.metadata} download={`${result.filename}.json`}>Guardar ficha de configuración</a></div></div>}
    <p>Prepara con la página abierta. Después guarda el WAV en Archivos o Descargas y ábrelo en el reproductor de tu teléfono para escucharlo sin internet. La ficha describe el archivo; para restaurar sesiones editables utiliza la exportación de registros. La reproducción con pantalla bloqueada requiere probarse en tu teléfono.</p>
  </details>;
}

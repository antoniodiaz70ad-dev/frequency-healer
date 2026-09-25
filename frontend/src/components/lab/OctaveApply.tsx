'use client';
import { useState } from 'react';
import type { HarmonicConfig } from '@/lib/harmonic/math';
import { proposeOctaveApply } from '@/lib/harmonic/octaveApply';
import styles from './HarmonicExplorer.module.css';

export interface OctaveApplyProps {
  config: HarmonicConfig;
  playbackActive: boolean;
  onApplyOctave: (offset: number, expectedConfig: HarmonicConfig) => string | null;
}
const format = new Intl.NumberFormat('es', { maximumFractionDigits: 6 });
const signed = (offset: number) => `${offset > 0 ? '+' : ''}${offset}`;
export default function OctaveApply({ config, playbackActive, onApplyOctave, octaves }: OctaveApplyProps & { octaves: readonly { offset: number; frequencyHz: number }[] }) {
  const [selection, setSelection] = useState<{ context: HarmonicConfig; offset: number }>();
  const [notice, setNotice] = useState('');
  const current = selection?.context === config ? selection : undefined;
  const proposal = current ? proposeOctaveApply(current.offset, config) : undefined;
  return <>
    <table><caption>Octavas válidas de la semilla</caption><thead><tr><th scope="col">Desplazamiento</th><th scope="col">Frecuencia</th><th scope="col">Acción</th></tr></thead><tbody>
      {octaves.map(row => <tr key={row.offset}><th scope="row">{signed(row.offset)}</th><td><span title={`${row.frequencyHz} Hz — valor sin redondear`}>{format.format(row.frequencyHz)} Hz</span></td><td><button type="button" className={styles.selectRatio} disabled={playbackActive} aria-label={`Seleccionar octava ${signed(row.offset)}`} onClick={() => { setSelection({ context: config, offset: row.offset }); setNotice(''); }}>Seleccionar</button></td></tr>)}
    </tbody></table>
    <p className={styles.note}>Aplicar cambia solamente la semilla. Se valida también el intervalo o la cascada completa; no añade voces ni inicia audio.</p>
    {selection && <div className={styles.preview}>
      <h4>Vista previa de octava · todavía sin aplicar</h4>
      {!current ? <p role="status">La configuración cambió. Selecciona de nuevo la octava.</p> : <>
        <table><thead><tr><th scope="col">Actual</th><th scope="col">Propuesta</th></tr></thead><tbody><tr><td>Semilla: {config.baseHz} Hz</td><td>Octava: {signed(current.offset)}<br />Semilla: {octaves.find(row => row.offset === current.offset)?.frequencyHz} Hz</td></tr></tbody></table>
        {proposal?.status === 'invalid' ? <p role="alert">No se puede aplicar a la sesión actual: {proposal.reason} No se ajustan otros controles.</p> : <>
          <p>Se conservan relación, modo, duración, volumen, onda, progresión y registro experimental. Después debes confirmar la reproducción.</p>
          <button type="button" disabled={playbackActive} onClick={() => {
            const error = onApplyOctave(current.offset, current.context);
            setNotice(error ?? 'Octava aplicada a la semilla. Revisa la propuesta y usa Confirmar e iniciar cuando quieras reproducir.');
            if (!error) setSelection(undefined);
          }}>Aplicar a semilla</button>
        </>}
      </>}
      <button type="button" onClick={() => { setSelection(undefined); setNotice(''); }}>Cancelar selección de octava</button>
    </div>}
    {notice && <p role="status">{notice}</p>}
  </>;
}

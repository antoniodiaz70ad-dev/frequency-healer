'use client';

import { useEffect, useState } from 'react';
import { applyRatioId, proposeRelationshipApply, type HarmonicApplyResult } from '@/lib/harmonic/apply';
import type { HarmonicConstellationV1 } from '@/lib/harmonic/constellations';
import type { HarmonicExplorerData } from '@/lib/harmonic/explorer';
import { buildSchedule, RATIOS, type HarmonicConfig } from '@/lib/harmonic/math';
import { ratioFrequency, type HarmonicRatioV1 } from '@/lib/harmonic/ratios';
import styles from './HarmonicExplorer.module.css';

export interface ExplorerApplyProps {
  config: HarmonicConfig;
  playbackActive: boolean;
  onApply: (constellation: HarmonicConstellationV1, expectedConfig: HarmonicConfig) => Promise<string | null>;
}
interface Selection { context: HarmonicConfig; ratio: HarmonicRatioV1 }
const hz = (value: number) => `${value.toLocaleString('es', { maximumFractionDigits: 6 })} Hz`;

function Preview({ selection, playbackActive, onApply, onDone, onCancel, applying, setApplying }: Omit<ExplorerApplyProps, 'config'> & {
  selection: Selection; onDone: () => void; onCancel: () => void; applying: boolean; setApplying: (value: boolean) => void;
}) {
  const [settled, setSettled] = useState<{ selection: Selection; result?: HarmonicApplyResult; error?: string }>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void proposeRelationshipApply(selection.ratio, selection.context).then(
      result => { if (active) setSettled({ selection, result }); },
      () => { if (active) setSettled({ selection, error: 'No se pudo validar la propuesta. No se han cambiado los controles.' }); },
    );
    return () => { active = false; };
  }, [selection]);
  const current = settled?.selection === selection ? settled : undefined;
  if (!current) return <p role="status">Validando la propuesta V1…</p>;
  if (current.error) return <p role="status">{current.error}</p>;
  const result = current.result!;
  if (result.status !== 'supported') return <p role="status">{result.reason}</p>;
  const from = selection.context, to = result.config;
  const frequencies = (config: HarmonicConfig) => buildSchedule(config).steps.flatMap(step => step.frequencies).map(hz).join(config.mode === 'sequence' ? ' → ' : ' + ');
  const relationship = (config: HarmonicConfig) => `${RATIOS[config.ratioId].p}:${RATIOS[config.ratioId].q}`;
  const rows = [
    ['Semilla', hz(from.baseHz), hz(to.baseHz)],
    ['Relación', relationship(from), relationship(to)],
    ['Frecuencias V1', frequencies(from), frequencies(to)],
    ['Modo', from.mode === 'sequence' ? 'Secuencia' : 'Simultáneo', to.mode === 'sequence' ? 'Secuencia' : 'Simultáneo'],
    ['Duración', `${from.durationSeconds} s`, `${to.durationSeconds} s`],
    ['Volumen', `${from.uiVolume}/100`, `${to.uiVolume}/100`],
  ];
  return <div className={styles.preview} role="region" aria-label="Vista previa del cambio">
    <h3>Vista previa · todavía sin aplicar</h3>
    <table><caption>Configuración actual y propuesta</caption><thead><tr><th scope="col">Campo</th><th scope="col">Actual</th><th scope="col">Propuesta</th></tr></thead><tbody>{rows.map(([label, before, after]) => <tr key={label}><th scope="row">{label}</th><td>{before}</td><td>{after}</td></tr>)}</tbody></table>
    <p className={styles.note}>{result.explanation}</p>
    {to.ratioId === 'root' && <p className={styles.note}>1:1 conserva los dos miembros de V1: semilla y raíz. No se eliminan ni se añaden voces.</p>}
    <button type="button" disabled={playbackActive || applying} onClick={async () => {
      setApplying(true); setError('');
      try {
        const failure = await onApply(result.constellation, selection.context);
        if (failure) setError(failure); else onDone();
      } catch { setError('No se pudo validar la aplicación. Los controles no cambiaron.'); }
      finally { setApplying(false); }
    }}>{applying ? 'Validando aplicación…' : 'Aplicar a controles'}</button>
    <button type="button" onClick={onCancel} disabled={applying}>Cancelar selección</button>
    {error && <p role="status">{error}</p>}
  </div>;
}

/** Temporary selection only. No player or experiment callback is exposed here. */
export default function RelationshipApply({ config, playbackActive, onApply, ratios }: ExplorerApplyProps & { ratios: HarmonicExplorerData['ratios'] }) {
  const [selection, setSelection] = useState<Selection>();
  const [notice, setNotice] = useState('');
  const [applying, setApplying] = useState(false);
  const rows = [...ratios];
  // Preserve the Phase 1C pure-data contract; expose the already-playable 6:5
  // alongside its six informational rows, only when its result is in range.
  try { rows.push({ numerator: 6, denominator: 5, label: '6:5', frequencyHz: ratioFrequency(config.baseHz, { numerator: 6, denominator: 5 }) }); } catch { /* Outside V1 bounds. */ }
  const contextBlocked = config.ratioId === 'cascade-13-12' || config.progression !== undefined;
  return <>
    <table><caption>Ratios exploratorios · disponibilidad V1</caption><thead><tr><th scope="col">Ratio</th><th scope="col">Frecuencia derivada</th><th scope="col">Acción</th></tr></thead><tbody>{rows.map(row => {
      const id = applyRatioId(row);
      const isCurrent = id === config.ratioId && config.progression === undefined;
      return <tr key={row.label}><th scope="row">{row.label}<small className={styles.capability}>{isCurrent ? 'Actual · V1' : id ? 'Disponible · V1' : 'Solo exploración'}</small></th>
        <td><span title={`${row.frequencyHz} Hz — valor sin redondear`}>{hz(row.frequencyHz)}</span></td>
        <td>{id ? <button type="button" className={styles.selectRatio} disabled={playbackActive || contextBlocked || applying} aria-label={`Seleccionar ${row.label}`} onClick={() => { setNotice(''); setSelection({ context: config, ratio: { numerator: row.numerator, denominator: row.denominator } }); }}>Seleccionar</button> : <span className={styles.note}>Sin aplicar</span>}</td></tr>;
    })}</tbody></table>
    {contextBlocked && <p className={styles.note}>Las cascadas y progresiones explícitas no se sustituyen desde este panel. Usa los controles manuales para volver a un intervalo simple.</p>}
    {playbackActive && <p className={styles.note}>Detén la sesión antes de seleccionar o aplicar otra relación.</p>}
    {selection && (selection.context === config ? <Preview key={`${selection.ratio.numerator}:${selection.ratio.denominator}`} selection={selection} applying={applying} setApplying={setApplying} playbackActive={playbackActive} onApply={onApply} onCancel={() => setSelection(undefined)} onDone={() => { setSelection(undefined); setNotice('Relación aplicada a los controles. Revisa la propuesta y usa Confirmar e iniciar para reproducir.'); }} /> : <p role="status">La configuración cambió. Selecciona de nuevo para obtener una vista previa vigente.</p>)}
    {notice && <p role="status">{notice}</p>}
  </>;
}

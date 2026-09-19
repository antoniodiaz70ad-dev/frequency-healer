'use client';

import { useEffect, useState } from 'react';
import { adaptHarmonicConfig, type HarmonicAdapterResult } from '@/lib/harmonic/adapter';
import { exploreHarmonics } from '@/lib/harmonic/explorer';
import type { HarmonicConfig } from '@/lib/harmonic/math';
import styles from './HarmonicExplorer.module.css';

const format = new Intl.NumberFormat('es', { maximumFractionDigits: 6 });
function Hz({ value }: { value: number }) {
  return <span title={`${value} Hz — valor sin redondear`}>{format.format(value)} Hz</span>;
}

function CurrentConstellation({ config }: { config: HarmonicConfig }) {
  const [settled, setSettled] = useState<{ source: HarmonicConfig; result?: HarmonicAdapterResult; error?: string }>();
  useEffect(() => {
    let active = true;
    void adaptHarmonicConfig(config).then(
      result => { if (active) setSettled({ source: config, result }); },
      () => { if (active) setSettled({ source: config, error: 'No se pudo calcular la firma. Esta vista requiere Web Crypto en un contexto seguro; la reproducción V1 no depende de ella.' }); },
    );
    return () => { active = false; };
  }, [config]);
  // Do not render an old signature under a newly edited configuration, even
  // for the frame before the old hash Promise settles or effect cleanup runs.
  const current = settled?.source === config ? settled : undefined;
  if (!current) return <p role="status">Calculando la vista matemática…</p>;
  if (current.error) return <p role="status">{current.error}</p>;
  const result = current.result!;
  if (result.status !== 'supported') return <p role="status">{result.status === 'invalid' ? 'Configuración no válida: ' : 'Adaptación no disponible: '}{result.reason}</p>;
  const { constellation, sourceConfig } = result;
  return <>
    <dl className={styles.facts}>
      <div><dt>Frecuencia semilla</dt><dd><Hz value={constellation.seedFrequencyHz} /></dd></div>
      <div><dt>Modo actual</dt><dd>{constellation.playbackMode === 'sequence' ? 'Secuencia' : 'Simultáneo'}</dd></div>
    </dl>
    <table><caption>Miembros de la configuración actual{constellation.playbackMode === 'sequence' ? ' · orden de reproducción V1' : ' · voces simultáneas, sin orden temporal'}</caption><thead><tr><th scope="col">Miembro</th><th scope="col">Relación</th><th scope="col">Frecuencia derivada</th></tr></thead><tbody>
      {constellation.members.map((member, index) => <tr key={member.id}><th scope="row">{index + 1}</th><td>{member.relationshipType === 'root' ? '1:1' : member.relationshipType === 'ratio' ? `${member.ratio.numerator}:${member.ratio.denominator}` : `Octava ${member.octaveOffset}`}</td><td><Hz value={member.frequencyHz} /></td></tr>)}
    </tbody></table>
    <label>Firma completa de la constelación<input className={styles.signature} readOnly value={constellation.signature} onFocus={event => event.currentTarget.select()} /></label>
    <p className={styles.note}>Selecciona el campo para copiar la firma. Identifica las relaciones y el modo; no incluye duración ni volumen.</p>
    <p className={styles.note}>Configuración V1 conservada: {sourceConfig.durationSeconds} s · volumen {sourceConfig.uiVolume}/100 · onda sinusoidal. Esta vista no confirma ni inicia la reproducción.</p>
  </>;
}

function ExplorerContent({ config }: { config: HarmonicConfig }) {
  let data;
  try { data = exploreHarmonics(config.baseHz); } catch { return <p role="status">Introduce una frecuencia semilla válida entre 40 y 2000 Hz para explorar sus relaciones.</p>; }
  return <>
    <p>Explora relaciones armónicas y estructuras de octavas. Los valores son informativos: no cambian los controles ni generan audio.</p>
    <div className={styles.grid}>
      <div><h3>Octavas</h3><table><caption>Octavas válidas de la semilla</caption><thead><tr><th scope="col">Desplazamiento</th><th scope="col">Frecuencia</th></tr></thead><tbody>{data.octaves.map(octave => <tr key={octave.offset}><th scope="row">{octave.offset > 0 ? '+' : ''}{octave.offset}</th><td><Hz value={octave.frequencyHz} /></td></tr>)}</tbody></table></div>
      <div><h3>Relaciones</h3><table><caption>Ratios exploratorios · no son nuevos presets</caption><thead><tr><th scope="col">Ratio</th><th scope="col">Frecuencia derivada</th></tr></thead><tbody>{data.ratios.map(ratio => <tr key={ratio.label}><th scope="row">{ratio.label}</th><td><Hz value={ratio.frequencyHz} /></td></tr>)}</tbody></table></div>
    </div>
    <p className={styles.note}>Se omiten resultados fuera de 40–2000 Hz. El cálculo no redondea; la tabla muestra hasta seis decimales y cada valor tiene su precisión completa en la ayuda emergente.</p>
    <h3>Constelación de la configuración actual</h3>
    <CurrentConstellation config={config} />
  </>;
}

/** The only prop is input data: no edit, play, save or experiment callbacks. */
export default function HarmonicExplorer({ config }: { config: HarmonicConfig }) {
  const [open, setOpen] = useState(false);
  return <details className={styles.explorer} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Explorador armónico · solo lectura</summary>
    {open && <ExplorerContent config={config} />}
  </details>;
}

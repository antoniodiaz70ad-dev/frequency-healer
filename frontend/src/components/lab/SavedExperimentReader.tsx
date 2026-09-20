'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { validateExperiment } from '@/lib/experiments/validation';
import { STATE_FIELDS, type ConfigurationSnapshot, type ExperimentState, type ExperimentStatus } from '@/lib/experiments/types';
import { adaptHarmonicConfig, type HarmonicAdapterResult } from '@/lib/harmonic/adapter';
import { RATIOS } from '@/lib/harmonic/math';
import styles from './SavedExperimentReader.module.css';

const statuses: Record<ExperimentStatus, string> = {
  prepared: 'Preparado · reproducción no iniciada', started: 'Iniciado · sin final registrado',
  completed: 'Completado', cancelled: 'Cancelado', interrupted: 'Interrumpido',
};
const labels = { clarity: 'Claridad', tension: 'Tensión', focus: 'Enfoque', energy: 'Energía', mood: 'Ánimo' };
const absent = 'Sin registrar';
const unavailable = 'La representación detallada de la constelación no está disponible para esta configuración.';
function Fields({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) {
  return <dl className={styles.fields}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? absent}</dd></div>)}</dl>;
}
function RecordedTime({ value }: { value?: string }) {
  return value === undefined ? absent : <time dateTime={value}>{new Date(value).toLocaleString('es-MX', { timeZoneName: 'short' })}<small>{value}</small></time>;
}
function State({ title, value }: { title: string; value: ExperimentState }) {
  return <section aria-label={title}><h4>{title}</h4><Fields rows={STATE_FIELDS.map(field => [labels[field], value[field] === undefined ? absent : `${value[field]} / 10`])} /></section>;
}
function HarmonicSummary({ config }: { config: ConfigurationSnapshot }) {
  const [settled, setSettled] = useState<{ source: ConfigurationSnapshot; result?: HarmonicAdapterResult }>();
  useEffect(() => {
    let active = true;
    void adaptHarmonicConfig(config).then(
      result => { if (active) setSettled({ source: config, result }); },
      () => { if (active) setSettled({ source: config }); },
    );
    return () => { active = false; };
  }, [config]);
  const current = settled?.source === config ? settled : undefined;
  return <section aria-label="Resumen armónico"><h4>Resumen armónico</h4>
    {!current ? <p role="status">Calculando la representación exacta…</p> : current.result?.status !== 'supported' ? <p>{unavailable}</p> : <>
      <Fields rows={[
        ['Frecuencia semilla', `${current.result.constellation.seedFrequencyHz} Hz`],
        ['Modo de reproducción', current.result.constellation.playbackMode === 'sequence' ? 'Secuencia (sequence)' : 'Simultáneo (simultaneous)'],
      ]} />
      <table><caption>Relaciones y frecuencias derivadas exactas</caption><thead><tr><th scope="col">Miembro</th><th scope="col">Relación</th><th scope="col">Frecuencia</th></tr></thead><tbody>
        {current.result.constellation.members.map((member, index) => <tr key={member.id}><th scope="row">{index + 1}</th><td>{member.relationshipType === 'root' ? '1:1' : member.relationshipType === 'ratio' ? `${member.ratio.numerator}:${member.ratio.denominator}` : `Octava ${member.octaveOffset}`}</td><td>{member.frequencyHz} Hz</td></tr>)}
      </tbody></table>
      <Fields rows={[[ 'Firma de constelación', <code key="signature">{current.result.constellation.signature}</code> ]]} />
      <p>Representación calculada a partir del snapshot guardado. La firma no incluye duración ni volumen y no demuestra efectos sobre la experiencia.</p>
    </>}
  </section>;
}

/** Only existing validated records enter the audit view; no write/player APIs. */
export default function SavedExperimentReader({ record, onExport }: { record: unknown; onExport: () => void }) {
  const validated = useMemo(() => { try { return validateExperiment(record); } catch { return null; } }, [record]);
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  if (!validated) return <p role="alert">Registro inválido. No se muestra ni se modifica su contenido.</p>;
  const config = validated.configurationSnapshot;
  return <details ref={details} className={styles.reader} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Ver detalles · {new Date(validated.createdAt).toLocaleString('es-MX')} · {statuses[validated.status]} · {config.baseHz} Hz</summary>
    {open && <article aria-label={`Experimento guardado ${validated.id}`}>
      <h3>Experimento guardado · solo lectura</h3>
      <p className={styles.status} data-state={validated.status}>{statuses[validated.status]} <code>({validated.status})</code></p>
      <Fields rows={[
        ['ID', validated.id], ['Estado', validated.status], ['Origen', validated.source], ['Versión del esquema', validated.schemaVersion],
        ['Creado', <RecordedTime key="created" value={validated.createdAt} />], ['Iniciado', <RecordedTime key="started" value={validated.startedAt} />],
        ['Terminado', <RecordedTime key="ended" value={validated.endedAt} />], ['Completado', <RecordedTime key="completed" value={validated.completedAt} />],
        ['Intención', validated.intention], ['Expectativa', validated.expectationScore === undefined ? absent : `${validated.expectationScore} / 10`], ['Contexto', validated.context],
      ]} />
      <State title="Estado previo" value={validated.preState} />
      <section aria-label="Configuración guardada"><h4>Configuración guardada</h4><p>Snapshot confirmado en esta sesión; no corresponde a los controles actuales.</p>
        <Fields rows={[
          ['baseHz', `${config.baseHz} Hz`], ['ratioId', `${config.ratioId} · ${RATIOS[config.ratioId].label}`],
          ['increments', config.increments], ['direction', config.direction], ['mode', config.mode],
          ['durationSeconds', `${config.durationSeconds} s`], ['uiVolume', `${config.uiVolume} / 100`], ['waveform', config.waveform],
          ['progression', config.progression === undefined ? absent : config.progression.join(' → ')],
        ]} />
      </section>
      <HarmonicSummary config={config} />
      <State title="Estado posterior" value={validated.postState} />
      <Fields rows={[[ 'Reflexión', validated.reflection ]]} />
    </article>}
    <details><summary>JSON del registro guardado</summary><pre>{JSON.stringify(record, null, 2)}</pre></details>
    <button type="button" onClick={onExport}>Exportar registro guardado</button>
    <button type="button" onClick={() => { if (details.current) { details.current.open = false; details.current.querySelector('summary')?.focus(); } }}>Volver al historial</button>
  </details>;
}

'use client';

import { useState } from 'react';
import { FHSurface } from '@/components/ui/FHLayout';
import {
  ACTION_PHASES, ACTION_STATUS_LABELS, actionPhaseAt, actionPhasePrompt, emptyActionPlan, validateActionPlan,
  type ActionPlan, type ActionStatus, type ActionFollowUp, type PracticeReview,
} from '@/lib/marina/actionPractice';
import type { ComposerSession } from '@/lib/marina/composer';
import styles from './marina.module.css';

function FocusRating({ label, value, disabled, onChange }: { label: string; value: number | null; disabled?: boolean; onChange: (value: number | null) => void }) {
  return <label>{label}<select disabled={disabled} value={value ?? ''} onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}>
    <option value="">Sin registrar</option>{Array.from({ length: 11 }, (_, i) => <option value={i} key={i}>{i} / 10</option>)}
  </select></label>;
}

export function ComposerActionPlanEditor({ plan, disabled, focusBefore, onChange, onPrepare, onSave, onListen, onFocusBefore }: {
  plan?: ActionPlan; disabled: boolean; focusBefore: number | null;
  onChange: (plan: ActionPlan | undefined) => void; onPrepare: () => void; onSave: () => void; onListen: () => void; onFocusBefore: (value: number | null) => void;
}) {
  const update = (key: keyof Omit<ActionPlan, 'version'>, value: string) => { if (plan) onChange({ ...plan, [key]: value }); };
  let complete = false;
  try { validateActionPlan(plan, true); complete = true; } catch { /* Incomplete drafts remain editable and saveable. */ }
  return <FHSurface className="p-5 md:p-7">
    <p className={styles.eyebrow}>Para empezar</p><h2>Intención y acción</h2>
    <p className={styles.muted}>Elige lo que quieres lograr, ensaya cómo responderás a un obstáculo y termina con una acción concreta.</p>
    {!plan && <div className={styles.actions}><button type="button" className="fh-action fh-action--primary" disabled={disabled} onClick={onPrepare}>Preparar práctica de 8 minutos</button></div>}
    <label className={styles.check}><input type="checkbox" disabled={disabled} checked={!!plan} onChange={event => onChange(event.target.checked ? emptyActionPlan() : undefined)} /> Usar intención y acción con esta receta</label>
    {plan && <>
      <fieldset className={styles.actionFields} disabled={disabled}>
        <legend>Tu plan para esta sesión</legend>
        <div className={styles.fields}>
          <label>1 · Mi meta<input type="text" maxLength={600} placeholder="Terminar hoy el borrador de una propuesta" value={plan.goal} onChange={event => update('goal', event.target.value)} /></label>
          <label>2 · El resultado que imagino<textarea maxLength={600} placeholder="Veo un borrador completo, listo para revisar" value={plan.outcome} onChange={event => update('outcome', event.target.value)} /></label>
          <label>3 · Mi principal obstáculo interno<textarea maxLength={600} placeholder="Seguir investigando cuando ya puedo empezar" value={plan.obstacle} onChange={event => update('obstacle', event.target.value)} /></label>
          <div><p className={styles.muted}>Elige una meta factible bajo tu influencia. Reconoce también los límites externos reales.</p></div>
          <label>4 · Si ocurre…<input type="text" maxLength={600} placeholder="Me detengo por un dato pendiente" value={plan.cue} onChange={event => update('cue', event.target.value)} /></label>
          <label>Entonces haré…<textarea maxLength={600} placeholder="Lo marco por confirmar y continúo con la siguiente sección" value={plan.response} onChange={event => update('response', event.target.value)} /></label>
          <label>Mi primera acción de 10 minutos<input type="text" maxLength={600} placeholder="Escribir los tres puntos principales de la propuesta" value={plan.nextAction} onChange={event => update('nextAction', event.target.value)} /></label>
          <label>Cuándo la haré<input type="text" maxLength={160} value={plan.when} onChange={event => update('when', event.target.value)} /></label>
          <FocusRating label="Concentración antes de escuchar" value={focusBefore} disabled={disabled} onChange={onFocusBefore} />
        </div>
      </fieldset>
      <div className={styles.actions}><button type="button" className="fh-action fh-action--primary" disabled={disabled || !complete} onClick={onListen}>Escuchar mi práctica</button><button type="button" className="fh-action fh-action--secondary" disabled={disabled} onClick={onSave}>Guardar plan y receta</button></div>
      {!complete && <p className={styles.muted}>Completa los campos del plan para escuchar. La valoración de concentración es opcional.</p>}
      <p className={styles.muted}>Puedes guardar un borrador. Al escuchar tendrás una guía escrita; las valoraciones y el resultado se guardan con la experiencia. Tu plan y tu diario permanecen en este navegador.</p>
    </>}
    <details className={styles.practiceSources}><summary>Cómo usar esta práctica</summary>
      <p>La práctica de ocho minutos usa los tonos de Imagen y creación: 259.2, 324 y 388.8 Hz. Elige una meta, imagina el resultado, reconoce un obstáculo y ensaya tu plan si–entonces. Después realiza tu primera acción.</p>
      <p>La secuencia y sus tiempos son una adaptación de la aplicación inspirada en WOOP. Puedes usarla con otra receta. El sonido y la geometría acompañan tu atención; el registro recoge tu experiencia y lo que hiciste.</p>
      <a href="https://woopmylife.org/en/practice" target="_blank" rel="noreferrer">Práctica WOOP · fuente</a>{' · '}
      <a href="https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.565202/full" target="_blank" rel="noreferrer">Investigación sobre contraste mental y planificación</a>
    </details>
  </FHSurface>;
}

export function ComposerActionGuide({ plan, elapsedMs, durationMs }: { plan: ActionPlan; elapsedMs: number; durationMs: number }) {
  const phase = actionPhaseAt(elapsedMs, durationMs);
  return <section className={styles.actionGuide} aria-label="Guía de intención y acción">
    <p className={styles.eyebrow}>{ACTION_PHASES.findIndex(row => row.id === phase.id) + 1} / {ACTION_PHASES.length}</p>
    <h3>{phase.name}</h3><p>{actionPhasePrompt(phase.id, plan)}</p>
    <details><summary>Ver el recorrido completo</summary><ol>{ACTION_PHASES.map(row => <li key={row.id}><strong>{row.name}</strong> · {actionPhasePrompt(row.id, plan)}</li>)}</ol></details>
  </section>;
}

export function ComposerActionReview({ plan, review, onChange }: { plan: ActionPlan; review: PracticeReview; onChange: (review: PracticeReview) => void }) {
  return <section className={styles.actionGuide} aria-label="Resultado de intención y acción">
    <h3>Tu siguiente acción</h3><p>{plan.nextAction}</p><p className={styles.muted}>{plan.when}. Puedes guardar la sesión ahora y añadir un seguimiento en el diario después de actuar.</p>
    <div className={styles.fields}>
      <FocusRating label="Concentración después de escuchar" value={review.focusAfter} onChange={focusAfter => onChange({ ...review, focusAfter })} />
      <label>Distracciones que observé<input type="number" min="0" max="999" step="1" value={review.distractions ?? ''} onChange={event => onChange({ ...review, distractions: event.target.value === '' ? null : Number(event.target.value) })} /></label>
      <label>Estado de mi primera acción<select value={review.actionStatus} onChange={event => onChange({ ...review, actionStatus: event.target.value as ActionStatus })}>{Object.entries(ACTION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Qué hice o qué quedó pendiente<textarea maxLength={2000} value={review.evidence} onChange={event => onChange({ ...review, evidence: event.target.value })} /></label>
    </div>
  </section>;
}

export function ComposerActionDiary({ session, onAppend }: { session: ComposerSession; onAppend: (update: ActionFollowUp) => boolean }) {
  const [actionStatus, setActionStatus] = useState<ActionFollowUp['actionStatus']>('done');
  const [evidence, setEvidence] = useState('');
  const [message, setMessage] = useState('');
  const plan = session.recipe.actionPlan;
  if (!plan) return null;
  const review = session.practiceReview;
  return <section className={styles.actionGuide} aria-label="Plan y seguimiento de la sesión">
    <h3>{plan.goal}</h3><p>Resultado imaginado: {plan.outcome}</p><p>Obstáculo: {plan.obstacle}</p>
    <p>Si {plan.cue}, entonces {plan.response}.</p><p>Primera acción: {plan.nextAction} · {plan.when}</p>
    {review && <><p>Concentración antes: {review.focusBefore ?? 'sin registrar'} / después: {review.focusAfter ?? 'sin registrar'} · Distracciones: {review.distractions ?? 'sin registrar'}</p><p>Registro al guardar: {ACTION_STATUS_LABELS[review.actionStatus]}{review.evidence ? ` · ${review.evidence}` : ''}</p></>}
    {(session.actionFollowUps ?? []).map(update => <p key={update.id}>{new Date(update.recordedAt).toLocaleString('es-MX')} · {ACTION_STATUS_LABELS[update.actionStatus]} · {update.evidence}</p>)}
    <details><summary>Añadir seguimiento de mi acción</summary><div className={styles.fields}>
      <label>Resultado de la acción<select value={actionStatus} onChange={event => setActionStatus(event.target.value as ActionFollowUp['actionStatus'])}>{Object.entries(ACTION_STATUS_LABELS).filter(([value]) => value !== 'pending').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Mi avance concreto<textarea maxLength={2000} value={evidence} onChange={event => setEvidence(event.target.value)} /></label>
    </div><button type="button" className="fh-action fh-action--secondary" onClick={() => {
      if (!evidence.trim()) { setMessage('Anota qué hiciste o qué impidió avanzar.'); return; }
      if (onAppend({ id: crypto.randomUUID(), recordedAt: new Date().toISOString(), actionStatus, evidence })) { setEvidence(''); setMessage('Seguimiento añadido. Tu observación inicial se conserva.'); }
      else setMessage('No se pudo guardar el seguimiento. Tu nota sigue aquí para volver a intentarlo.');
    }}>Guardar seguimiento</button>{message && <p role="status">{message}</p>}</details>
  </section>;
}

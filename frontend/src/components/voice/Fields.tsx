'use client';
import { DESIRED_STATES, GOALS, type ParsedIntentionV1, type SelfRatingV1 } from '@/lib/voice/types';
import styles from './voice.module.css';
import { dictionaries } from '@/lib/voice/i18n';
export const goalLabels = dictionaries.es.goals;
export const stateLabels = dictionaries.es.states;
export function IntentFields({ value, onChange }: { value: ParsedIntentionV1; onChange: (v: ParsedIntentionV1) => void }) {
  return <>
    <label>Intención resumida<textarea maxLength={500} value={value.intention} onChange={e => onChange({ ...value, intention: e.target.value })} /></label>
    <div className={styles.grid}>
      <label>Objetivo<select value={value.goal} onChange={e => onChange({ ...value, goal: e.target.value as ParsedIntentionV1['goal'] })}>{GOALS.map(g => <option key={g} value={g}>{goalLabels[g]}</option>)}</select></label>
      <label>Duración (minutos)<input type="number" min={5} max={60} step={1} value={value.durationMinutes} onChange={e => onChange({ ...value, durationMinutes: Number(e.target.value) })} /></label>
      <label>Intensidad<select value={value.intensity} onChange={e => onChange({ ...value, intensity: e.target.value as ParsedIntentionV1['intensity'] })}><option value="gentle">Suave</option><option value="deep">Profunda</option><option value="experimental">Experimental</option></select></label>
    </div>
    {value.goal === 'custom' && <label>Objetivo personalizado (opcional)<input maxLength={500} value={value.customGoal ?? ''} onChange={e => onChange({ ...value, customGoal: e.target.value })} /></label>}
    <fieldset><legend>Estados deseados (hasta 3)</legend><div className={styles.grid}>{DESIRED_STATES.map(s => <label className={styles.check} key={s}><input type="checkbox" checked={value.desiredStates.includes(s)} disabled={!value.desiredStates.includes(s) && value.desiredStates.length >= 3} onChange={e => onChange({ ...value, desiredStates: e.target.checked ? [...value.desiredStates, s] : value.desiredStates.filter(x => x !== s) })} />{stateLabels[s]}</label>)}</div></fieldset>
    {value.requiresReview.length > 0 && <p className={styles.muted}>Revisa los valores propuestos: {value.requiresReview.map(k => ({ goal: 'objetivo', durationMinutes: 'duración (15 min por defecto)', intensity: 'intensidad (suave por defecto)', desiredStates: 'estados' }[k])).join(', ')}. La confianza describe extracción de texto, no resultados.</p>}
  </>;
}
export function RatingFields({ value, onChange, title }: { value: Partial<SelfRatingV1>; onChange: (v: Partial<SelfRatingV1>) => void; title: string }) {
  return <fieldset><legend>{title} · opcional, 0–10</legend><div className={styles.grid}>{(['clarity', 'stress', 'focus'] as const).map(k => <label key={k}>{({ clarity: 'Claridad', stress: 'Tensión percibida', focus: 'Enfoque' })[k]}<select value={value[k] ?? ''} onChange={e => { const copy = { ...value }; if (e.target.value === '') delete copy[k]; else copy[k] = Number(e.target.value); onChange(copy); }}><option value="">Omitir</option>{Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i}</option>)}</select></label>)}</div></fieldset>;
}

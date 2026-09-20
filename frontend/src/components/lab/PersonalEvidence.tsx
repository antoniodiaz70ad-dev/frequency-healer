import type { PersonalEvidenceV1 } from '@/lib/guided/recommendations';
const labels = { none: 'Evidencia personal insuficiente', insufficient: 'Evidencia personal insuficiente', preliminary: 'Señal personal preliminar', descriptive: 'Patrón personal descriptivo' };
export default function PersonalEvidence({ value }: { value: PersonalEvidenceV1 }) {
  return <section aria-label="Evidencia personal de la sesión"><h3>Tu evidencia personal · Personal N=1</h3>
    <p>{value.available ? `Sesiones comparables: ${value.comparableSessions} · ${labels[value.evidenceLevel]}` : 'Evidencia no disponible; no se presume N=0.'}</p>
    {value.metrics.map(metric => <p key={metric.metric}>{metric.metric}: cambio medio {metric.mean}, N={metric.n}; después − antes. Asociación descriptiva, no causal.</p>)}
    <details><summary>Criterio de comparación personal</summary><p>{value.explanation}</p></details>
    <p>La evidencia no altera las reglas ni prioriza candidatos. No demuestra eficacia médica.</p>
  </section>;
}

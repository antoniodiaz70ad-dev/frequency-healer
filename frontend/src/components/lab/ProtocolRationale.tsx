import type { HarmonicConfig } from '@/lib/harmonic/math';
import type { HarmonicConstellationV1 } from '@/lib/harmonic/constellations';
import StructureProfile from './StructureProfile';
import type { ReactNode } from 'react';
import type { ProtocolRationaleV1 } from '@/lib/guided/rationale';
import { EVIDENCE_LABELS } from '@/lib/guided/rationale';
export default function ProtocolRationale({ value, children, config, constellation, summaryLabel = "¿Por qué esta sesión?" }: { summaryLabel?: string; value: ProtocolRationaleV1; children?: ReactNode; config?: HarmonicConfig; constellation?: HarmonicConstellationV1 }) {
  return <details><summary>{summaryLabel}</summary><section aria-label="Explicación del protocolo">
    <p>Base: Exploratoria. {value.purpose}</p>
    <p>Las etiquetas distinguen matemática, acústica, diseño de protocolo e hipótesis exploratorias. No indican eficacia médica.</p>
    {value.components.map((component, index) => <div key={index}>
      <h4>{component.role}</h4><p>{component.value} · Base: {EVIDENCE_LABELS[component.basis]}</p>
      <p>{component.explanation}</p>{component.evidence && <p>{component.evidence}</p>}
    </div>)}
    {config&&<StructureProfile config={config} constellation={constellation}/>}
    {children}
    <h4>Límites</h4>{value.limitations.map(line => <p key={line}>{line}</p>)}
  </section></details>;
}

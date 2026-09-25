# Frequency Healer V1 Copy Freeze

## Freeze record

- Freeze date: 2026-09-20 (America/Mexico_City)
- Branch: `codex/voice-journey-grant`
- Audited baseline: `1e8cff362500ef0bd0d7d78112e17c77bf673b88`
- Freeze commit: the commit containing this document and the copy-freeze regression test
- Scope: user-facing V1 copy and classification language only

This freeze establishes the V1 wording before Data/Export, Onboarding, Closed Beta and Release Candidate work. It does not change product behavior, routes, schemas, storage, audio, mathematics or recommendation rules.

## Files audited

### Routes and navigation

- `frontend/src/app/layout.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/landing/page.tsx`
- `frontend/src/app/voz/page.tsx`
- `frontend/src/app/laboratorio-armonico/page.tsx`
- `frontend/src/app/biblioteca/page.tsx`
- `frontend/src/app/protocolos/page.tsx`
- `frontend/src/app/generador/page.tsx`
- `frontend/src/app/sesion-nueva/page.tsx`
- `frontend/src/app/diario/page.tsx`
- `frontend/src/components/AppFrame.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/landing/HeroVideo.tsx`

### Guided Session, Harmonic Lab and history

- `frontend/src/components/voice/PrivacyGate.tsx`
- `frontend/src/components/voice/Fields.tsx`
- `frontend/src/components/voice/VoiceCapture.tsx`
- `frontend/src/components/voice/SessionPlan.tsx`
- `frontend/src/components/voice/VoiceJourney.tsx`
- `frontend/src/components/voice/VoiceHistory.tsx`
- `frontend/src/components/voice/HarmonicLab.tsx`
- `frontend/src/components/lab/AdaptiveExplorer.tsx`
- `frontend/src/components/lab/ConstellationAudit.tsx`
- `frontend/src/components/lab/ConstellationBuilder.tsx`
- `frontend/src/components/lab/ExperimentSession.tsx`
- `frontend/src/components/lab/GuidedRecommendation.tsx`
- `frontend/src/components/lab/HarmonicExplorer.tsx`
- `frontend/src/components/lab/HarmonicStructure.tsx`
- `frontend/src/components/lab/OctaveApply.tsx`
- `frontend/src/components/lab/PersonalEvidence.tsx`
- `frontend/src/components/lab/PersonalizedAdvisor.tsx`
- `frontend/src/components/lab/ProtocolDiscovery.tsx`
- `frontend/src/components/lab/ProtocolRationale.tsx`
- `frontend/src/components/lab/RelationshipApply.tsx`
- `frontend/src/components/lab/SavedExperimentReader.tsx`
- `frontend/src/components/lab/StructuralAnalysis.tsx`
- `frontend/src/components/lab/StructureProfile.tsx`

### OBE, safety and canonical data copy

- `frontend/src/components/CommandCardItem.tsx`
- `frontend/src/components/SafetyDisclaimerModal.tsx`
- `frontend/src/components/SessionLogForm.tsx`
- `frontend/src/components/SessionLogItem.tsx`
- `frontend/src/lib/commandCards.ts`
- `frontend/src/lib/focusLevels.ts`
- `frontend/src/lib/frequencies.ts`
- `frontend/src/lib/protocols.ts`
- `frontend/src/lib/protocolLibrary.ts`
- `frontend/src/lib/guided/rationale.ts`
- `frontend/src/lib/guided/recommendations.ts`
- `frontend/src/lib/voice/i18n.ts`

## Canonical V1 labels

Navigation and feature labels are frozen as:

- `Inicio`
- `Sesión guiada`
- `Laboratorio Armónico`
- `Atlas de frecuencias`
- `Protocolos históricos`
- `Generador manual`
- `Exploración OBE`
- `Diario OBE`

Explanatory and analytical labels are frozen as:

- `¿Por qué esta sesión?`
- `Propósito subjetivo`
- `Complejidad estructural`
- `Evidencia personal`
- `Próxima sesión informativa`

`/voz` remains the internal backward-compatible route; “Viaje por voz” is not an active V1 label. Microphone use remains optional.

## Evidence taxonomy

The only V1 evidence categories are:

- `MATHEMATICAL`
- `ACOUSTIC`
- `PROTOCOL_DESIGN`
- `TRADITIONAL_HISTORICAL`
- `EXPLORATORY`
- `PERSONAL_N1`
- `PUBLISHED_EVIDENCE`
- `UNSUPPORTED_LEGACY_CLAIM`

Display labels may translate these identifiers without changing their meaning. No additional evidence category may be introduced during V1 closeout.

## Safety language principles

Frequency Healer presents mathematical and acoustic facts separately from subjective experience, personal N=1 observation, protocol design, historical tradition and unsupported legacy claims. It does not claim cures, DNA repair, physiological activation, medical efficacy, guaranteed neurological states, literal body separation, verified telepathy or factual energetic mechanisms.

The freeze audit found one critical safety exception in the existing binaural disclaimer. “Inducen estados alterados” and predicted atonía or visual-field loss were replaced with neutral attention and activity-safety guidance. This is a permitted safety/compliance correction, not a new product meaning.

## OBE framing

OBE content remains `EXPLORATORY`. “Exploración OBE”, “experiencia subjetiva”, “sensación de separación” and “Propósito subjetivo” describe the product stance. Exact legacy command strings remain preserved as user-directed contemplative language and do not establish an external event or mechanism.

## HCI wording

HCI is titled `Complejidad estructural`. Its frozen limitation is:

> HCI describe la complejidad de la estructura armónica; no mide efectividad terapéutica.

HCI remains a structural descriptor. It is not an effectiveness score, evidence score, recommendation weight or safety rating.

## Legacy and historical wording

The atlas and protocol archive retain historical names, IDs, source terms and search tags for provenance and backward compatibility. Active presentation must label them as `HISTÓRICO`, `DEPRECADO`, `EXPLORATORIO` or `LEGADO NO RESPALDADO` as applicable. Negative statements such as “no se afirma reparación” are safety qualifications, not claims.

Intentional retained search findings include:

- `frecuencia-milagro` in the historical protocol audit and legacy ID context;
- `telepatia`, `pineal`, `soul-body` and related discovery tags or IDs;
- `reparación del ADN`, `terapéutico`, `sanación` and energetic terms inside explicit negations or historical descriptions;
- “Viaje por voz” in the superseded UX audit, not active UI;
- medical-boundary keywords in the local intent guard, not user-facing claims.

Stored records, fixtures, IDs, tags and historical audit documents were not rewritten.

## Post-freeze change policy

Copy may change after this freeze only for:

1. **Safety or compliance:** legal, medical or factual risk.
2. **Critical clarity:** beta users cannot understand a required action.
3. **Defect:** typo, broken label or incorrect route/action description.

Stylistic rewriting, new marketing language, new claims, altered protocol meanings and conceptual features introduced through copy are outside the V1 freeze.

## Unresolved items

Zero unresolved critical copy items. Any future request to change frozen language must name one of the three permitted classes and preserve all protected contracts.

## Approved functional exception: Seed Selection Engine V1

The post-freeze Seed Selection Engine exception adds only the clarity required to disclose deterministic base-frequency selection:

- `Frecuencia base sugerida`
- `¿Por qué esta frecuencia base?`
- `Base personalizada (Hz, opcional)`
- `Selección automática`
- `Semillas sugeridas estructuralmente`

The explanation must state that the 0.10-octave structural-tier tolerance is a V1 product rule, not a scientific threshold, and that a base frequency is not considered therapeutic by itself. The exception does not change the frozen evidence taxonomy or permit folklore, efficacy or medical claims.

## Approved critical-clarity delta: Data / Export Integrity

Phase 3F adds the minimum labels needed to operate and audit the requested read-only export:

- `Datos y exportación`
- `Exportación unificada V1`
- `Preparar exportación unificada`
- `Descargar exportación V1`
- `Exportación verificada`

The supporting copy states that only Frequency Healer namespaces in the explicit allowlist are read, invalid payloads are preserved without repair, and Seed Selection V1 provenance is verified. These labels are a permitted critical-clarity change. They do not introduce import, cloud sync, backup claims, product logic or a new evidence category.

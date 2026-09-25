# Frequency Healer — V1 UX simplification audit

Phase 3B AUDIT ONLY. Proposals below require approval; none has been implemented.

Baseline: `39e6ddc62804d23b8b736e8885a93f84b4c4e4ed`, 2026-09-20. [Frozen inventory](FREQUENCY_HEALER_V1_SCOPE_FREEZE.md) and [backlog](FREQUENCY_HEALER_POST_V1_BACKLOG.md) distinguish implementation from future work.

## Method and limits

Source audit covers all nine frontend pages, the application shell and every component family listed below, their visible actions and relevant flow/storage contracts. Rendered spot checks on the accepted Phase 2F preview confirmed the dashboard, Voice privacy gate and Lab entry. No consent was accepted for the user, no microphone/audio started and no records were created or imported. Deeper states were inspected in source and covered by the accepted Phase 2F browser regression; this is not a new moderated usability study or full mobile/accessibility audit.

Each finding below describes an observed source/UI fact and a design recommendation. Cognitive load and predicted confusion are audit judgments to test with users, not measured beta results. No physical-audio or legal conclusion is drawn.

## Core finding

The app has a nearly complete low-knowledge session in `/voz`, including text, optional voice, interpretation review, deterministic proposal, explanation, confirmation, post-state and explicit save. Its voice label and voice-first privacy copy obscure that text is sufficient. The default dashboard instead emphasizes frequencies, domain catalogs and parallel starting points.

The final desired step—return and get a more informed recommendation—needs precise wording. Voice history offers descriptive observations and does not reorder proposals. Personal ranking requires completed Discovery plans; adaptive exploration is nested under that advanced flow. Merely moving panels cannot safely turn all historical sessions into interchangeable evidence. That bridge is NOT part of the proposed presentation-only 3B scope.

## 1. Candidate Simple Mode journey

Use existing `/voz` as the primary destination, with the user-facing label **Sesión guiada · texto o voz**. Keep its URL, privacy gate, orchestrator, records, rules and confirmation behavior.

| Stage | Visible essentials / proposed primary action | Existing behavior to retain |
|---|---|---|
| Entry | “¿Qué quieres explorar hoy?”; text works without a microphone | Existing text entry and optional VoiceCapture; truthful provider availability |
| Privacy | Concise text/local-versus-remote disclosure; “Entendido, continuar” | Existing consent version and no-provider fallback; no silent acceptance |
| Intention | One text prompt; optional voice, secondary cancel | Existing limits, editable transcript and medical-language boundary |
| Interpretation | Summary, objective and duration; “Generar recomendación” | Human review and correction; defaults disclosed, no acoustic inference added |
| Proposal | Intention, duration, comfortable volume; optional “¿Por qué esta sesión?” | Same proposal/config; no change to rule selection, gain or schedule |
| Confirmation | “Confirmar e iniciar”; edit/back secondary | Existing explicit experimental consent remains prominent where required |
| Listening | Progress and unambiguous stop; optional markers collapsed | Existing marker/command review and lifecycle cleanup; no autoplay |
| Post-session | Optional three existing voice ratings and reflection | Keep voice schema; do not insert experiment energy/mood or convert blanks to zero |
| Save | “Guardar sesión”; secondary “Terminar sin guardar” | Explicit save; memory/export recovery on storage error |
| Return | Existing voice history and descriptive personal evidence | Explain what history actually informs; no promise of automatic adaptive ranking |

No new Simple Mode route, mode preference key, unified history or onboarding state machine is needed for this candidate. “Simple Mode” describes hierarchy, not an engine or schema. If VOICE is OFF, do not show a dead guided CTA; preserve access to existing tools with an honest “Generador manual” fallback.

## 2. Candidate Lab Mode journey

Keep `/laboratorio-armonico` as the advanced destination. User chooses the existing task: manual design, Explorer, Builder, fixed Discovery or personal analysis. Technical fields are appropriate here but the active task and its confirmation must be unmistakable.

Manual configuration → optional recording → preview exact configuration → confirm → playback/stop → optional post-state → explicit save/export.

Explorer selection → compare proposed/current → explicit Apply → existing manual confirmation. Builder create/load → validate/preview → explicit playback confirmation only if exactly supported. These separate actions must remain separate.

Discovery create/review/activate → next fixed assignment → confirmation → result/save. Personalization best-current and Adaptive next-test stay labeled as different authorities. Fixed-plan outside-exploration consent remains visible. HIP/HCI, signatures, JSON and full provenance remain available in advanced disclosures, never repurposed as efficacy indicators.

## 3. Page-by-page audit

All paths in this document are relative to repository root unless linked.

| Page | Observed complexity/conflict | Proposed direction; status |
|---|---|---|
| `frontend/src/app/page.tsx` | Three “Formas de explorar” links; “Sesión rápida” opens the technical generator. Frequency cards, domains, protocols and catalog statistics precede a simple intention journey. Six different frequency cards all link to `/generador` without a frequency parameter; protocol cards likewise open the list. | One guided-session primary CTA when enabled; Lab secondary; catalog shortcuts under an existing-tools disclosure. Do not silently add preset selection behavior. Proposed 3B. |
| `frontend/src/app/landing/page.tsx` | English landing versus Spanish app; first primary action explores the method, app entry goes to dashboard, Lab gets a direct link. Planned Belief Mirror/Probability Lab/map are presented alongside available concepts. | Guided-session CTA when VOICE ON; retain method as secondary. De-emphasize roadmap copy or explicitly separate it from available v1; approval required. No hero redesign. |
| `frontend/src/app/voz/page.tsx` + VoiceJourney | Closest complete novice flow; title suggests voice is required. Review exposes objective/intensity/six desired-state choices; proposal shows rule IDs plus multiple explanation layers and optional ratings. | Rename visible entry, use one primary action per stage, collapse technical/repeated explanation and optional marker controls. Preserve duration, volume, review, consent, errors, stop and save. Proposed 3B. |
| `frontend/src/app/laboratorio-armonico/page.tsx` + HarmonicLab | Guided entry and manual controls coexist. Manual preview/recording appears after several advanced modules. Guided confirm, saved-constellation confirm and manual confirm can be present on the same page; they act on different sources. | Keep guided entry available; group manual/exploration tools and visually pair each preview with its own confirmation. Do not merge handlers or unmount running recorders. A later separately approved 3B slice. |
| `frontend/src/app/generador/page.tsx` | Tono Simple still exposes Hz, waveform, binaural, tuning, speakers/coils, timer and presets. Multilayer mode adds Focus/chords. Play/stop icons and several switches lack descriptive visible labels. | Label navigation as manual/advanced; preserve complete tool. Label/accessibility review in 3K. Do not redesign engines or imply coils are validated hardware support. |
| `frontend/src/app/protocolos/page.tsx` | A second protocol concept: legacy presets rather than guided rules or Discovery candidates. “Protocolos de Sanación” conflicts with exploration positioning. Independent list/detail/play/pause/stop. | Label “Protocolos clásicos” provisionally; keep presets. Claims/evidence text requires 3C/3D audit before copy approval. No deletion or schedule changes. |
| `frontend/src/app/biblioteca/page.tsx` | Frequency catalog and command cards share page; category/domain/evidence filters, condition-search wording and multiple taxonomies require prior knowledge. | Keep advanced reference. Do not present as the default way to obtain a first recommendation. Claims classification deferred 3D. |
| `frontend/src/app/sesion-nueva/page.tsx` | “Nueva sesión” means an existing OBE/Focus workflow (configuration, timing/alarm, breathing, intention), not generic guided session. Writes next-session config then navigates to generator. | Navigation label “Preparación OBE” or equally explicit legacy description, preserving route/workflow. Exact public label needs approval. |
| `frontend/src/app/diario/page.tsx` | Only OBE entries/cooldown; does not show voice, V1/V2 or Discovery results. Labels may imply an app-wide diary. | Clarify “Diario OBE”. Retain fields/history. Unified history/export is separate scope, not a 3B shortcut. |

## 4. Component coverage and disposition

| Components (under `frontend/src/components/`) | Audit finding / disposition |
|---|---|
| `Sidebar.tsx`, `AppFrame.tsx` | Eight links at equal level with flags ON; “Nueva sesión”, “Generador” and “Viaje por voz” all sound like starts. Proposed hierarchy below. Keep route gating and landing frame exemption. |
| `landing/HeroVideo.tsx` | Existing mute, pause, poster, reduced motion and mobile source are useful; retain. Physical/mobile video performance belongs to 3K, not a new animation effort. |
| `voice/PrivacyGate.tsx` | Disclosure accurately reports no provider but is framed around voice before any text action; propose clearer text-or-voice framing without bypassing consent. |
| `voice/VoiceJourney.tsx` | State-based progression is reusable. IDs/rule versions, repeated caveats and command panel can be secondary. Stop/storage errors must stay visible. |
| `voice/VoiceCapture.tsx` | Push-to-talk plus two-click accessible alternative, permission/error handling and unavailable-provider copy already exist. No microphone required. Later usability check should ensure capture-without-transcription is understood; do not change provider behavior now. |
| `voice/Fields.tsx` | Human correction fields and optional 0–10 ratings exist. Duration stays prominent; secondary desired states/intensity may collapse. Do not change defaults or field contracts. |
| `voice/SessionPlan.tsx` | Exact acoustic schedule and formula/gain explanation are useful Lab audit detail; in Simple keep inside existing disclosure. |
| `voice/VoiceHistory.tsx` | Separate explicit visible/original exports, deletion confirmation and N=1 summaries; technical detail can collapse. Never combine original-raw export and validated-visible export as if equivalent. |
| `voice/HarmonicLab.tsx` | Hosts multiple independent design/recording contexts. Keep all existing start guards, snapshots and lifecycle callbacks. Visual grouping is safer than replacing this coordinator. |
| `lab/GuidedRecommendation.tsx` | Both “¿Por qué esta sesión?” and “¿Por qué esta propuesta?” plus personal comparison and harmonic detail. Separate purpose is defensible but novices must open several explanations. Propose one visible explanatory entry with internal sections, without recomputing rules. |
| `lab/ProtocolRationale.tsx`, `lab/PersonalEvidence.tsx` | Good separation of evidence categories and descriptive N=1 limits. Avoid opening all of it by default; missing evidence must never be displayed as N=0. |
| `lab/HarmonicExplorer.tsx`, `lab/RelationshipApply.tsx`, `lab/OctaveApply.tsx` | Already explicit select/preview/apply and exploration-only states. Retain, collapsed in advanced Lab area; do not combine Apply with playback. |
| `lab/ConstellationBuilder.tsx` | Member editing, mode, signature, name, save/load/export and playback preview occupy significant space when expanded. Advanced purpose; preserve duplicates/order and explicit create/load/preview distinctions. |
| `lab/ExperimentSession.tsx` | Separate optional recording checkbox and intention/context/baseline are easy to miss below Lab tools. Guided intention and experiment intention are independent, not automatically linked. Bring visibility to recording in a later approved Lab slice without changing captured data. |
| `lab/SavedExperimentReader.tsx`, `lab/ConstellationAudit.tsx` | Correct read-only audit, legacy/no-identity distinction, absent values and export. Keep details secondary, no edit/re-run additions. |
| `lab/ProtocolDiscovery.tsx` | Candidate selection, rounds/strategy/metric/context/reservation recovery are legitimately advanced. Keep out of Simple first session; preserve fixed plans and explicit skip/cancel/recovery. |
| `lab/PersonalizedAdvisor.tsx` | Requires loading history and choosing a completed plan/context; raw scores/rule IDs and cards make advanced analysis explicit. Do not relabel as a universal home recommendation. |
| `lab/AdaptiveExplorer.tsx` | Best-current vs next-test, policy thresholds, override and fixed-plan guard are valuable but nested deeply under ranking. Keep advanced; do not imply all app history feeds it. |
| `lab/StructureProfile.tsx`, `lab/StructuralAnalysis.tsx` | Already optional disclosures; signatures/HCI/versioned provenance belong here. No simplification may recast HCI as benefit/quality. |
| `AudioVisualizer.tsx`, `BreathingGuide.tsx` | Existing visualizer and preparation guidance are legacy tools; not required for the Simple first-session flow. Preserve; reduced-motion/device checks deferred. |
| `SafetyDisclaimerModal.tsx` | Existing multilayer disclaimer acceptance is a separate contract from Voice privacy. Keep distinct; a unified acceptance would change consent semantics. |
| `CommandCardItem.tsx` | Expandable legacy reflective/OBE command cards; keep in reference, not default onboarding. Claims classification later. |
| `SessionLogForm.tsx`, `SessionLogItem.tsx` | OBE-specific states, energy 1–10, notes and deletion differ from voice/experiments; do not reuse as generic post-session form or migrate values. |

Associated CSS was inspected for existing layout/disclosure conventions; no pixel-level contrast/responsive certification is claimed. API handlers are not screens; their gating and failure fallback are included in the freeze inventory.

## 5. Duplicate or conflicting actions

1. **Three starts with different meaning:** dashboard “Sesión rápida”, sidebar “Nueva sesión” and “Viaje por voz”. Remedy: distinct intent-based, manual and legacy preparation labels.
2. **Multiple Lab confirmations:** “Confirmar y escuchar propuesta”, “Confirmar y reproducir constelación”, “Confirmar e iniciar” refer to different immutable/configuration sources. Remedy: visual containment and source labeling, never one ambiguous shared Play button.
3. **Repeated explanation entry points:** rationale versus interpreted-intention explanation versus comparison methodology. Remedy: one primary explanation entry in Simple, nested exact detail; preserve evidence distinctions.
4. **Repeated intentions:** guided text, Voice summary and optional Lab recording intention are not one shared field. Remedy: clarify ownership; do not auto-copy or alter provenance as a cosmetic change.
5. **Stop buttons across Lab sections:** guided, generic and advanced-session stop controls reach existing cleanup. Remedy: one visually dominant stop for the active context only after verifying lifecycle ownership; do not remove accessible stop paths blindly.
6. **Separate histories/export controls:** visible-versus-original, V1-versus-V2, voice-versus-OBE are meaningful distinctions, not redundant schemas. Consolidated data export is Phase 3F, not approved now.
7. **Availability versus roadmap:** landing future modules and current capabilities share presentation. Remedy: clearly separate future ideas; do not implement them to match copy.
8. **Positioning:** homepage “sanación”, “528 Hz Milagro”, legacy protocol names and root metadata differ from landing's exploration disclaimer. Flag for 3D; do not call the whole product claims-audited.

## 6. Proposed information and navigation hierarchy

No new routes or persistence. Proposed labels, subject to approval:

| Navigation level | Label / destination | Gate |
|---|---|---|
| Primary | Sesión guiada · `/voz` | VOICE ON |
| Secondary | Laboratorio · `/laboratorio-armonico` | HARMONIC ON |
| Existing destination | Inicio · `/` | Always; one dominant guided CTA when available |
| Group: Herramientas y referencias | Generador manual `/generador`; Protocolos clásicos `/protocolos`; Biblioteca `/biblioteca` | Always |
| Group: Práctica OBE existente | Preparación OBE `/sesion-nueva`; Diario OBE `/diario` | Always |

The existing paths remain accessible; “group” is proposed presentation, not a route or saved mode. Preserve mobile menu behavior and current flag conditions. Landing primary entry can point directly to `/voz` when enabled and `/` otherwise; Lab remains secondary. Do not redirect `/` or remove catalog content without a separate approved change.

At each Simple state: one primary action; edit/back/cancel secondary; technical disclosures tertiary. During playback, stop remains immediately available. Safety warnings, experimental consent, provider unavailability and save failure remain visible even if advanced details collapse.

## 7. Small, reversible implementation slices proposed for approval

### 3B.1 — Entry hierarchy and names (recommended first)

Problem: a novice cannot distinguish guided text, manual synthesis and OBE preparation from current entry labels.

Fix: make guided session the dominant enabled entry; clarify labels and group legacy tools. Preserve routes, all content access and flag fallback. No recording or playback handler changes.

Exact likely runtime files:
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/landing/page.tsx`
- `frontend/src/components/landing/landing.module.css` only if hierarchy needs it

Exact likely test files:
- `frontend/ui/harmonic-flows.test.mjs` (navigation labels used by cleanup tests)
- `frontend/scripts/landing-smoke.mjs` (verified existing landing assertions)
- `frontend/scripts/ci-smoke.mjs` (existing landing/gated CTA expectations)

Acceptance: first-session CTA works with VOICE ON; no hidden-route links with flags OFF; all nine routes retain availability; existing tools reachable; no autoplay, storage writes, data migrations or consent bypass; desktop/mobile menu keyboard flow retained. Risk: UI tests reference literal labels; update assertions to preserve semantics, not remove coverage.

### 3B.2 — Simple flow presentation (approve separately)

Problem: technical/repeated material distracts from interpretation → review → confirmation → result.

Fix: text-or-voice title, consistent primary action language, optional advanced/repeated disclosures. Preserve active form state and all handlers. No new rating fields or onboarding persistence.

Exact likely files: `frontend/src/components/voice/VoiceJourney.tsx`, `Fields.tsx`, `PrivacyGate.tsx`, `voice.module.css`; `frontend/src/components/lab/ProtocolRationale.tsx` and `PersonalEvidence.tsx` only for approved shared display changes; `frontend/ui/harmonic-flows.test.mjs`.

Acceptance: complete through text with no harmonic expertise; review/correct before confirm; experimental consent cannot be hidden or prechecked; before/after blanks and zero preserved; natural end versus stop maintained; explicit save/failure export and history remain; no claim of automatic learned ranking.

### 3B.3 — Lab organization (approve after the first two)

Problem: several configuration sources and confirmations appear together; optional recording can be overlooked.

Fix: clearer source-specific groups and recording placement, keeping mounted coordinators/recorders and source-specific buttons. No merger of independent schemas or results.

Exact likely files: `frontend/src/components/voice/HarmonicLab.tsx`, `frontend/src/components/lab/GuidedRecommendation.tsx`, `frontend/src/components/lab/ExperimentSession.tsx`, `frontend/src/components/voice/voice.module.css`, `frontend/ui/harmonic-flows.test.mjs`.

Acceptance: manual, guided, saved constellation, Discovery, personal and adaptive flows still select the same exact configurations; no Apply=Play; no stale confirmation; recorder remains attached to the intended session; navigation/hidden tab still cancels/interrupts and never autosaves or falsely completes; fixed assignments unchanged.

Do not touch engines, rules, adapters, validators, stores, schemas, catalogs, protocols or production configuration in these presentation slices. If an implementation needs that, stop and report the material contract change.

## 8. Regression risks / gates

| Risk | Required verification after an approved change |
|---|---|
| Collapsing/unmounting a live form loses draft/engine ownership | Keep component identity; confirm/start/stop/navigate/hidden-tab tests on every existing path |
| Relabeling hides the wrong route with flags OFF | Build/smoke ON and OFF; landing CTA plus legacy-route checks |
| Consolidated explanation masks experimental consent or remote processing | Explicit consent/provider/error states remain visible and tested |
| Moving recorder captures different state/config | Exact V1/V2 and constellation snapshots; no fields added; before/after zero/missing tests |
| Grouped nav affects focus, mobile menu or deep links | Keyboard/focus/narrow viewport checks; existing links and route addresses preserved |
| History wording implies unavailable adaptive integration | Separate Voice descriptive evidence, Discovery ranking and exploratory followups in copy |
| A visual “single Play” conflates candidates | Keep preview identity/config race guards and source-specific confirmation |
| Legacy content rewritten without evidence review | Stage claims/protocol changes for 3C/3D; preserve catalog identity and historical data |

Run full unit/integration/UI/typecheck/lint/builds/HTTP/landing ON/OFF/CI after each implementation slice. Repeat relevant manual audio/UX checks. Documentation-only work does not certify physical listening, new usability percentages, beta completion or zero P0/P1 bugs.

## 9. Open gates for subsequent closeout phases

- 3C: registry of existing rules, legacy protocols, aliases and seed rationale; no new protocol families to meet a count.
- 3D: full claims/safety audit; examples above are preliminary flags, not a completed evidence review.
- 3E: physical listening with the specified browsers/devices/output matrix; human/device access required, no fabricated results.
- 3F: actual unified export assessment, legacy corruption weakness and per-origin history; no new storage architecture.
- 3G: under-two-minute onboarding; proposed Simple presentation alone is not its completion.
- 3H: analytics is conditional; decide necessity/privacy before adding collection. No telemetry in this task.
- 3K: mobile/accessibility/performance audit; source spot checks do not replace it.
- 3I/3J: real closed beta and scoped fixes; targets must be agreed before recruitment; no outreach authorized here.
- 3L: privacy/terms and product-copy verification; no legal advice or public-launch approval.
- 3M: RC1 only after every required gate, beta and P0/P1 triage. Main/production require explicit approval.

## Decision requested

Approve, revise or reject **3B.1 only** first. This audit does not authorize implementation of any of the three slices. No UX or product code was changed in Phase 3A + 3B audit.

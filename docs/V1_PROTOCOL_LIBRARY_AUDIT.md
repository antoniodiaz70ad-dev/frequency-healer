# Frequency Healer V1 Protocol Library Audit

## Scope and baseline

This Phase 3C audit uses branch `codex/voice-journey-grant` at baseline commit `8042a5755925e1dc962cb405b61ecbfe5d341c51`. It adds a non-persistent provenance registry. It does not change audio, schedules, recommendation or personalization scoring, storage, schemas, routes, or user-facing copy.

## Current source inventory

| Source | Current responsibility | Audit finding |
| --- | --- | --- |
| `frontend/src/lib/voice/types.ts` | Seven guided goals and six desired-state labels | Authoritative guided taxonomy. |
| `frontend/src/lib/voice/intentParser.ts` | Direct Spanish/English intent matching | Six direct goals; unmatched text becomes `custom` and requires review. |
| `frontend/src/lib/voice/rules.ts` | Deterministic goal/intensity → configuration/schedule | Authoritative guided acoustic rules: seed 144 Hz, sequence mode, sine wave, fixed progressions or 13/12 cascade. |
| `frontend/src/lib/voice/i18n.ts` | Goal labels and short rationale | Matches the seven guided goals. |
| `frontend/src/lib/guided/recommendations.ts` | Safety boundary, aliases, recommendation and personal evidence | Recovery, grounding and emotional regulation map to `relaxation`; meditation/integration map to `reflection`; no new acoustic rules. |
| `frontend/src/lib/guided/rationale.ts` | “Why this session?” component provenance | Separates mathematical, acoustic, protocol-design, traditional, exploratory and personal-N=1 labels. It does not cite published evidence. |
| `frontend/src/lib/discovery/model.ts` | User-selected 2–3 candidate experiments | Candidates reference a current voice rule or an exact saved constellation. Seeds are explicit user choices or saved-constellation values. |
| `frontend/src/lib/personalization/ranking.ts` | Descriptive ordering over completed comparable Discovery plans | User-specific and dynamic; correctly remains outside static protocol definitions. |
| `frontend/src/lib/adaptive/policy.ts` | Deterministic next-step exploration over validated candidates | Operates on validated plan candidates, not the legacy catalog. No policy change is needed. |
| `frontend/src/lib/protocols.ts` | Fifteen independently playable legacy protocols | Separate historical catalog with medical, biological and metaphysical claims. It is not used by guided recommendation. |
| `frontend/src/lib/frequencies.ts` | Legacy frequency catalog and quick-frequency metadata | Contains fixed-frequency folklore and unsupported “verified” labels; not used as evidence by guided recommendation. |
| `frontend/src/app/protocolos/page.tsx` | Legacy protocol browser/player | Displays legacy names/descriptions and plays their stored steps. |
| `frontend/src/app/biblioteca/page.tsx`, `frontend/src/app/generador/page.tsx`, `frontend/src/app/page.tsx` | Legacy catalog, presets and home summaries | Expose legacy claims and labels outside the guided path. |
| `frontend/src/components/voice/VoiceJourney.tsx`, `frontend/src/components/lab/GuidedRecommendation.tsx` | Guided proposal review | Display rule IDs and deterministic rationale before explicit playback. |
| `frontend/src/components/lab/ProtocolDiscovery.tsx`, `PersonalizedAdvisor.tsx`, `AdaptiveExplorer.tsx` | Advanced N=1 flows | Preserve candidate provenance and exact snapshots; no orphan executable configuration found. |

## Canonical V1 guided library

The machine-readable registry is `frontend/src/lib/protocolLibrary.ts`, version `protocol-library-v1`. It references current `voice-rules-v1` IDs and contains no schedules or executable acoustic values.

| Canonical ID | User-facing family | Status | Current intent mapping | Executable rule family |
| --- | --- | --- | --- | --- |
| `guided-clarity` | Claridad | active | clarity | `voice-clarity-*` |
| `guided-focus` | Enfoque | active | focus | `voice-focus-*` |
| `guided-calm` | Calma | active | relaxation; recovery; grounding; emotional regulation | `voice-relaxation-*` |
| `guided-reflection` | Reflexión e integración | active | reflection; meditation; integration | `voice-reflection-*` |
| `guided-sleep-preparation` | Preparación para dormir | active | sleep preparation | `voice-sleep_preparation-*` |
| `guided-creative-exploration` | Exploración creativa | exploratory | creative exploration | `voice-creative_exploration-*` |
| `guided-custom-review` | Exploración personalizada | exploratory | unmatched/custom | `voice-custom-*` |

This is seven protocol families rather than the suggested ten because the repository has only seven executable goal families. Recovery, grounding and emotional regulation are transparent aliases of relaxation. Meditation and integration are aliases of reflection. “Subjective energy” currently enters through recovery wording and also resolves to relaxation. Creating independent records for these labels would imply acoustic distinctions that do not exist.

No canonical guided definition is deprecated in Phase 3C. Deprecation applies to the legacy entries below as a product recommendation; IDs and lookup remain untouched for historical readability.

## Canonical contract

`ProtocolDefinitionV1` contains schema/library/version identity, status, user-facing text, intent categories, optional target state, referenced rule IDs, seed-selection and evidence bases, relationship rationale, duration range, playback modes, limitations and a declaration that personalization is supported. Personal scores and observations are never embedded. The registry has no storage key and performs no writes.

Evidence labels are exactly `MATHEMATICAL`, `ACOUSTIC`, `PROTOCOL_DESIGN`, `TRADITIONAL_HISTORICAL`, `EXPLORATORY`, `PERSONAL_N1`, and `PUBLISHED_EVIDENCE`. `PUBLISHED_EVIDENCE` is unused because the repository has no source record sufficient to support a publication claim.

## Seed and relationship rationale

Every guided rule currently starts from 144 Hz. The eligible bases are deterministic rule design, harmonic compatibility and supported-range headroom. This is not a traditional healing attribution and is not evidence for an outcome. Discovery can replace it only through an explicit user-selected seed or an exact saved-constellation seed; those values are candidate inputs rather than canonical protocol defaults.

The guided library uses exact 1:1, 5:4, 6:5, 4:3 and 3:2 relationships. Their ratios are mathematical facts; their order and association with an intent are protocol-design choices. Sequence playback is an acoustic organization choice. The 13/12 cascade is mathematical plus exploratory and continues to require additional consent. No relationship is assigned therapeutic meaning.

## Legacy protocol disposition

All fifteen legacy IDs remain readable through `getProtocolById` and remain playable exactly as before in Phase 3C.

| Legacy ID | Recommended V1 disposition | Reason |
| --- | --- | --- |
| `solfeggio-ascension` | exploratory; relabel | Sacred cleansing/elevation claims require traditional attribution, not core placement. |
| `sanacion-cuerpo` | deprecate from new recommendations | Antibacterial, antiviral and immune claims are medical and unsupported here. |
| `meditacion-profunda` | exploratory; rewrite | “Induce deep states” overstates what the stored binaural design establishes. |
| `gamma-neuroproteccion` | deprecate from new recommendations | Alzheimer/plaque claim extrapolates research without an actual citation or equivalent delivery evidence. |
| `desintoxicacion` | deprecate from new recommendations | Parasite/bacteria elimination is an unsupported treatment claim. |
| `sueno-profundo` | exploratory; rewrite | Sleep preparation is supportable as an intention; induction and restorative-effect claims are not. |
| `equilibrio-432` | exploratory; relabel | Cathedral history and special 432 Hz implication are unsubstantiated in the repository. |
| `despertar-espiritual` | exploratory; relabel | Third-eye, crown and divine-connection language is metaphysical interpretation. |
| `frecuencia-milagro` | deprecate from new recommendations | DNA repair, miracle, love and “most powerful” claims are unsupported. |
| `antiparasitario` | deprecate from new recommendations | Antiparasitic effectiveness is an unsupported treatment claim. |
| `resonancia-alfa-iq` | deprecate from new recommendations | “Biometric signature of genius” and IQ-training implications are unsupported. |
| `samadhi-alpha` | exploratory; rewrite | Cultural framing may remain attributed; claims of extreme tolerance/imperturbability should not. |
| `satori-alpha` | exploratory; rewrite | Cultural framing may remain attributed; millisecond suppression/reactivity claims need evidence. |
| `neurofeedback-alfa` | deprecate from new recommendations | The app is not measuring EEG feedback; calling fixed tones neurofeedback is misleading. |
| `sincronizacion-grupal` | deprecate from new recommendations | Mind synchronization and exponential group-performance claims are unsupported. |

“Deprecated from new recommendations” is an audit classification, not a runtime mutation. The current guided recommender never selects any of these IDs, so they cannot outrank the canonical core today. Phase 3D should change presentation and claims while preserving ID-based historical readability.

## Claim findings

The legacy frequency database repeats many of the same issues and additionally labels entries `verificada` without resolvable citations. Findings include cellular regeneration, growth-hormone release, subconscious access, emotional healing, planetary resonance effects, high IQ/genius, neurological association, Alzheimer plaque reduction, pain relief, tissue restoration, DNA repair, miracle/love frequency, chakra activation, immune stimulation and Rife/CAFL disease or parasite claims. Quick presets and metadata repeat “528 Hz Milagro”, “174 Hz Dolor”, “880 Hz Inmune”, “Sanación Física” and general healing language.

Recommended Phase 3D treatment is to preserve numerical values and IDs, replace mechanism/outcome claims with neutral acoustic descriptions, move attributed traditions into an explicitly exploratory historical section, and remove medical efficacy labels from current navigation/presets. Where a real publication is later cited, describe only the studied stimulus, population and limits; do not transfer the result automatically to this app.

## Duplicate and conflicting mappings

- Recovery, grounding, emotional regulation and subjective low-energy wording all resolve to the same relaxation rule. This is intentional aliasing, not four protocols.
- Meditation and integration resolve to reflection, while the legacy catalog separately exposes `meditacion-profunda`, `samadhi-alpha` and `satori-alpha`. These legacy entries are not guided recommendations.
- Sleep preparation uses the guided harmonic rule; `sueno-profundo` is a separate legacy binaural sequence with stronger claims.
- Creative exploration always selects the existing 13/12 cascade even when intensity is gentle/deep. It therefore remains exploratory at the protocol-family level.
- Experimental intensity makes any guided goal use the 13/12 cascade. The protocol remains traceable to its goal rule ID, while the proposal explicitly requires experimental consent.
- `custom` is an executable neutral fallback but not a confidently interpreted recommendation; review remains mandatory.

## Recommendation provenance result

The chain is complete for current guided sessions: parsed goal or documented alias → `voice-{goal}-{intensity}` → exact proposal and schedule → component rationale → optional Discovery candidate → descriptive personalization/adaptive selection. Every generated current rule ID resolves to exactly one canonical definition. Constellation candidates retain their own immutable identity and do not claim membership in a guided protocol family.

Legacy protocols are a separate direct-play catalog and have no guided rule provenance. They must not be described as canonical recommendations until a later phase explicitly reconciles their presentation. Historical records remain readable by their original IDs.

## Limitations and next audit

The registry documents present behavior; it does not make the behavior clinically effective. Duration remains user-provided (default 15 minutes), not a dose. Volume is a UI value, not calibrated SPL. Headphones, speakers and device gain vary. Personal N=1 evidence is descriptive and cannot establish causality. HIP/HCI remains structural metadata and is absent from the protocol quality model.

Phase 3D should perform the claims and safety cleanup identified above across `protocols.ts`, `frequencies.ts`, home, generator, protocol browser, metadata and related copy. It should preserve all IDs, frequency values, steps, audio behavior, routes and historical lookup while making exploratory/traditional status visible and removing unsupported efficacy wording.

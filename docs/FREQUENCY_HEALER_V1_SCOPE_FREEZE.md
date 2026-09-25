# Frequency Healer — V1 scope freeze

Status: Phase 3A documentation draft delivered; feature scope frozen. This is not RC1 approval.

Audited 2026-09-20 against `39e6ddc62804d23b8b736e8885a93f84b4c4e4ed`, branch `codex/voice-journey-grant`, clean working tree at start. Main and production are outside this task. The accepted Phase 2F preview is https://frequency-healer-byqnhu7s1-leviathan1.vercel.app/laboratorio-armonico.

## Authorized task and acceptance

Problem: the implemented surface is larger than the first-session journey, and inventory, constraints and deferred work are distributed across phases.

Fix in this task: document the actual frozen implementation and audit UX. Files changed: this document, [UX audit](V1_UX_SIMPLIFICATION_AUDIT.md), [post-v1 backlog](FREQUENCY_HEALER_POST_V1_BACKLOG.md). No application, audio, schema, storage, routes, deployment, dependencies or tests are modified. Regression risk: inaccurate documentation; mitigate with direct source references, inventory checks and explicit distinction between implemented, proposed and unverified.

Acceptance: inventory all routes, storage namespaces, versioned contracts and flags; identify concrete UX changes and protected contracts; stop before implementing any UX changes. Phase 3C onward is not executed here.

## Frozen implementation inventory

| Area | Actual v1 capability | Source / constraint |
|---|---|---|
| Existing dashboard | Catalog overview, three exploration links when enabled, frequency/protocol shortcuts, domains/categories | `frontend/src/app/page.tsx`; remains `/`, not the landing page |
| Legacy generator | Tone controls, waveforms, tuning, binaural options, timer, Focus/multilayer/Solfeggio presets, visualizer | `app/generador/page.tsx`, `lib/audioEngine.ts`, `lib/focusLevels.ts`; preserve behavior and presets |
| Legacy protocols/catalog | 15 protocol entries; 40 frequency entries in five categories, domain/evidence filtering; command cards | `lib/protocols.ts`, `lib/frequencies.ts`, `lib/commandCards.ts`; counts are this baseline, not efficacy claims |
| Legacy preparation/diary | OBE/Focus preparation, calendar alarm, breathing, intention, diary entries and cooldown heuristics | `app/sesion-nueva`, `app/diario`, `lib/sessionLog.ts`; separate legacy records |
| Voice Journey | Text-first-capable intention flow; optional capture/transcription, review, local deterministic proposal, rationale, explicit confirmation, markers/commands, optional pre/post ratings/reflection, explicit save/export/delete | `components/voice/VoiceJourney.tsx`, `lib/voice/*`; microphone is optional; remote transcription needs a configured provider |
| Guided Lab entry | Natural-language guided interpretation, aliases, review, same acoustic rules, rationale, manual correction and confirmation | `components/lab/GuidedRecommendation.tsx`, `lib/guided/*`; not the Phase 2D personal-ranking engine |
| Harmonic Lab | Seed/ratio/mode/duration/volume controls, manual confirmation and stop, existing 13/12 cascade | `components/voice/HarmonicLab.tsx`, `lib/harmonic/math.ts`, `engine.ts` |
| Explorers | Ratio/octave mathematics; preview versus current controls; exact supported inverse Apply; explicit octave seed transformation | `HarmonicExplorer`, `RelationshipApply`, `OctaveApply`; select != apply != play |
| Constellations | Root/ratio/octave members, duplicates, order/mode, validation, deterministic signature, name, explicit create/load/export | `ConstellationBuilder`, `lib/harmonic/constellations.ts`, `constellationStorage.ts`; building/loading never plays |
| Constellation playback | Saved validated root/ratio structures translated exactly to the existing V1 scheduler; sequence/simultaneous and multiplicity retained | `lib/harmonic/constellationPlayback.ts`; reject unsupported structures, no approximation |
| Manual experiments | Optional V1 recording; additive V2 constellation-linked audit; immutable played config, optional expectation/context/pre/post/reflection; explicit save/export, read-only reader | `lib/experiments/*`, `ExperimentSession`, `SavedExperimentReader`; no migration |
| Discovery | Explicit candidate selection, fixed balanced/randomized-balanced assignments, activation/reservation/result lifecycle, comparison by exact recorded context | `lib/discovery/*`, `ProtocolDiscovery`; no adaptive rewriting of a plan |
| Personalization | Deterministic descriptive ranking of comparable candidates from completed Discovery plans; rationale, alternatives, separate audited V2 execution | `lib/personalization/*`, `PersonalizedAdvisor`; thresholds are product rules |
| HIP/HCI | On-demand structural descriptors, explicit index terms, advanced descriptive grouping/export | `lib/harmonic/profile/*`, `StructureProfile`, `StructuralAnalysis`; no effectiveness weighting |
| Adaptive exploration | Best-current versus next-test, deterministic floor/imbalance/uncertainty policy, explanation, choice/override, separately saved audit, fixed-plan guard | `lib/adaptive/*`, `AdaptiveExplorer`; no autonomous playback, scoring or protocol mutation |
| Landing | Cinematic muted hero, mobile asset, poster/reduced-motion fallback, method, app/Lab links | `app/landing/page.tsx`, `components/landing/*`; English marketing surface, separate from Spanish app |
| Regression infrastructure | Node 22.14, npm lockfile, unit/integration, native Chrome UI, typecheck/lint, ON/OFF builds and HTTP/landing smoke | `.github/workflows/`; existing jobs Quality, Flags ON, Flags OFF |

Seven canonical acoustic intention categories exist: `clarity`, `focus`, `relaxation`, `reflection`, `creative_exploration`, `sleep_preparation`, `custom`. Guided recovery/energy/grounding/emotional-regulation expressions map to existing categories; meditation/integration map to reflection. They are not extra protocol families. The suggested 8–12 user-facing intentions in Phase 3C is an audit organization target, not permission to add rules.

## Acoustic boundaries to preserve

Two existing browser engines remain: legacy `lib/audioEngine.ts` and harmonic `lib/harmonic/engine.ts`. Voice/Lab guided flows reuse the harmonic engine. The Python WAV generator is a separate pre-existing backend utility, not a new browser playback engine.

Harmonic V1 validates seed and derived frequencies in 40–2000 Hz, sine waveform, sequence/simultaneous, duration 1–3600 seconds, volume 0–100; UI duration constraints differ by flow (manual Lab 1–60 minutes; guided/voice 5–60). Master gain is `0.25 × volume/100`, simultaneous voice gain `1/N`, maximum nine simultaneous voices. Sequence cascade return may have more than nine scheduled steps; that is not permission for more simultaneous voices.

Exact playable catalog relationships: root 1:1, fifth 3:2, fourth 4:3, major third 5:4, minor third 6:5. Existing manual 13/12 cascade remains supported with consent. Constellation playback accepts at most nine root/ratio members representable exactly in the existing progression. Octave-typed members, 5:3, 2:1 and arbitrary ratios remain builder/exploration-only for constellation playback. Explorer octave Apply changes the seed through the existing adapter; it does not make octave members playable. No silent drop, deduplication, clamp or folding.

## Current route inventory

| Route | Current entry / function | Availability |
|---|---|---|
| `/` | Dashboard with catalog and links | Always |
| `/landing` | Public marketing/method; no app sidebar | Always; Lab CTA gated |
| `/voz` | Complete text/optional-voice session and voice history | VOICE flag, otherwise 404 |
| `/laboratorio-armonico` | Guided/manual Lab, explorers, builder, histories, Discovery/ranking/adaptive | HARMONIC flag, otherwise 404 |
| `/generador` | Legacy tone and multilayer generator; `focus`/`duration` query flow from preparation | Always |
| `/protocolos` | Legacy protocol list/player | Always |
| `/biblioteca` | Frequency catalog and command cards | Always |
| `/diario` | OBE diary and cooldown view; not a unified history | Always |
| `/sesion-nueva` | Existing Focus/OBE preparation workflow | Always |
| `POST /api/voice/interpret` | Optional remote intention extraction, same-origin/rate/payload guards | VOICE flag; AI gate + provider configuration; otherwise guarded fallback |
| `POST /api/voice/transcribe` | Optional remote transcription, guarded short capture | VOICE flag + provider configuration; otherwise guarded fallback |

Separate FastAPI routes in `backend/main.py`: GET `/api/frequencies`, `/api/frequencies/{freq_id}`, `/api/search`, `/api/health`; POST `/api/generate-wav`, `/api/generate-binaural-wav`, `/api/generate-protocol-wav`. They are not Next.js routes, are not wired through `next.config.ts`, and are not claimed available in the Vercel preview. No account/auth/cloud-history implementation was found in the audited frontend; Vercel preview access protection is a deployment service, not product authentication.

## Flags and environment configuration

| Name | Actual behavior | Baseline evidence |
|---|---|---|
| `NEXT_PUBLIC_VOICE_JOURNEY_ENABLED` | Exact string `true` enables route, navigation and API gate | Default absent = OFF; accepted preview/CI ON = true |
| `NEXT_PUBLIC_HARMONIC_LAB_ENABLED` | Exact string `true` enables Lab route/navigation/landing CTA | Default absent = OFF; accepted preview/CI ON = true |
| `VOICE_AI_ENABLED` | Server-side opt-in for remote intent interpretation, also requires URL/token | Accepted preview and regression matrix false |
| `VOICE_TRANSCRIPTION_URL`, `VOICE_TRANSCRIPTION_TOKEN` | Capability configuration, not additional Boolean flags | Preview privacy screen confirms no transcription provider enabled |
| `VOICE_INTENT_URL`, `VOICE_INTENT_TOKEN` | Server-only optional interpreter configuration | Values not inspected or copied |
| `VOICE_PROCESSING_VERSION` | Consent-processing version input; default `v1`, hashed with configured endpoints | Does not itself activate remote processing |
| `VERCEL` | Infrastructure detection for rate-limit proxy header handling | Not a product feature flag |

Public flags are compiled into the frontend; changing runtime environment alone is not a documented substitute for rebuilding. No new closeout flag. No production variable changes or secret inventory. Test-only `FH_UI_*` and telemetry/build environment controls are infrastructure, not product capabilities.

## All current localStorage namespaces

There are twelve keys referenced in application source. No IndexedDB, cloud sync or consolidated history migration is implemented.

| Key | Payload/version | Writer / special behavior |
|---|---|---|
| `fh:voice-sessions-v1` | Array of VoiceSessionRecordV1, `schemaVersion:1` | `lib/voice/storage.ts`; explicit save; maximum 100; delete/export controls |
| `fh:voice-consent-v1` | `{schemaVersion:1, version, acceptedAt}` | `lib/voice/privacy.ts`; consent action; processing-version-specific |
| `fh:voice-settings-v1` | `{schemaVersion:1, keepOriginal}` | Original-word preference; setting action writes immediately |
| `fh:experiment-sessions-v1` | Array of ExperimentRecordV1 | Manual explicit save; runtime validation/corruption-safe |
| `fh:experiment-sessions-v2` | Array of ExperimentRecordV2 | Separate additive store, no V1 rewrite |
| `fh:harmonic-constellations-v1` | Array of HarmonicConstellationV1 | Explicit create; no replacement/import feature |
| `fh:protocol-discovery-plans-v1` | Array of ProtocolDiscoveryPlanV1 with assignments/results | Explicit plan actions plus reservation at confirmed start; it is not result autosave |
| `fh:personalized-experiments-v1` | PersonalizedExperimentV1 wrapper + V2 experiment | Explicit save, full recommendation provenance |
| `fh:adaptive-experiments-v1` | AdaptiveExperimentV1 wrapper + V2 experiment | Explicit save; suggestion/choice audit, not cache |
| `fh:obe-session-logs-v1` | Array of OBESessionLog; no per-record schemaVersion | Legacy diary save/delete; weaker validation than new stores |
| `fh:next-session-config-v1` | `{focusId,duration,intention,startedAt}`; no per-payload schemaVersion | Written by legacy preparation before navigation |
| `fh:hemi-sync-disclaimer-accepted-v1` | String `"1"`; key-version only | Legacy disclaimer acceptance |

Do not describe every write as session save: preferences, consent and fixed-plan reservation have their own explicit interactions. No actual user payloads were read or changed in this audit. Browser data is per origin; preview changes do not transfer history.

## Contracts and algorithm versions

| Contract | Version / identity |
|---|---|
| ParsedIntentionV1 / VoiceSessionProposalV1 / VoiceSessionRecordV1 | `schemaVersion:1`; proposal `voice-rules-v1` |
| SessionMarkerV1 / SelfRatingV1 | Nested typed values; no separate stored schemaVersion |
| Voice lifecycle | `completed`, `stopped`, `error`; do not reinterpret as experiment states |
| ExperimentRecordV1 / ExperimentRecordV2 | `schemaVersion:1` / `2`; V2 optional exact constellation reference + snapshot; shared prepared/started/completed/cancelled/interrupted states |
| HarmonicConfig / HarmonicSchedule | Existing V1 semantics, no schemaVersion field; do not add one for documentation |
| HarmonicConstellationV1 | `schemaVersion:1`, `harmonic-constellation-v1`, `sha256:` signature; display name not mathematical identity |
| ConstellationPlaybackPlan | Derived validated constellation/config/schedule; no separate persisted schemaVersion |
| GuidedInterpretationV1 / GuidedRecommendationV1 | `schemaVersion:1`, mapping `guided-mapping-v1`; existing rule version |
| HarmonicRecommendationRuleV1 / ProtocolRationaleV1 | `schemaVersion:1`; rule generation `voice-rules-v1`; design/evidence labels separate |
| PersonalEvidenceV1 / voice N=1 summaries | Derived typed views; no independent persistent version field |
| ProtocolCandidateV1 / ProtocolDiscoveryPlanV1 / DiscoveryExperimentV1 | `schemaVersion:1`; assignments nested in plan; comparability policy `schemaVersion:1` |
| DiscoveryContextV1 / AssignmentV1 | Nested values; no independent numeric schema field |
| PersonalizedRecommendationSetV1 / per-candidate recommendation | `schemaVersion:1`, algorithm `personalization-v1` |
| PersonalizedExperimentV1 | Wrapper `schemaVersion:1`, unchanged ExperimentRecordV2 |
| HIP / HCI / HarmonicStructureV1 / structural report | `schemaVersion:1`; `harmonic-information-v1`, `harmonic-complexity-v1`; computed, not new stores |
| AdaptiveExplorationSuggestionV1 | `schemaVersion:1`, `adaptive-exploration-v1`; candidate/evidence nested types |
| AdaptiveExperimentV1 | Wrapper `schemaVersion:1`, unchanged ExperimentRecordV2 |
| OBESessionLog / legacy protocol/catalog/presets/preferences types | No explicit stored per-record version unless noted above; suffixes in storage keys do not fabricate fields |

## Known limitations and open gates

1. No unified Simple Mode default or first-use onboarding. `/` remains a catalog dashboard and `/voz` is labeled as voice despite text support. See UX audit.
2. Voice history describes changes; it does not train/reorder its deterministic proposals. Phase 2D ranks completed Discovery evidence; Phase 2F adds comparable exploration audits for next-test selection. No automatic bridge from an ordinary saved voice session to adaptive ranking. The desired future return journey is only partially integrated.
3. Voice and experiment rating/lifecycle schemas differ: clarity/stress/focus versus clarity/tension/focus/energy/mood; missing values remain absent. Do not merge them cosmetically or numerically.
4. Remote voice processing is optional and not configured in the accepted preview. Text works. The app does not retain raw audio; external provider retention approval remains required before enabling it.
5. No unified user-data export/import/reset. Exports are per subsystem; no diary export control was found. Do not claim backup/restore is complete.
6. New stores reject malformed payloads; legacy OBE loading catches invalid JSON/non-arrays as empty and does not deeply validate array entries. Subsequent legacy save could replace malformed content. This pre-existing data-integrity concern needs Phase 3F triage, not an unapproved fix here.
7. Unsaved drafts may be lost on navigation. Discovery reservations can remain unresolved and require explicit recovery. No false completed state or autosave should be introduced to hide this.
8. Full snapshot audits grow localStorage; quota is finite. Large-history/device performance is not certified. No automatic compaction/cloud backup.
9. Native automated cleanup passed, but physical listening across Chrome/Safari/iPhone/Android/headphones/speakers has not been completed. The known local macOS output-clock issue was isolated by a native test sink; that is not physical acceptance.
10. Landing and legacy dashboard/catalog use different positioning/language. Existing medical/traditional-sounding strings need Phase 3D classification; no current claim is endorsed by this document.
11. Landing contains explicitly planned Belief Mirror, Probability Lab and future map copy. These are not implemented/frozen v1 functionality.
12. PrivacyGate is an existing voice disclosure, not a complete Privacy/Terms publication. No dedicated privacy/terms routes found. Phase 3L remains open; no legal readiness claim.
13. Serious-language guard is a deterministic text boundary, not a diagnostic or comprehensive emergency-detection system.
14. Minimal counters in `voice/privacy.ts` are in-memory technical errors, not product telemetry. Phase 3H analytics has not been added.
15. Mobile/responsive/accessibility/performance and 10–20-person closed beta acceptance remain open. Automated coverage does not establish zero undiscovered P0/P1 issues.

## Validation evidence and freeze rule

Accepted Phase 2F CI: https://github.com/antoniodiaz70ad-dev/frequency-healer/actions/runs/35528524087 — 177 unit/integration + 87 UI = 264 pass, TypeScript/lint/builds and HTTP/landing ON/OFF pass. This is the baseline, not a new physical or beta validation.

This task changes Markdown only. Documentation checks verify route/key inventories, referenced file paths, clean diff and no runtime changes. Any later implementation phase must run the full gate prescribed in the closeout plan. No new preview is needed for documentation-only changes.

Preserve all current functionality until a separately reviewed closeout change is approved. No new protocol families, intelligence, engines, schemas, analytics or cloud architecture. [Backlog](FREQUENCY_HEALER_POST_V1_BACKLOG.md) is not authorization. RC1 remains blocked on the named closeout gates; passing CI alone does not authorize merge or production.

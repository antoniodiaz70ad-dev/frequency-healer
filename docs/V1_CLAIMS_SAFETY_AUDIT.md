# Frequency Healer V1 Claims & Safety Audit

## Scope

Phase 3D audited and classified 56 claim-bearing catalog records: 41 frequency entries and 15 historical protocols. It also reviewed the related home, generator, library, protocol page and application metadata. IDs, numeric frequencies, steps, durations, waveforms, volume, binaural differences and execution paths remain unchanged.

## Files audited

- `frontend/src/lib/frequencies.ts`, `protocols.ts`, `protocolLibrary.ts`, `types.ts`
- `frontend/src/app/page.tsx`, `generador/page.tsx`, `biblioteca/page.tsx`, `protocolos/page.tsx`, `layout.tsx`, `landing/page.tsx`
- `frontend/src/lib/voice/*`, `guided/*`, `discovery/*`, `personalization/*`, `adaptive/*`, `harmonic/profile/*`
- `frontend/src/components/voice/*` and the recommendation/rationale components under `frontend/src/components/lab`
- `frontend/src/lib/commandCards.ts` and `frontend/src/components/SessionLogForm.tsx` as residual-risk sources

## Classification model

Phase 3D extends the Phase 3C evidence vocabulary with `UNSUPPORTED_LEGACY_CLAIM`. It does not introduce a parallel evidence system. Frequency classifications are deterministic metadata: Solfeggio is `TRADITIONAL_HISTORICAL`; Rife/CAFL and Nogier are `UNSUPPORTED_LEGACY_CLAIM`; brainwave and musical catalog entries are `EXPLORATORY`. No catalog entry is labeled `PUBLISHED_EVIDENCE` because no repository source establishes the displayed outcome claim.

The 15 protocol dispositions remain the Phase 3C set: seven exploratory/historical entries and eight deprecated from new recommendations. Deprecation does not delete an ID or disable historical playback. The guided recommender does not select these entries.

## Findings and actions

| Claim class | Findings | Classification and action |
| --- | --- | --- |
| Medical / physiological | DNA or tissue repair, regeneration, hormone release, antibacterial/antiviral/immune/antiparasitic effects, detoxification, Alzheimer plaques, neuroprotection, pain, allergies and sleep induction | Rewritten as historical associations or unsupported legacy claims. No treatment or physiological outcome is asserted. |
| Cognitive | IQ/genius, accelerated processing, brain coherence, neurofeedback equivalence, extreme reactivity and group synchronization | Neutralized. Alpha/Gamma values remain as acoustic references; the UI states that it does not measure EEG or provide neurofeedback. |
| Spiritual / metaphysical | Sacred cleansing, ascension, third eye, crown, pineal activation, divine connection and energetic fields | Retained only as attributed modern spiritual or Solfeggio context and labeled historical/exploratory. |
| Mechanistic | A specific Hz presented as causing a mental, biological or interpersonal result | Replaced with the exact tone/band description plus an explicit limit on causal interpretation. |

All prior `verificada` flags in the frequency database were removed because they had no resolvable supporting source in the repository. Existing `anecdotica` and `especulativa` values remain legacy provenance fields; the UI now labels them as references rather than evidence grades.

## Historical entries relabeled

All 41 frequency descriptions were normalized. Names carrying direct medical or superiority claims were replaced with neutral numeric/historical labels, including the 528 Hz, Gamma 40 Hz, Alpha IQ, neurofeedback, Rife/CAFL and 432 Hz entries. Solfeggio names without direct treatment claims remain for historical recognition.

All 15 protocol descriptions were normalized. Eight entries remain classified as deprecated from new recommendations: `sanacion-cuerpo`, `gamma-neuroproteccion`, `desintoxicacion`, `frecuencia-milagro`, `antiparasitario`, `resonancia-alfa-iq`, `neurofeedback-alfa`, and `sincronizacion-grupal`. Their IDs and acoustic definitions are unchanged.

## Presets and pages

The home and generator quick presets retain the same frequencies and waveforms. Labels such as “Milagro”, “Dolor”, “Corona” and “Inmune” were replaced with neutral Solfeggio or historical Rife labels. Application metadata and home headings now describe personal harmonic or sound exploration.

The protocol page is titled “Protocolos históricos”, explains that the sequences are outside Core V1 recommendations, and shows an exploratory or deprecated badge per entry. The library shows claim classification, identifies source labels as inherited provenance rather than validation, and no longer presents any item as verified. Playback controls and values are untouched.

## Core V1 protection

Guided-session rules, proposal generation and “Why this session?” rationale were not edited. Their provenance remains protocol design, exact mathematics, acoustic organization and optional descriptive personal N=1 evidence. Tests verify that a calm recommendation still resolves to `voice-relaxation-gentle` / `guided-calm` and contains none of the audited legacy medical vocabulary.

## Residual risk

The separate command-card/OBE material contains statements about out-of-body experiences, energy, the autonomic nervous system and related mechanisms. Phase 3D did not rewrite that independent journal content because doing so would broaden the approved historical frequency/protocol scope. `SessionLogForm.tsx` also retains “sanación” only as a free-form tag example. These should receive a focused copy audit before a V1 public release.

Search tags retain legacy terms such as `adn`, `dolor`, `antiviral` and `parasitos` so historical entries remain discoverable. They are metadata, and the displayed descriptions explicitly classify the claims as historical or unsupported. This preserves provenance without endorsement.

No medical triage or decision system was added. Personal observations remain local, descriptive and separate from universal claims.

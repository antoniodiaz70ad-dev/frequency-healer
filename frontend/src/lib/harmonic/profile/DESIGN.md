# HIP/HCI v1 — formula recorded before implementation

HIP is derived structural metadata, never an effect or safety rating. HCI is a coarse descriptor, not an identity/signature, evidence score or recommendation weight. No outcomes enter its calculation.

## Inputs and exactness

Legacy configurations use the existing buildSchedule output (including progression, repeated root events and 13/12 cascades). Constellations use the existing validator/compiler and their exact stored derived frequencies, relations, order and multiplicity. No new playback support is implied by describing a builder-only constellation. No rounding, frequency inference, clamp, octave folding or new frequency generator.

Relationship identity for diversity uses exact canonical ratios from the existing rational helper, explicit octave powers of two, and the existing cascade exponent labels. Root and ratio 1:1 and octave 0 have the same relationship identity. Explicit ratios that equal powers of two share the octave relationship identity; HIP still retains their original declared member type and operands. Cascade exponent zero is root; other exponents remain the explicit schedule expressions rather than inventing a ratio from a floating frequency. Unique frequency uses exact JS numeric equality. Member IDs and display names are excluded from HIP/HCI.

HIP records seed, source type/version, ordered member descriptors, count, unique frequency count, unique (relationship, exact frequency) count, unique relationship count, declared ratio count/diversity/families, declared octave count/offsets, exact-frequency multiplicities, repeated-frequency occurrence count, spectral bounds/span, mode and whether order is meaningful. In sequence, duplicateVoiceCount means repeated occurrences, not concurrent voices. No explicit octave metadata in a legacy schedule is inferred. octaveSpan means log2(maxFrequency/minFrequency), a measured spectral width in octave units; explicitOctaveOffsetSpan is separately null when no octave member was declared.

## Formula: harmonic-complexity-v1

For N >= 1 member occurrences and U >= 1 unique relationship identities:

- M = 1 - 1/N. Bounded member-count term [0,1); strictly increasing in N. Counts repetitions without a second multiplicity weight. No arbitrary maximum is imposed on sequence data.
- R = 1 - 1/U. Bounded relationship-diversity term [0,1); increasing in U. Includes roots, ratios and explicit octaves through exact canonical relationship identities.
- S = log2(maxFrequency/minFrequency) / log2(2000/40). Spectral width normalized to the existing supported 40–2000 Hz range, [0,1]. This ratio is a descriptor only. It does not recompute any played frequency. Octave span and spectral span describe the same axis, so there is no second octave weight.
- T = number of adjacent member changes / (N-1) for sequence N>1, otherwise 0. A change is a different exact relationship identity or exact frequency. [0,1]. Simultaneous display ordering has no temporal meaning and contributes zero.

HCI = 25 × (M + R + S + T), range [0,100]. Equivalently 100 times their equal-weight arithmetic mean. Each axis contributes up to 25 points; there is no empirically fitted, mystical or outcome-derived coefficient. Equal weights are an explicit initial convention, not a validated perception model.

A single tone scores 0. Adding members increases M but can reduce T (e.g. repetitions); HCI is intentionally NOT globally monotonic under every edit. Sequence permutations affect HCI only when the number of adjacent changes changes; all-distinct permutations can share HCI while retaining different exact order/signatures. Simultaneous permutations and names/IDs never change HCI. Scaling all frequencies proportionally retains HCI if still valid. Equivalent mathematical relationship operands can have last-bit frequency differences under the existing compiler: those original values remain visible and are not repaired.

Bands have equal numeric width, not outcome-calibrated thresholds: lower [0,100/3), moderate [100/3,200/3), higher [200/3,100]. Show version and value, no stronger/better/healing labels. Formula or band changes require a new algorithm identifier.

## Descriptive N=1 analysis

Reuse Phase 2D validated evidence snapshots and its exact completed-plan/intent/candidate-set/primary-metric/context eligibility. Do not touch its score or ordering. Structural grouping occurs only inside that eligible population, with additional exact strata for seed, duration, volume, mode and waveform. Preserve every candidate/configuration, experiment ID, expectation and baseline. Never pool seeds to claim an HCI effect.

Grouping choices: HCI band, member count, unique frequency count, ratio diversity, octave span, spectral span, playback mode. Keep the other HIP dimensions available in each candidate's profile. Use NONE <5 / PRELIMINARY 5–9 / DESCRIPTIVE >=10; show 'Insufficient comparable sessions.' rather than an association for N<10. Within a matched stratum, an expectation-mean gap >=2/10 across candidates with paired data suppresses association wording and flags confounding. Missing context cannot establish real comparability; baseline and other uncontrolled variables remain possible confounders. Display per-group changes, never a causal contrast or winner.

## Storage/versioning

Derive on demand from immutable validated snapshots; no new localStorage namespace, schema migration or redundant HIP/HCI fields in saved experiments, plans, constellations or recommendations. Exports of the derived structural report carry harmonic-information-v1 and harmonic-complexity-v1 plus complete source evidence. Recompute visibly under these identifiers; never relabel old records or change stored bytes.

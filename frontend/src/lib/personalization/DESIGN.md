# Personalization v1 — pre-implementation scoring contract

Algorithm: personalization-v1. Only ordering of validated candidates is permitted.

For each complete primary-metric pair, favorableChange = direction × (post − pre).
Direction is +1 for clarity/focus/energy/mood, −1 for tension. It never depends on observed outcomes.

outcomeSignal = max(0, median(favorableChange)). Median resists a single extreme observation; clipping makes this a positive-association prioritizer, not a hidden model of harm. Negative/zero outcomes remain visible and receive no positive priority.

evidenceWeight = 0 when N<5; otherwise min(N,10)/10. Five and ten reuse requested evidence boundaries. The denominator caps the weight at the descriptive threshold instead of rewarding unlimited exposure. It is a product weight, not statistical confidence.

consistencyWeight = count(favorableChange > 0)/N, or 0 when N=0. Every paired observation has equal weight; zero is not improvement. A less consistently positive response receives less priority. No extra spread penalty or arbitrary fitted coefficient.

personalizationScore = outcomeSignal × evidenceWeight × consistencyWeight.

States: NONE N<5; PRELIMINARY N=5–9; DESCRIPTIVE N>=10. Only when every candidate is DESCRIPTIVE may scores reorder the list. PRELIMINARY displays signal but retains original order, protecting exploration. Stable ties retain original order. No candidate is removed, no candidate/rule/schedule is mutated, and no Discovery assignment is changed.

Expectation is never part of the score. Show its mean/range beside outcomes. If the maximum minus minimum candidate expectation mean is >=2 points on the 0–10 scale, retain original order and flag confounding. Two points (20% of the scale) is an explicit conservative display/ordering guard, not a validated clinical cutoff or causal adjustment. Negative scores are not used; if no positive score exists, show default-order language.

Evidence only comes from completed Discovery plans with exactly equal full reviewed intent, primary metric, comparability policy and entire ordered candidate definitions. Within that set, use the existing exact recorded context stratum, completed sessions and complete pre/post primary-metric pairs only. No inference from missing context, no pooling of V1/V2 history, active plans or self-selected personalized sessions. Duplicate experiment IDs across source plans reject the evidence set. Repeated identical completed plans may produce N>10 without broadening comparability.

PersonalizedRecommendationSetV1 retains complete validated source-plan snapshots, context, algorithm version, rule/candidate identities, metric/direction, score terms, observations and provenance (plan IDs, assignment indices, experiment IDs). This is deliberately audit-heavy; quota failure must preserve data and offer export. Saved personalized executions use a new versioned envelope around unchanged ExperimentRecordV2 in fh:personalized-experiments-v1. They never write Discovery plans or legacy records and do not become new ranking evidence.

Confirmation rebuilds evidence and rejects changed recommendations. Selected top and non-top candidates follow the same explicit preview/confirmation and existing Lab engine lifecycle. No hidden AI reasoning, new seeds, automatic playback, adaptation or exploration scheduling.

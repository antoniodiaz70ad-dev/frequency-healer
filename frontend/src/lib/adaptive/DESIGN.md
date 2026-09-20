# Adaptive exploration v1 — policy recorded before code

Advisory only; validated candidates, exact intent/candidate set/context and current safety/playback rules remain prerequisites. No acoustic generation, HCI effectiveness weighting, automatic playback, plan mutation or new plan creation. No changes to personalization-v1.

## Two authorities and provenance

Best current match remains exactly Phase 2D: expose currentBestCandidateId only if its existing orderingApplied flag establishes a descriptive ranking; otherwise show that no best-current signal is established. Do not invent a winner from a preliminary mean.

Most informative next uses the same eligible completed Discovery population plus explicitly saved Phase 2F executions under the exact same reviewed intention, candidate definitions/order, target metric, comparability policy and recorded context. The latter are self-selected follow-ups, labeled separately; they do not feed Phase 2D or alter fixed Discovery assignments. A user's acceptance/override flag never enters counts, summaries or policy. Missing primary pairs and cancelled/interrupted sessions do not increase comparable N. Completion/cancellation/interruption/missing-pair counts remain visible. Repeated experiment IDs reject the evidence rather than inflate N.

Every suggestion retains a validated immutable Phase 2D basis and detached full V2 snapshots of eligible adaptive follow-ups (without recursively embedding old suggestions). Validate each follow-up against its exact candidate/configuration/constellation, intention, required expectation and exact serialized context. Historical source rename/deletion does not affect snapshots. Follow-up matching is performed against its stored basis before projection. These projections are provenance, not new historical Discovery plans.

## Deterministic decision hierarchy: adaptive-exploration-v1

Input ordering is the original validated candidate order. Break all unspecified ties by that index.

1. All comparable N=0: first candidate, no-personal-evidence.
2. Any N<5: smallest N, insufficient-sample. Early higher outcomes do not declare superiority.
3. Maximum N minus minimum N >=5: smallest N, candidate-imbalance.
4. Candidate expectation means differ >=2/10: smallest N, uncertainty-reduction; show confounding, no causal correction.
5. Phase 2D current best has positive favorable median and high variability: choose it, confirm-current-signal.
6. Other positive-median candidates with high variability: largest raw change range, then largest absolute mean/median gap, then lowest N, then original index; uncertainty-reduction.
7. Otherwise if Phase 2D has a current best: confirm-current-signal for that candidate.
8. Otherwise smallest N, uncertainty-reduction; original ranking remains unaltered.

High variability means raw change range >=4 points OR absolute change mean minus median >=1 point. Changes use the same optional 0–10 scale; favorable direction is fixed (+clarity/focus/energy/mood, −tension). These explicit integer-scale thresholds are conservative product heuristics, not statistical confidence limits or probabilities. The floor of five reuses Phase 2D; an imbalance of five equals one floor-sized block. Four-point spread and one-point mean/median gap expose visibly heterogeneous outcomes without fitting user data. Expectation caution reuses the documented Phase 2D two-point guard. No opaque numerical exploration score or outcome-fitted coefficients.

After repeated confirmations, the five-observation imbalance guard routes attention to less-sampled alternatives. Identical evidence always yields identical suggestions. Users can always choose another valid candidate. No penalty or reweighting for overriding; new valid results count by the same eligibility rules regardless of choice.

## Fixed plans

Show next assigned candidate for active fixed plans. No automatic adaptation inside them. If any active fixed plan exists in the loaded history, require explicit acknowledgement that the optional exploration session is outside those plans before selecting an adaptive option. During confirmation, reload Discovery and adaptive history; reject stale source bytes or rebuilt suggestions, including a newly active fixed plan, and require regeneration/review. Never reserve, skip, rewrite or activate any Discovery assignment. Follow-up plan generation is optional in the brief and is intentionally omitted.

## Persistence and human confirmation

New namespace fh:adaptive-experiments-v1 is necessary only for explicit saved execution audits: suggestion snapshot + chosenCandidateId + suggestionFollowed + unchanged ExperimentRecordV2. No suggestion cache and no writes on generate/choose/preview/start/navigation. Exact selected configuration is confirmed through existing Lab callbacks. Preserve natural completion, stop and interrupted lifecycle; unsaved navigation drafts are lost, never fabricated as completed.

The envelope is version 1 with a reconstruction validator. Saved suggestion contains algorithm version, reasons/thresholds, candidate identities, statistics, outcome provenance, HIP/HCI versions, coverage, and source snapshots. Explicit export remains independently auditable. New storage follows existing lock/CAS/corruption-safe conventions, append/create only; no migration, overwrite or edits to old keys. Full snapshots can exhaust browser quota; fail without repair and offer export.

## Coverage

Describe observed completed paired sessions across existing candidate IDs, seeds, exact relationship sets, explicit octave structures, modes and HCI bands. Coverage is not outcome aggregation or a request to test every possible acoustic configuration. Empty metadata remains empty, no guessed octaves. HIP/HCI comes from Phase 2E and is never read by the selection policy.

## Scope end

No new acoustic or recommendation rules, medical optimization, stochastic policy, Bayesian model, autonomous closed loop, active-plan adaptation or automatic follow-up creation. End after Phase 2F; next step is Product Freeze / Closeout v1.

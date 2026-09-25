# Harmonic Lab browser regression (Phase 1F)

Run from `frontend/` with Node >=20 and Google Chrome installed:

```sh
npm ci
NEXT_PUBLIC_VOICE_JOURNEY_ENABLED=true NEXT_PUBLIC_HARMONIC_LAB_ENABLED=true VOICE_AI_ENABLED=false npm run build
npm test
npm run test:ui
```

`test:ui` uses Node's existing test runner and pinned `playwright-core`. It starts and stops its own Next production server on an ephemeral loopback port. It launches a separate headless Chrome process, muted, with an isolated browser context for every test. It never connects to deployed origins, existing browser profiles or user records. No credentials are required. Build with flags ON first; an OFF build intentionally fails setup rather than silently skipping tests.

If Chrome is not installed, supply a compatible Chromium executable using `FH_UI_BROWSER_PATH=/absolute/path/to/chromium npm run test:ui`. No browser downloads or system installs happen automatically. This suite is currently validated on Chrome/macOS; it is not a Firefox/WebKit/device compatibility guarantee.

## Observation and assertions

Selectors use accessible labels/roles and existing rendered UI, without product test IDs or hooks. A test-only init script wraps native AudioContext and Storage calls, delegating every call to the actual browser. It records the exact frequency arguments, waveform, scheduled start/stop times, oscillator ended/disconnect events, context state, storage writes and rendered experiment statuses. It does not fake Web Audio, change its clock, or persist probe data.

The five interval tests verify selection versus Apply versus confirmation and real stop cleanup. Other tests cover unsupported 5:3/2:1, octave preview/Apply in both modes, boundaries and derived-frequency rejection, stale selections, both composition orders, exact immutable experimental snapshot, explicit save/reload, navigation cleanup without completed/autosave, and ascending/descending/return cascades. Root retains two V1 voices.

The manual UI has no waveform/progression editor. Tests verify the emitted sine waveform and the unchanged absence of progression in the complete saved V1 snapshot. Preservation of explicit progression values remains covered by existing pure Phase 1D/1E tests; no artificial control or React-state injection is added.

Navigation uses the existing client-side dashboard link, so the same browser document retains the audio observer and can prove cleanup after unmount. An unsaved experiment is lost on leaving the route, as in the existing contract; the test verifies no false completed status is rendered and no record is saved. It does not claim to recover a discarded draft or inspect an unmounted React object. Abrupt process termination and native device output are outside this suite.

Cleanup waits for native ended/disconnect/closed states rather than fixed sleeps. Bounded polling allows asynchronous React and audio work to settle; whole failing test cases are not retried. Test contexts and server are closed by teardown even when assertions fail. TAP output goes to stdout; use `npm run test:ui > /tmp/fh-ui.log 2>&1` to retain it.

For OFF builds use the existing HTTP and landing smoke scripts, not this enabled-feature UI suite. The UI runner is deliberately separate from the fast `npm test` command and from production build/deploy commands.

## CI (Phase 1G)

`.github/workflows/regression.yml` runs on every pull request update and on pushes to `main`, with no path filters. Development pushes to an open PR are covered by the PR event instead of a second duplicate push run. Manual dispatch is also available after the workflow reaches the default branch. Older runs of the same PR/ref are cancelled.

Jobs: `Quality` runs existing tests, typecheck and lint once. `Flags ON` and `Flags OFF` independently build and run existing HTTP/landing smokes. ON also runs the full UI suite. Permissions are read-only; checkout credentials are not persisted. No secrets, deploys or branch-protection changes are involved.

Node is fixed at 22.14.0, matching the validated baseline; `npm ci` uses the existing lockfile without dependency updates. CI explicitly installs the Chromium revision associated with pinned playwright-core, including Linux dependencies:

```sh
node node_modules/playwright-core/cli.js install --with-deps chromium
FH_UI_BROWSER=chromium FH_UI_ARTIFACTS_DIR=artifacts/ui npm run test:ui
```

For the same smoke orchestration locally, after building with the matching flags:

```sh
node scripts/ci-smoke.mjs enabled
# Rebuild OFF before running:
node scripts/ci-smoke.mjs disabled
```

This wrapper only starts/stops the local server and invokes the two existing smoke scripts. It does not duplicate their assertions. The OS allocates a free loopback port for each runner, which is passed explicitly to consumers; no fixed shared CI port is assumed. A port collision/startup failure fails the run rather than silently switching to another server.

Timeouts: readiness 20 seconds (2 seconds per HTTP attempt); browser launch 20 seconds; UI setup 60 seconds, each case 45 seconds, teardown 15 seconds; locator 8 seconds and navigation 10 seconds. Each smoke child has a hard 60-second timeout. The server is terminated in finally/teardown and on SIGINT/SIGTERM, with SIGKILL fallback after 5 seconds. Workflow jobs cap at 10 minutes (Quality) and 15 minutes (matrix), with additional build/smoke/UI step limits. A runner-level forced kill cannot execute application finally blocks; GitHub disposes the isolated runner.

On failure, Actions retains only `frontend/artifacts/` for 7 days: command output, server logs and best-effort viewport screenshots/error logs for failing UI cases. An early setup failure may have no screenshot. The contexts contain only synthetic test data. No storage dumps, browser profiles, network traces, environment dumps or audio recordings are uploaded. Local diagnostics are gitignored. Successful runs keep normal Actions logs without artifact uploads.

Recommended required checks once validated: `Quality`, `Flags ON`, `Flags OFF`. Keep all three so an OFF regression cannot be hidden by successful ON tests. This recommendation does not change repository protection settings.

## Saved experiment reader (Phase 1H)

Nine additional UI cases exercise all five saved lifecycle states, missing fields versus explicit zero, every snapshot field including progression, exact supported summary, unsupported cascade summary, unchanged export and corrupt JSON/schema rejection. Synthetic records use the existing storage loader in an isolated context. View/return/export must preserve the original payload byte-for-byte with zero storage writes and no AudioContext. The UI suite now contains 27 cases; the 18 playback/experiment-flow cases remain unchanged.

## Constellation Builder (Phase 1I)

Four additional UI cases cover independent construction, member multiplicity/removal/reordering, name-independent signatures, unsupported playback relationships, invalid frequency rejection, explicit append/save/reload, read-only saved records, unchanged JSON export and corrupt storage preservation. All construction actions assert zero audio contexts and no experiment writes. The suite contains 31 cases; the previous 27 remain unchanged.

Seven pure test cases also cover compiler validation, simultaneous ordering, exact adapter-based structural compatibility, duplicate IDs, corrupted signatures, concurrent serialized creation, storage races and quota failure. Only explicit Builder saving writes the new `fh:harmonic-constellations-v1` namespace; Web Locks are required for safe cross-tab creation. No existing record format or key changes. Compatibility is a structural audit in the current V1 context, not an Apply/play action. Typed octave members, 5:3 and 2:1 remain Builder-only relationships.

## Saved constellation playback (Phase 1J)

Eight additional browser cases cover explicit preparation versus confirmation, exact sequential/simultaneous frequencies with repeated roots, native graph cleanup, immutable saved constellation bytes, optional V1 experiment snapshots, rejection of 5:3/2:1/octave members, stale context/storage rejection, navigation interruption and natural completion without autosave. Total: 39 UI cases. Four pure cases cover exact adapter output, all catalog ratios, nine voices, normalization, snapshots and invalid configurations. Total: 85 unit/integration cases.

The new adapter targets only the existing V1 progression contract: 1–9 root/exact catalog ratio members. It preserves seed, ordered members and mode; explicit progression avoids the default extra root. Unsupported types/operands are rejected as a whole. Duration/volume use the visible manual controls; increments=1 and ascending are inert required V1 fields for non-cascade progressions. No engine, math, saved schema, namespace or dependency changes. The optional existing experiment snapshot records exact played V1 configuration including progression, not constellation IDs/name/signature; the original constellation remains independently saved and unchanged.

## Guided recommendation (Phase 2A)

Seventeen additional browser cases cover eight natural-language intentions, review/correction, rule provenance, advanced details without audio, N=0/4/5/9/10 evidence thresholds, unchanged ranking, JSON export, corruption as unavailable evidence, explicit confirmation with the shared Lab engine/experiment snapshot and creative-cascade consent/navigation cleanup. Total: 56 UI cases. Eighteen new pure cases bring unit/integration coverage to 103.

The guide maps aliases onto existing Voice Journey goals and calls the unchanged voice-rules-v1 builder. No new executable frequency table, AI service, engine, persisted schema or namespace. Recommendations exist in memory and may be exported. Experiments continue to store the exact final acoustic configuration, not recommendation provenance. Evidence reads validated completed voice records only, with exact goal/states/intensity/rule/configuration, full actual duration, no commands and complete paired scales. It calls existing n1Summary on this narrower population, without changing recommendation selection. Invalid history is unavailable, not N=0.


## Constellation-linked experiment audit (Phase 2A contract)

Seven additional pure tests and three browser cases bring coverage to 110 unit/integration and 59 UI cases. Saved-constellation recording now explicitly creates ExperimentRecordV2 with a detached, frozen constellation identity/definition and a separate exact engine configuration. Existing manual/guided recording remains V1. The Phase 1J tests now assert V2 snapshots for linked playback; all existing acoustic assertions remain.

V1 remains in `fh:experiment-sessions-v1` with unchanged validators and payloads. V2 uses `fh:experiment-sessions-v2`: the strict V1 loader rejects other versions, so sharing its key would corrupt the legacy reader contract. The UI combines validated histories but exports each version separately (the original history/original-storage buttons export V1; the V2 buttons export V2). Neither viewing nor playback autosaves. V2 writes require Web Locks, reject conflicting IDs/corrupt payloads and recheck storage after asynchronous validation. No migration or source lookup is needed to validate/export an existing V2 experiment.

Coverage includes immutable identity, exact signature/configuration, zeros versus absent fields, lifecycle states, source rename/deletion, corruption, concurrent writes, export/reload and source changes during asynchronous confirmation. The reader reports source availability independently from snapshot validity. Confirmation conservatively rejects any constellation-storage payload change during validation, including unrelated additions; a new preview is required. Source identity/signature/plan are revalidated immediately before playback. The mathematical signature is not a tamper-proof signature over subjective or identity fields.

Local macOS validation encountered a stalled native audio clock even in a standalone AudioContext test. Running the unchanged harness through an external FH_UI_BROWSER_PATH wrapper adding Chromium's `--disable-audio-output` restored native clock/ended/cleanup behavior. This replaces only the OS output sink, not AudioContext or assertions; no wrapper or test flag was added to the repository. CI continues to run the normal pinned Chromium harness. Physical speaker output was not verified by this fallback. Chromium documents this test switch at https://chromium.googlesource.com/chromium/src/+/f29eb01290cd36a30177ecf8197f906c01088a0d.

## Guided advisor + protocol rationale (Phase 2B)

`HarmonicRecommendationRuleV1` identifies the existing `voice-rules-v1` rule, goal, intensity and legacy candidate type. `ProtocolRationaleV1` derives explanations from the existing validated proposal/schedule, never from a new frequency table. It includes seed, every audible relationship (including duplicates and cascade returns), mode, duration and volume, with explicit evidence basis and limitations. No octave or saved-constellation identity is invented. Guided confirmation rebuilds and checks both proposal and rule/rationale before playback. The full rationale is included in the existing recommendation JSON export; it adds no persistence key or record-schema field.

The same rationale is rendered in Harmonic Lab and Voice Journey under “¿Por qué esta sesión?”. Voice Journey keeps the existing interpreter and acoustic proposals; its technical controls/plan are expandable, and it reuses the guide's medical-language boundary and strict descriptive personal-evidence function. The guide's current alias adapter remains unchanged. One candidate is returned; no invented balanced variant, ranking, learning or protocol mutation.

Conceptual taxonomy maps onto existing categories, not new acoustic rules:

| Concept | Existing goal / states |
| --- | --- |
| Calm / emotional regulation | relaxation / calm |
| Focus / dispersion | focus / focus |
| Sleep preparation | sleep_preparation / restful |
| Recovery / subjective energy | relaxation / calm + grounded |
| Grounding | relaxation / grounded |
| Creativity | creative_exploration / creative |
| Meditation / integration | reflection / calm + openness |
| Exploration / unknown | custom / review required |
| Clarity | clarity / calm + focus |

Classification confidence concerns text interpretation only. The UI requires review/correction; vocabulary coverage is heuristic, not a general semantic model. Evidence labels distinguish mathematical, acoustic, protocol-design, exploratory and personal N=1 claims; traditional is reserved in the type but no unattributed historical claim is emitted. N<5 is insufficient; N=5–9 preliminary; N>=10 descriptive. All levels remain non-causal and do not change ordering. Only exact comparable validated completed voice records count; V1/V2 experiments are not silently pooled.

The guide returns legacy configs, so optional guided experiment recording stays V1. Saved-constellation playback independently retains the Phase 2A V2 ID/signature/definition/acoustic snapshot path, covered by regression. No constellation-based recommendation or new provenance storage is introduced; recommendation provenance is in its export, not added to old experiment schemas.

Eleven new unit/integration cases bring the suite to 121. Two new browser cases bring the suite to 61. The eight existing intent cases now additionally assert per-component rationale labels, exact frequencies after explicit confirmation and graph cleanup. Voice Journey cases cover shared rationale/evidence, no autoplay, native exact playback and medical text rejection. V2 identity/corruption/race/export regressions remain. Local UI uses the previously documented native Chromium test output sink; CI uses normal pinned Chromium.

## Protocol Discovery Engine (Phase 2C)

Discovery is an expandable section inside Harmonic Lab and uses the same existing HarmonicEngine instance. No engine, rule, Voice Journey, experiment-schema or constellation-schema changes. Two or three candidates are created from explicit user seed choices applied to existing rules, or exact playable saved constellations. Seeds have no popularity ranking or suggested example defaults. Existing validators reject invalid/unsupported members and derived ranges. Candidates retain seed, ordered relationships, octave metadata, member count, mode, duration, volume, rule provenance/rationale and complete constellation snapshots where applicable.

`ProtocolDiscoveryPlanV1` is fixed at creation: reviewed intent, primary metric, 2–3 validated candidates, comparability policy, assignment strategy, stored uint32 random seed, 3–10 assignments per candidate, original assignment sequence and lifecycle. Balanced cycles candidates; randomized-balanced uses reproducible seeded Fisher–Yates permutations per complete block. Activating never redraws the sequence. Skips are explicit terminal slots, not replacements. A completed plan means its calendar is resolved, not that all observations were completed or sufficient.

The only new namespace is `fh:protocol-discovery-plans-v1`. Its array stores whole validated plans and `DiscoveryExperimentV1` envelopes containing plan/candidate/assignment links, optional structured context and an unchanged ExperimentRecordV2. V2 preserves exact acoustic config and linked constellation identity/definition. Keeping results in the same plan document makes assignment resolution and explicit experiment saving atomic under Web Locks. V1/V2 historical keys and payloads are not accessed or migrated. Store actions reject stale expected plans, conflicting IDs, corruption and changed raw payloads after asynchronous validation. No import, deletion or replacement UI.

Before audio a reservation is persisted, not an experiment outcome. Actual start/complete/stop use existing engine callbacks and V2 lifecycle transitions. Post-state/reflection save is explicit. Navigation or crash loses the unsaved in-memory draft and leaves a visible unresolved reservation; explicit recovery records interrupted without fabricating a result. Do not close a reservation if it is still running in another tab. Existing native stop/navigation cleanup remains. A source constellation changed/deleted after plan creation does not invalidate its independent snapshot. Preview/confirmation revalidates the stored fixed plan and rejects stale changes.

Comparisons require fixed duration, volume and mode. Primary metric uses optional existing 0–10 scales, expectation is required before confirmation (zero accepted), and optional tags/device/time-of-day remain absent when omitted. Context strata match recorded values exactly (tag order ignored); mixed contexts disable pooled comparison. Missing context does not prove equivalent conditions. Baseline and expectation are observed rather than controlled. Different candidate structures can vary several variables: metadata is preserved, not treated as isolated causal effects.

Analysis is separate from existing N=1 code: completed counts; complete paired delta mean/median/min/max; baseline mean; recorded expectation mean; completion fraction of resolved attempted slots (skips/open reservations excluded); and descriptive Pearson expectation/delta association only with at least ten paired observations and nonzero variance. Cancelled/interrupted observations never enter outcome means. Missing is never zero. Comparative evidence uses the minimum paired N across candidates in the selected stratum: <3 insufficient, 3–4 exploratory, 5–9 preliminary, >=10 descriptive. These are display thresholds, not proof. There is no ranking, winner, automatic recommendation or adaptation. Structural metadata and per-candidate counts remain inspectable; no pooled variable-effect model or HIP/HCI. Blinding and follow-up are omitted.

Thirteen new unit/integration cases bring total coverage to 134; four browser flows bring UI coverage to 65. UI fixtures create saved constellations through the real Builder, requiring no test compilation in the separate CI matrix job. Tests cover creation/activation/assignment/confirmation/cancel/save/reload, natural completion, source rename/deletion, interruption recovery, corruption, balanced randomness, identity, contexts, thresholds, expectation association, missing data and storage races. The full prior suite remains; local native-output workaround and normal CI Chromium behavior are as documented above.

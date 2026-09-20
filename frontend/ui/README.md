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

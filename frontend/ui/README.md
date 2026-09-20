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

Jobs: `Quality` runs existing tests, typecheck and lint once. `Flags ON` and `Flags OFF` independently build and run existing HTTP/landing smokes. ON also runs all 18 UI cases. Permissions are read-only; checkout credentials are not persisted. No secrets, deploys or branch-protection changes are involved.

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

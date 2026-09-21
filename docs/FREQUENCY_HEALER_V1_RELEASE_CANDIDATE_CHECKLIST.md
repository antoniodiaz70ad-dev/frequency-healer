# Frequency Healer — V1 Release Candidate Checklist

RC status: **READY FOR OWNER APPROVAL**
Closeout date: 2026-09-21
Branch: `codex/voice-journey-grant`
Tested commit SHA: `43ba25b2690b3f35600ae34ea0a3acfe52f2171b`
Rollback/reference commit: `e8b323a0f37d80f2ee1bb6702e57a214812df864` (`docs: add v1 release candidate checklist`)
Preview to test: https://frequency-healer-git-codex-voice-journey-grant-leviathan1.vercel.app

This document defines the closed-beta release candidate state for V1. It does not introduce new product functionality. During closed beta, changes should be limited to release blockers, safety defects, broken routes, data/export defects, severe mobile audio defects, or critical copy clarity.

## 1. Canonical preview and stale deployments

Use the branch alias preview for all V1 RC testing:

- `https://frequency-healer-git-codex-voice-journey-grant-leviathan1.vercel.app`

Do not use old deployment-specific URLs as acceptance evidence. Known stale deployments may still render older UI labels such as `Viaje por voz` because they point at historical immutable bundles. Example observed stale URL:

- `https://frequency-healer-2v03pzbai-leviathan1.vercel.app/voz`

For `/voz`, open `Información técnica` and confirm:

- `Build` matches the current RC commit short SHA.
- `Rules` is `voice-rules-v2`.

Do not delete localStorage to diagnose stale UI. If old `voice-rules-v1` records appear in history, treat them as legacy records unless a newly generated proposal also uses v1.

## 2. V1 release candidate scope

The RC includes these user-facing surfaces:

- Landing
- Home
- Sesión guiada (`/voz`)
- Laboratorio Armónico
- Atlas de frecuencias
- Protocolos históricos
- Generador manual
- History / saved sessions where currently exposed
- Exploración OBE
- Diario OBE
- Unified data export

The RC excludes new functionality:

- new recommendation engines;
- new claims or protocol meanings;
- new playback engines;
- new storage schemas;
- import/cloud sync/backup;
- production deployment changes;
- analytics expansion;
- history filters;
- arbitrary medical or metaphysical interpretation.

## 3. Manual device validation matrix

Test on real devices before production promotion.

### iPhone Safari

- Load the branch alias preview.
- Open `/voz` and confirm `Sesión guiada` appears.
- Open `Información técnica` and record Build/Rules.
- Generate a session from text: `quiero evitar drenaje energético`.
- Confirm the reviewed goal is relaxation/calm-grounded wording, with no diagnostic claim.
- Start audio only after explicit confirmation.
- Stop audio and confirm it goes silent without a click/pop.
- Navigate away during playback and confirm audio stops.
- Open Atlas and play/stop at least one frequency.
- Open Laboratorio Armónico and start/stop a simple session.
- Export data without deleting local storage.

### iPhone Chrome

Repeat the iPhone Safari checks, focusing on audio unlock, stop behavior, and `/voz` Build/Rules.

### Samsung Chrome

Repeat the same checks, including the Atlas play/stop regression that previously produced the click/pop.

### Desktop browser

- Verify Landing, Home, `/voz`, `/laboratorio-armonico`, `/biblioteca`, `/protocolos`, `/generador`, `/sesion-nueva`, and `/diario` load from the branch alias preview.
- Verify no visible active UI uses `Viaje por voz` as the primary label.
- Verify the Lab remains advanced and separate from the simple guided journey.

## 4. Guided Session RC acceptance

A newly generated session must:

- use `voice-rules-v2`;
- include Seed Selection V1 provenance;
- preserve the original user phrase as the intention;
- use the shared canonical intent interpreter;
- map recovery/energy-drain phrases to `relaxation` with `calm` and `grounded` desired states;
- present text as fully usable and microphone as optional;
- require confirmation before playback;
- not treat voice, text, or intent as diagnosis.

Regression phrases:

- `quiero evitar drenaje energético`
- `me siento agotado`
- `quiero recuperar mi energía`
- `me siento sin energía`

Expected reviewed semantic target:

- goal: `relaxation`
- desired states: `calm`, `grounded`

## 5. Audio RC acceptance

- Playback starts only from a user gesture.
- Stop fades or disconnects cleanly without a loud click.
- Navigating away or hiding the page does not leave audible oscillators.
- Cancelled or interrupted sessions are not marked completed.
- Harmonic Lab and Atlas audio behavior remain separate where implemented.
- No new audio engine is introduced during RC.

## 6. Data/export RC acceptance

- Unified export uses the explicit Frequency Healer-owned storage allowlist.
- Export includes Seed Selection V1 provenance for `voice-rules-v2` records.
- Export preserves legacy `voice-rules-v1` records without migration.
- Invalid/corrupt owned namespaces are preserved as raw bytes and marked invalid by the verifier.
- Viewing history or details does not mutate records.
- No import, cloud sync, or backup is added in V1 RC.

## 7. Safety and claims RC acceptance

Active UI must not claim:

- cures;
- healing guarantees;
- DNA repair;
- physiological activation;
- medical efficacy;
- guaranteed neurological states;
- literal OBE mechanisms;
- verified telepathy;
- energetic mechanisms as fact.

Historical or legacy references may remain only when explicitly framed as historical, unsupported, exploratory, deprecated, or not established.

## 8. Closed beta plan

Recommended beta size: 3–5 users.

Ask each tester to complete:

1. one text-only guided session;
2. one manual Atlas play/stop;
3. one Harmonic Lab play/stop;
4. one data export;
5. one navigation-away interruption during playback.

Collect only these observations:

- device/browser;
- preview URL used;
- Build/Rules from `Información técnica`;
- whether audio started;
- whether stop was clean;
- whether any route 404 occurred;
- whether any label was confusing;
- whether export downloaded.

Do not ask beta testers for medical outcomes.

## 9. Release blocker criteria

Block V1 production promotion if any of these occur on the canonical branch alias preview:

- newly generated `/voz` proposal uses `voice-rules-v1`;
- `/voz` active UI shows `Viaje por voz` as the page title;
- iPhone or Samsung cannot start any audio after a user gesture;
- stopping audio produces a severe click/pop;
- route required for V1 returns 404;
- export fails or omits required Seed Selection V1 provenance;
- active UI reintroduces unsupported medical or mechanism claims;
- production/main is changed without explicit approval.

## 10. Production promotion readiness

Production promotion can be considered only after:

- CI is green on the RC commit;
- Vercel preview is green;
- real-device validation is recorded for iPhone and Samsung;
- no release blockers remain open;
- old deployment URLs are not used as acceptance references;
- the owner explicitly approves production promotion.

Until then, continue using the branch alias preview for testing.


## 11. CLOSED BETA RC READY record

Final RC status: **CLOSED BETA RC READY**.

This status authorizes closed-beta testing on the branch alias preview only. It does not authorize merging to `main`, production deployment, product behavior changes or new feature work.

### Tested build

- Branch: `codex/voice-journey-grant`
- Tested commit SHA: `43ba25b2690b3f35600ae34ea0a3acfe52f2171b`
- Commit summary: `fix: add guided session volume controls`
- Rollback/reference commit: `e8b323a0f37d80f2ee1bb6702e57a214812df864`
- Preview URL: `https://frequency-healer-git-codex-voice-journey-grant-leviathan1.vercel.app`
- Vercel deployment check: PASS

### CI status

Workflow run for `43ba25b2690b3f35600ae34ea0a3acfe52f2171b` completed successfully.

- Quality: PASS
- Flags ON: PASS
- Flags OFF: PASS
- Vercel: PASS

### Automated test totals

Latest local verification before this documentation-only closeout:

- Unit/integration: 214/214 PASS
- TypeScript: PASS
- ESLint: PASS

CI additionally ran the configured regression matrix for Quality, Flags ON and Flags OFF successfully.

### Completed physical validations

Closed-beta readiness is based on the following reported physical observations plus automated regression:

- iPhone playback: PASS — audio became audible after the iOS audio unlock fixes.
- iPhone no-output blocker: RESOLVED for basic playback.
- Samsung playback: PASS — user reported audio works.
- Atlas stop click/pop: PASS — user reported it now works without noise.
- Safari/macOS supervised audio: PASS for audible output, no perceived distortion and silence after Stop.
- Guided Session volume discoverability issue: FIXED in `43ba25b` with visible `Bajar volumen` / `Subir volumen` controls during playback.

These physical observations are suitable for closed beta. They are not a final production physical-audio certification.

### Final manual release gates

The owner completed the remaining physical release gates after closed-beta RC preparation:

1. Mobile unified export: **PASS**
2. Stereo headphones / binaural physical listening: **PASS**

Additional validation note to preserve during beta/manual testing:

- Prior macOS/CoreAudio close behavior should be watched during beta/manual physical testing. If audio remains active after Stop, navigation or tab close in any environment, record it as a release blocker candidate.

### Known non-blocking limitations

- Old Vercel deployment-specific URLs may still serve historical bundles. Use only the branch alias preview for closed beta evidence.
- Legacy `voice-rules-v1` records may remain visible in local history. They are valid historical records and should not be migrated or deleted as part of beta testing.
- Closed beta does not include import, cloud sync, backup, analytics expansion or production deployment.
- Mobile export and stereo/binaural listening are PASS as of the final RC1 manual release gate update.

### Closed-beta acceptance criteria

A closed-beta run is accepted when:

- tester used the branch alias preview;
- `/voz` shows `Sesión guiada`, not `Viaje por voz` as the active page title;
- `Información técnica` reports the tested build and `voice-rules-v2`;
- a text-only guided session can be generated, confirmed, started, volume-adjusted and stopped;
- stop leaves no audible stuck oscillator;
- Atlas play/stop has no severe click/pop;
- Harmonic Lab remains accessible and separated from the simple journey;
- no required route returns 404;
- no unsupported medical or mechanism claim appears in active UI;
- no session is saved until the tester explicitly saves it.

### Beta tester checklist

For each tester/device/browser, record:

- tester initials or anonymous tester ID:
- date:
- device:
- OS/browser:
- preview URL:
- Build shown in `/voz` → `Información técnica`:
- Rules shown in `/voz` → `Información técnica`:

Required actions:

1. Open Home.
2. Open `Sesión guiada`.
3. Open `Información técnica` and record Build/Rules.
4. Enter one text intention, preferably `quiero evitar drenaje energético`.
5. Confirm that the reviewed recommendation does not make a diagnosis or medical claim.
6. Continue to confirmation.
7. Start playback.
8. Press `Subir volumen` and confirm the displayed volume increases.
9. Press `Bajar volumen` and confirm the displayed volume decreases.
10. Stop playback and confirm silence.
11. Optionally save or end without saving; record which action was taken.
12. Open `Atlas de frecuencias`, play one item, stop it and listen for clicks/pops.
13. Open `Laboratorio Armónico` and confirm the route loads.
14. Attempt data export if this test run is assigned to the export gate.

### PASS / FAIL / NOT TESTED result template

Use one result row per scenario.

| Scenario | Result | Notes |
| --- | --- | --- |
| Branch alias preview used | PASS / FAIL / NOT TESTED |  |
| `/voz` Build/Rules visible | PASS / FAIL / NOT TESTED |  |
| Text-only guided session | PASS / FAIL / NOT TESTED |  |
| Volume up/down controls | PASS / FAIL / NOT TESTED |  |
| Guided stop leaves silence | PASS / FAIL / NOT TESTED |  |
| Atlas play/stop no click/pop | PASS / FAIL / NOT TESTED |  |
| Harmonic Lab route loads | PASS / FAIL / NOT TESTED |  |
| Mobile unified export | PASS / FAIL / NOT TESTED |  |
| Stereo headphones / binaural | PASS / FAIL / NOT TESTED |  |
| No unsupported claims observed | PASS / FAIL / NOT TESTED |  |
| No false autosave/completion | PASS / FAIL / NOT TESTED |  |

### Severity definitions

- **P0**: Blocks closed beta or production immediately. Examples: app cannot load, playback cannot be stopped, audio remains stuck after stop/navigation, production data is corrupted, unsupported medical claims appear prominently, or new sessions use `voice-rules-v1`.
- **P1**: Blocks production approval but may allow limited closed beta. Examples: mobile export fails, stereo/binaural physical listening is unverified or fails, one major supported mobile browser cannot play audio, or a required route intermittently 404s.
- **P2**: Should be fixed before broad beta or production if practical. Examples: confusing labels, non-critical layout problems, unclear save/export wording, or a recoverable browser-specific issue.
- **P3**: Minor polish or documentation issue. Examples: typo, low-impact copy clarification, or non-blocking visual alignment.

### Remaining production gates

The former physical release gates for mobile unified export and stereo/headphone listening are now PASS as of the final RC1 manual release gate update. Before final production approval, complete and record:

1. Owner review of this RC1 report.
2. Explicit owner approval to merge/promote.
3. CI green on the exact final production-candidate commit if the branch changes after this RC1 closeout.
4. Production smoke after owner-approved promotion.

No merge to `main` and no production deployment are authorized by this RC closeout.

## 12. Final RC1 owner-approval gate

Final status: **READY FOR OWNER APPROVAL**

Manual release gate phase: **COMPLETE**

Branch: `codex/voice-journey-grant`

Final product candidate SHA: `43ba25b2690b3f35600ae34ea0a3acfe52f2171b`

Preview URL: https://frequency-healer-git-codex-voice-journey-grant-leviathan1.vercel.app

CI status: GitHub Actions run 35634546043: PASS — Quality, Flags ON and Flags OFF completed successfully for product candidate 43ba25b.

Vercel result: Vercel preview check: PASS — deployment check completed successfully for product candidate 43ba25b.

Automated regression record:

- Unit/integration suite: PASS — 214/214 tests passing.
- TypeScript: PASS.
- ESLint: PASS.
- CI feature flags ON: PASS.
- CI feature flags OFF: PASS.
- CI HTTP smoke and landing smoke: PASS through the existing workflow gates.

Manual validation gates recorded as PASS:

- iPhone physical validation: PASS
- Samsung / Android Chrome physical validation: PASS
- Guided Session: PASS
- voice-rules-v2: PASS
- Seed Selection V1: PASS
- Audio start/stop: PASS
- Silence after stop: PASS
- Atlas stop fade / no click-pop: PASS
- Harmonic Lab load: PASS
- Responsive mobile behavior: PASS
- Save/persistence: PASS
- Mobile unified export: PASS
- Stereo headphones / binaural physical listening: PASS

Open blocker count:

- P0: 0
- P1: 0

Remaining issues by severity:

| Severity | Count | Notes |
| --- | ---: | --- |
| P0 | 0 | No release-blocking failure recorded. |
| P1 | 0 | No closed-beta blocker recorded. |
| P2 | 0 | No known major non-blocking defect recorded at RC1 closeout. |
| P3 | 2 | Watch for stale preview URLs/browser caches during tester onboarding; continue watching prior macOS/CoreAudio close behavior during beta/manual physical testing. |

Production smoke checklist for owner approval:

- Open production after promotion and confirm the build/rules diagnostic matches the approved release.
- Verify `/`, `/voz`, `/sesion-nueva`, `/laboratorio-armonico`, `/biblioteca`, `/protocolos`, `/generador` and `/diario` load.
- Complete one Guided Session by text, confirm voice-rules-v2 and Seed Selection V1 provenance, start playback, adjust volume and stop.
- Confirm silence after stop on iPhone and Android Chrome.
- Play and stop one Atlas frequency and confirm the stop fade has no click/pop.
- Open Harmonic Lab and confirm no 404 on the promoted domain.
- Save one record locally, reload, and export unified data on mobile.
- Confirm safety/copy freeze language remains neutral and no medical or mechanism guarantees appear.

Rollback plan:

- Do not merge or promote if any P0/P1 appears before owner approval.
- If a production issue appears after promotion, roll back Vercel to the previous known-good production deployment.
- Product reference SHA for this RC1 candidate: `43ba25b2690b3f35600ae34ea0a3acfe52f2171b`.
- Pre-RC rollback/reference commit retained in history: `e8b323a0f37d80f2ee1bb6702e57a214812df864`.

Owner approval remains required before merge to `main` or production promotion.

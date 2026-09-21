# Frequency Healer — V1 Release Candidate Checklist

Freeze date: 2026-09-21
Branch: `codex/voice-journey-grant`
Current RC commit at creation: `2e003c9` (`docs: add v1 release candidate checklist`)
Preview to test: https://frequency-healer-git-codex-voice-journey-grant-leviathan1.vercel.app

This document defines the remaining closeout work for V1. It does not introduce new product functionality. During RC, changes should be limited to release blockers, safety defects, broken routes, data/export defects, severe mobile audio defects, or critical copy clarity.

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

# Frequency Healer V1 — physical audio validation

Phase 3E.1 validation record. This document records observed results and leaves
auditory or unavailable-device checks as `NOT TESTED`; automated browser tests
are not treated as physical-audio evidence.

## Build under validation

- Date: 2026-09-20 (`America/Mexico_City`).
- Product commit: `e104ca272848ce6fc4b666c9cdb18460611a220f`.
- Branch: `codex/voice-journey-grant`.
- Preview: <https://frequency-healer-fc48b1fma-leviathan1.vercel.app/>.
- Flags: Voice Journey ON, Harmonic Lab ON, remote Voice AI OFF.
- Host used for available desktop checks: macOS 26.3, Apple computer; no
  serial number, account name or other device identifier recorded.
- Test data: synthetic Spanish intentions only. One deliberately stopped Voice
  session was explicitly saved in the isolated Chrome validation session.

`PASS` means directly observed in the named environment. `FAIL` means the
acceptance criterion was directly violated. `NOT TESTED` means no qualified
observer/device/output was available. A programmatic oscillator or UI state is
never used to award an auditory PASS.

## Device and browser coverage

| Physical device | Browser | Version / access | Output | Result |
| --- | --- | --- | --- | --- |
| macOS host | Google Chrome | 153.0.8010.50; protected preview accessible | Current macOS default output; category was not exposed to the validation process | Functional guided/lifecycle/data checks PASS; auditory criteria NOT TESTED |
| macOS host | Safari | 26.3; authenticated preview access confirmed | Current output, category not reported by tester | Initial/privacy/text-entry render PASS; audio audible without perceived distortion and silence after Stop PASS by supervised tester report |
| iPhone | Safari | Physical device detected through iPhone Mirroring, but unavailable because Continuity Camera was active | Not exercised | NOT TESTED |
| Android phone | Chrome | No accessible physical Android device detected | Not exercised | NOT TESTED |
| Headphones / earbuds | Applicable browser | No supervised listener/output category available | Not exercised | NOT TESTED |

Browser emulation at 390×844 remains part of automated regression, but is not
listed as physical mobile validation.

## Validation matrix

| Scenario | Chrome/macOS observed result | Other required devices | Status |
| --- | --- | --- | --- |
| A. Guided simple session | Text intention, interpretation, recommendation, rationale, confirmation, start, manual stop, observation and explicit save completed | Full completion still requires Chrome/Safari/iPhone/Android human runs | Partial PASS |
| B. Guided stop | Start was explicit; Stop remained visible and immediately advanced to observation | Safari/macOS tester reported complete silence after Stop; other outputs remain pending | Functional PASS; Safari silence PASS |
| C. Navigation interruption | Navigating Home during playback returned safely; returning to `/voz` showed one prior saved record and no new record | Physical silence needs a listener | Functional/data PASS; auditory NOT TESTED |
| D. Refresh/interruption | A saved session survived reload. Active-refresh auditory teardown was not manually heard | All required devices | Partial PASS |
| E. Sequence playback | Guided sequence entered `Sesión en curso` only after confirmation at UI volume 5/100 | Auditory quality/order | Functional PASS; auditory NOT TESTED |
| F. Simultaneous playback | Covered by native Web Audio browser regression | Real speaker/headphone listening | NOT TESTED physically |
| G. Binaural playback | Existing legacy binaural engine/regression present | Stereo headphones and human listener | NOT TESTED physically |
| H. Minimum supported range | Pure and UI validation covers the exact 40 Hz boundary without clamping | Conservative physical listening | NOT TESTED physically |
| I. Higher supported range | Pure and UI validation covers the exact 2000 Hz boundary without clamping | Conservative physical listening | NOT TESTED physically |
| Saved history | Explicit save created one `Detenida` record; reload retained it | Repeat on mobile browsers | PASS in Chrome/macOS |

The guided test used UI volume 5/100. This establishes that the visible control
accepted a conservative value; it does not establish acoustic SPL or comfort.

## Guided UX acceptance — Chrome on macOS

| Criterion | Result | Observation |
| --- | --- | --- |
| “Sesión guiada” is obvious | PASS | Primary navigation label and page heading were visible. |
| Microphone is optional | PASS | Text states that microphone use is optional; the complete path worked without requesting it. |
| Text-only path works | PASS | Synthetic intention reached a recommendation locally. |
| Current step is obvious | PASS | Steps 1–6 and a single focused heading were exposed. |
| Recommendation is understandable | PASS | Goal, duration, intensity/style and personal-evidence state appeared before technical detail. |
| Rationale is accessible but secondary | PASS | “¿Por qué esta sesión?” expanded without starting audio. |
| Confirmation is explicit | PASS | A separate “Lista para comenzar” screen preceded “Iniciar sesión”. |
| No premature autoplay | PASS | Intention, recommendation, rationale and Continue produced no playback state. |
| Stop is visible | PASS | “Detener sesión” was exposed directly during playback. |
| Post-session flow is obvious | PASS | Manual stop opened “¿Cómo te sentiste?”. |
| Save is explicit | PASS | No record appeared until “Guardar sesión” was used. |
| Completion state is clear | PASS | “Sesión guardada” appeared after the write completed. |

## Mobile acceptance

No physical mobile run was completed. The following therefore remains
`NOT TESTED` on iPhone/Safari and Android/Chrome: keyboard-open usability, safe
areas, stop visibility with browser chrome present, orientation changes, long
recommendation layout, physical audio teardown and save/reload.

Automated Chromium checks at 390×844 pass for horizontal overflow, primary CTA,
progressive rationale, stop visibility, post-state controls, save and reload.
Those results are supporting evidence only.

## Physical audio acceptance

| Audible criterion | Speakers | Headphones / earbuds |
| --- | --- | --- |
| No clipping | NOT TESTED | NOT TESTED |
| No pops/clicks | NOT TESTED | NOT TESTED |
| No sudden gain jumps | NOT TESTED | NOT TESTED |
| No unintended distortion | NOT TESTED | NOT TESTED |
| Balanced stereo | NOT TESTED | NOT TESTED |
| No audible stuck oscillator | NOT TESTED | NOT TESTED |
| Stop perceived as immediate | NOT TESTED | NOT TESTED |
| Silence after teardown | NOT TESTED | NOT TESTED |
| No unintended overlap | NOT TESTED | NOT TESTED |
| Transitions are not harsh | NOT TESTED | NOT TESTED |
| Initial loudness is comfortable | NOT TESTED | NOT TESTED |
| Simultaneous playback avoids obvious clipping | NOT TESTED | NOT TESTED |
| Binaural left/right behavior with stereo isolation | N/A | NOT TESTED |

No acoustic calibration, SPL claim or blanket physical-output PASS is made.

Supervised Safari/macOS observation: the tester reported that audio was audible,
that no distortion was perceived, and that output became completely silent
after Stop. The output category was not reported, so this observation is not
assigned to either the speaker or headphone column above. Comfort, pops/clicks,
stereo balance, simultaneous playback and binaural isolation remain
`NOT TESTED` unless separately reported.

## Lifecycle and interruption observations

- Guided playback entered the playing view only after the explicit start action.
- Manual stop immediately changed the UI to observation.
- Navigating away during a second active session returned to Home. Returning to
  `/voz` showed no automatically saved or falsely completed second record.
- The saved first session was accurately labelled `Detenida`, not `Completa`.
- Safari/macOS Stop was reported to leave complete physical silence.
- Background tab/app, screen lock, incoming OS interruption, Bluetooth
  disconnect/reconnect and active-page refresh remain `NOT TESTED` physically.
- Existing code and browser regression cover `visibilitychange`, `pagehide`,
  graph cleanup and no false completion; these are not a substitute for hearing
  silence on each device/output combination.

## Data persistence observations

- Exactly one session was written after explicit save.
- After reload, history still displayed one session.
- An explicit post-session `Claridad = 0` rendered as `0`.
- Omitted pre-state and omitted post-session tension/focus rendered as
  `omitido`; they were not converted to zero.
- The manually stopped session rendered as `Detenida`.
- The navigation-abandoned session did not create a second record.
- No schema, storage key or migration was changed by this validation phase.

## Findings

| Severity | Finding | Disposition |
| --- | --- | --- |
| P0 | None observed in the functional validation. Physical P0 absence is not certified. | Keep the physical gate open. |
| P1 | Required physical-audio acceptance and the iPhone/Android runs are incomplete. | Blocks unconditional V1 physical-audio acceptance. |
| P2 | None observed. | — |
| P3 | None recorded. | — |

The P1 is a validation gap, not an observed product defect. No finding was
silently fixed and no product source was changed.

## Automated regression run

The complete existing gate was rerun after preparing this validation record:

- Unit/integration: **177/177 PASS**.
- Browser UI: **95/95 PASS** using the repository's native Web Audio harness.
- Total automated cases: **272/272 PASS**.
- TypeScript: **PASS**.
- ESLint: **PASS**.
- Build with Voice Journey/Harmonic Lab ON: **PASS**.
- HTTP/API/landing smoke ON: **PASS**; `/voz` and
  `/laboratorio-armonico` returned 200.
- Build with Voice Journey/Harmonic Lab OFF: **PASS**.
- HTTP/API/landing smoke OFF: **PASS**; `/voz` and
  `/laboratorio-armonico` returned the expected 404 while legacy routes and the
  landing fallback remained available.

CI must run against the documentation commit before this record is considered
closed. Its result and URL are recorded in the Phase 3E.1 delivery report; no
CI workflow or product behavior is changed by this phase.

## Human physical-acceptance checklist

Complete one copy for each browser/output combination. Begin at a conservative
system and in-app volume. Use stereo headphones for binaural checks.

**Environment**

- Date/time:
- Commit/build URL:
- Physical device category (no serial number):
- OS/version:
- Browser/version:
- Output: device speaker / wired headphones / Bluetooth earbuds / other:
- Starting system volume and in-app volume:

**Guided journey**

- [ ] Session entry was understood without assistance.
- [ ] Text-only intention worked; no microphone was required.
- [ ] Current step and recommendation were understandable.
- [ ] “¿Por qué esta sesión?” was available without obstructing the main path.
- [ ] No audio started before explicit confirmation.
- [ ] Stop remained visible and easy to reach.
- [ ] Observation was understandable.
- [ ] Save was explicit and the completion state was clear.
- [ ] Reload preserved the saved record.
- [ ] A zero rating remained zero and omitted ratings remained omitted.
- [ ] An abandoned session did not become completed or saved.

**Audio**

- [ ] Initial output was comfortable.
- [ ] No clipping or unintended distortion was heard.
- [ ] No pops/clicks or sudden gain jumps were heard.
- [ ] Transitions were not harsh.
- [ ] Stereo balance was correct where applicable.
- [ ] Simultaneous playback did not produce obvious clipping.
- [ ] Stop was perceived as immediate.
- [ ] Output was completely silent after stop/completion/navigation.
- [ ] No oscillator remained stuck and no sessions overlapped.
- [ ] Binaural playback was checked with stereo headphones, or marked N/A.

**Mobile/interruption**

- [ ] No horizontal overflow.
- [ ] Text fields and CTA were usable with the keyboard open.
- [ ] Long recommendation text did not hide actions.
- [ ] Expandable rationale and post-state controls were usable.
- [ ] Safe areas were respected.
- [ ] Portrait/landscape change did not break the page.
- [ ] Background/app switch behavior matched the visible warning.
- [ ] Screen lock/interruption behavior was documented.
- [ ] Bluetooth disconnect/reconnect was documented, or marked N/A.

**Result**

- Overall: PASS / FAIL / NOT TESTED
- Highest issue severity: none / P0 / P1 / P2 / P3
- Notes and exact reproduction steps:

## Recommendation

**Partial proceed.** Automated and Chrome/macOS functional/data gates pass, so
documentation and further validation preparation may continue. Do not claim
physical-audio acceptance and do not begin a release or claims closeout that
depends on it until a human completes at least:

1. Chrome/macOS with device speakers;
2. Safari/macOS with device speakers;
3. iPhone/Safari with device speaker;
4. Android/Chrome with device speaker; and
5. one stereo-headphone run covering simultaneous and binaural playback.

Any P0/P1 observation should stop acceptance and be documented before a
separately approved fix. Phase 3C and other product/claims work were not begun.

# Marina · Punto Cero

## Background audio and lock-screen controls (2026-11-22)

The composer and guided/free practices no longer pause in response to `visibilitychange`. Both audio engines request `navigator.audioSession.type = 'playback'` when supported; optional API failures do not block playback, and a reference-counted lease restores the previous policy on stop/dispose without overriding a later microphone policy. Media Session exposes play/pause/stop, title, elapsed position and duration to the operating system. Unsupported controls degrade without changing the audio engine.

Guided/free tones are scheduled as a complete, finite timeline on `AudioContext.currentTime`, including future phase boundaries, fades and silent phases. Background JavaScript throttling therefore cannot prolong a tone or delay a tone transition. Resume schedules only the remaining timeline; stopping cancels both current and future sources. The existing composer already schedules its duration in audio time.

Real AudioContext suspension/interruption still pauses the practice and offers user-initiated resume. Navigating away still disposes the graph. A microphone recording still stops when the page is hidden, while an already playing recorded phrase is no longer explicitly paused by hiding. Browser speech synthesis and the start of a recorded phrase at a future phase depend on the browser delivering callbacks; this change does not turn synthesized guidance into a background audio file.

Validation includes hidden-page event regressions, native browser Media Session metadata, playback policy ownership/fallback tests, scheduled phase endpoints without UI ticks, resume into a later phase, and cancellation during unlock. Desktop/CI checks do not establish locked-screen behavior on a physical iPhone or Samsung. That last check needs the user's device, Safari/Chrome version and output route.

References: [Audio Session type](https://developer.mozilla.org/en-US/docs/Web/API/AudioSession/type), [Media Session position](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setPositionState), and [WebKit background AudioContext issue 261554](https://bugs.webkit.org/show_bug.cgi?id=261554). Playback policy is a browser hint, not a guarantee that the operating system will never interrupt audio.

## Included composer recipes across devices (2026-11-22)

The composer includes a built-in bank of four recipes, available on a fresh browser without importing or signing in: Punto Cero 7.8 (6 min, 200/207.8 Hz, 50%), Imagen y creación (8 min, 259.2/324/388.8 Hz continuous layers at 50/35/25%), Foco 15 (10 min, 220/235 Hz, 60%), and Exploración 40 (8 min, 340/380 Hz, 50%). All use 4-second fades and the existing 15% initial listening volume. The first three are a manually selected 24-minute sequence; the fourth is an alternative.

The direct route `/marina-punto-cero/compositor` opens the composer immediately. The existing route retains the guided-practice default. Loading an included recipe creates an editable draft and clears the selected local recipe ID; saving it creates a separate local copy, preserving existing recipes and private journals. No audio starts when a recipe is loaded.

This is shared app content, **not account synchronization**. Local changes, future personal recipes, recordings and diary entries remain device-local. The UI states this distinction. No personal localStorage, saved intentions or journal text is uploaded or embedded in the app bundle.

New additive route: `/marina-punto-cero`, linked from **Explorar**. No dependency, server API, credential, database migration or existing preset change.

## Included

- Free exploration: ten attributed reference cards; sinusoidal amplitude modulation, stereo binaural difference, direct tone and silence. Editable carrier, frequency, duration and sound level.
- A 24-minute guided composition: quiet (4 min), emotion (3), blueprint (8), deepen (4), hold (2), release (3). The duration and sound sequence are our adaptation; they are not advertised as Jacobi's literal protocol.
- Optional browser speech synthesis in Spanish, independent voice level, current written instruction always available.
- Pause/resume with active-time accounting. Stop invalidates asynchronous audio starts. Interrupted AudioContexts pause the practice; navigating away releases this module's audio and speech. Background support is detailed above.
- Explicit local journal save, stopped versus completed status, repeat-safe session IDs, later event notes, JSON export. No ATENEA synchronization or medical inference. Invalid stored data is preserved and exportable; a failed save offers a recovery file.
- Source notebook: attributed ideas, links to the books, and additional numeric passages retained for study. The high-frequency reference has no playback control.

## Audio implementation

Pulse uses a sine carrier through gain `0.5 + 0.5*sin(2*pi*rate*t)`; its LFO is not connected directly to the output. Binaural uses two sine oscillators and separate ChannelMerger inputs. Direct mode emits the entered frequency. Master gain has short fades. Frequency validation uses the actual context sample rate, including the upper sideband in modulation. A new module start stops the existing shared audio engine; this module cleans up only its own graph on exit.

No acoustic mode is described as equivalent to Jacobi's unspecified field apparatus. Choosing a binaural realization is our implementation choice, not an original pair prescribed in the book.

## Source references

- [The Harmonic Reactor](https://marinajacobi.com/wp-content/uploads/2022/10/The-Harmonic-Reactor-Corrections-11-19-21-1-1.pdf), Frequency and Sound / Numbers Hz, PDF pages 56–58; context for the heart passage on PDF pages 54–55.
- [The Scientific Download](https://marinajacobi.com/wp-content/uploads/2022/10/The-Scientific-Download-by-Marina-Jacobi.pdf), passages on regeneration and holograms, PDF pages 14 and 19.
- User-supplied transcripts: `Calming Your Frequency to Zero Point` and `Quantum Manifestation - New Earth Galactic Mediation for Manifestation`, used for the order of quiet, emotion, image, intensification and release. The guided wording is newly written in Spanish.

## Validation

Run from `frontend`: `npm test`, `npm run typecheck`, `npm run build`.

New tests cover timing boundaries, pause accounting, real graph wiring via a mock AudioContext, AM offset/depth, stereo routing, stop during unlock, interruption, recipe replacement, silence, representability, journal upserts and corrupted-storage preservation.

Physical listening, speech voice availability and Safari/iPhone interruption behavior require a real device. Synthetic checks do not establish experiential effects.

The managed preview launcher supplied Vite-style `--host` / `--strictPort` flags to `next dev`, so browser QA was unavailable in this environment. The application was not changed to compensate for the preview infrastructure.

The build emitted a security-upgrade warning for the existing Next.js 16.4.3 dependency. The first invocation stopped after generating the routes; repeating the build completed with the warning. Dependency upgrades are outside this additive module. Local checks ran on Node 24.22.3; the repository declares Node 22.x and retains that setting.

## Extension: Scientific Download (2026-11-21)

The same guided tab now has a selector: the existing **24 minutes** remains the default; **12 minutes · Neutralidad y creación** adds neutral (3), choose (2), image/feeling (3), expression (2) and stabilization (2). The final four minutes have no generated tone. Timing and AM/binaural choices are app adaptations. The user may remain in silence after the timer ends.

Before a guided session, users can write a statement, scene and feeling. These are snapshotted with the protocol at session start and saved with the diary. Existing v1 records remain readable, without rewriting or migrating their contents. Later observations are explicitly appended with an ID and timestamp; prior notes remain intact. JSON export includes the new fields.

**My phrase with my voice:** explicit microphone button, at most 60 seconds / 10 MB, supported MIME selection, audio-file upload fallback, playback controls, independent existing voice volume, download and delete. The latest phrase is kept as a Blob in local IndexedDB (`fh-marina-phrase`), not in localStorage or the session JSON. It is a reusable current recording, not a separate archived recording for each diary entry. In the 12-minute Expression phase it plays once, with manual replay; the synthesized guide is skipped there if a recording exists. Denied permission, failed persistence or blocked automatic playback show a fallback message. Hidden-page/unmount cleanup stops tracks; generation checks release streams arriving after cancellation. No server upload or cross-device sync.

Seven attributed study cards link directly to Scientific Download PDF pages 6, 14, 15, 19, 23, 24 and 25. Ambiguous units remain literal; there is no new ultrasonic playback control or inferred heart measurement.

Fixed existing speech effect dependencies so the 200 ms session render does not repeatedly cancel/restart the guide.

Validation: 280 unit tests pass, TypeScript and scoped ESLint pass. Production build completes on retry; the existing Next.js 16.4.3 security warning persists. Added `node --test ui/marina-flow.test.mjs` for native browser testing of recording persistence, session timing, speech frequency and dated notes. Browser launch in this execution environment is blocked by `socket() failed: Operation not permitted`; that test could not run through the application. Physical recording/listening and Safari/iPhone remain unverified.

## Extension: acoustic composer (2026-11-22)

The existing route now has a **Compositor** tab. It mixes up to three independently enabled sine layers: continuous audible tone, sinusoidal amplitude modulation on an audible carrier, or stereo binaural difference. Each layer has an independent level; pulse layers also expose modulation depth. Duration is 1–240 minutes; entry/exit fades are configurable from 0.05 to 10 seconds. Default is one 200 Hz carrier pulsed at 7.5 Hz with 35% depth, for 12 minutes; the other two layers begin disabled. These are application design choices.

The source bank retains **7–8 Hz**, **0.3879 Hz**, **0.32789 Hz**, and **0.378394 Hz** from [Nano Technology: The Constructive Elements](https://marinajacobi.com/wp-content/uploads/2022/10/Nano-Tech-Final-PDF-7-27-17.pdf), printed pages 1, 3, 12 and 23. 7.5 Hz is an explicitly identified app-selected point in the 7–8 Hz interval. Do not confuse Nano Technology's **0.378394 Hz** with Scientific Download's **378394 Hz**. Sub-Hz values control an LFO connected only to the carrier's gain, not an infrasonic output. The original associations remain attributed and are not evidence of molecular or therapeutic effects.

### Mixer and lifecycle

`MarinaComposerAudio` owns its context and nodes. For enabled layer levels `w`, gains are `w/max(1,sum(w))`, bounding the combined per-channel sine peak without boosting quiet mixes. For AM depth `d`, the envelope is `1-d/2 + (d/2)*sin(2πft)`, in `[1-d,1]`. Both binaural channels connect to separate merger inputs. Validation includes the actual context sample rate and the upper AM sideband.

Oscillator start/stop and both fades are scheduled on the audio clock. UI delays cannot extend the audible recipe past its scheduled deadline. The active clock reads context time; pause excludes inactive time, and resume schedules only the remaining duration. Resume restarts oscillator phase and briefly fades in; phase continuity across a pause is not claimed. Stop, context interruption and unmount release this graph; generation checks cancel a start awaiting context unlock. The shared audio engine is stopped on composer start. Master listening volume is adjustable independently, including zero; layers are locked until a session is saved or discarded.

The optional geometry is a slow attention aid, not a sensor. It follows the first active pulse at or below 1 Hz, otherwise 0.1 Hz, and respects reduced-motion preference.

### Persistence

Recipes use `fh.marina.compositions.v1`; composer experiences use `fh.marina.composer-sessions.v1`. The original `fh.marina.sessions.v1` and voice Blob database are untouched. A recipe retains exact numeric parameters, enabled layers, relative levels, duration, transition, intention and geometry setting. Listening volume is intentionally separate. Loading a recipe never starts audio automatically. Each saved experience contains the start-of-session recipe snapshot, active elapsed time, completion/stopped status and optional observations.

Explicit local saves and JSON export are available; no server upload, cross-device synchronization, microphone, file background or synthesized voice layer is introduced by the composer. Existing guided voice and phrase recording stay in their current tab. Corrupt stored data is preserved; export of original strings and a failed-session-save recovery file are available.

### Validation and limits

Ten additional unit tests cover precise sub-Hz round-trips, original-journal isolation, malformed data, invalid input/Nyquist bounds, peak normalization, three-mode wiring, stereo isolation, audio-clock completion/fades, pause time, zero volume, interruption and cancellation during unlock. A failed new unlock resets elapsed time rather than inheriting the prior session's duration. `ui/marina-composer-flow.test.mjs` adds a real-browser persistence/play/pause/resume/diary/mobile flow. The local Chromium runner remains blocked before page load by the environment's socket restrictions; local browser test code is not passing evidence.

Main's existing Next.js **16.4.6** security update is included; no new dependency is introduced. Physical listening, Safari/iPhone behavior and experiential effects require device observation.

Checks with Next.js 16.4.6: **290/290 unit tests**, TypeScript, scoped ESLint and production build pass. GitHub run 45034886970 passed Quality and Flags ON/OFF, including both Marina browser flows, before the final elapsed-time edge-case correction. Live Chrome checks on the Vercel Preview verified all three enabled layer controls, exact 0.32789 Hz recipe persistence after reload, explicit load without autoplay, playback at listening volume zero, a frozen progress value during pause, resume/stop and explicit diary save. A 390×844 viewport had no horizontal overflow (document width 384 px). These checks verify browser behavior, not acoustic output or efficacy. Both Marina UI test launchers now honor the existing `FH_UI_BROWSER=chromium` CI setting instead of assuming `/usr/bin/chromium`.

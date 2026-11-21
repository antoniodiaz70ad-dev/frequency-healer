# Marina · Punto Cero

New additive route: `/marina-punto-cero`, linked from **Explorar**. No dependency, server API, credential, database migration or existing preset change.

## Included

- Free exploration: ten attributed reference cards; sinusoidal amplitude modulation, stereo binaural difference, direct tone and silence. Editable carrier, frequency, duration and sound level.
- A 24-minute guided composition: quiet (4 min), emotion (3), blueprint (8), deepen (4), hold (2), release (3). The duration and sound sequence are our adaptation; they are not advertised as Jacobi's literal protocol.
- Optional browser speech synthesis in Spanish, independent voice level, current written instruction always available.
- Pause/resume with active-time accounting. Stop invalidates asynchronous audio starts. Hidden tabs and interrupted AudioContexts pause the practice; navigating away releases this module's audio and speech. No locked-iPhone playback guarantee.
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

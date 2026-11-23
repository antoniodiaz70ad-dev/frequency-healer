# Preparación de cristales · Resonance Lab

Additive route `/preparacion-cristales`, linked under Explorar. The existing Marina, composer, cymatics and breathing routes retain their behavior. No dependency, backend, account, hardware-control or deployment configuration changes.

## User experience

- Three areas: Preparar, Guía y sonido, Mi cuaderno.
- Crystal name/material/details, purpose (creation, focus, calm, communication), intention and scene. The operator assigns the tool's function; no claim that the object decides or manifests independently.
- 15-minute design: prepare 3, define 2, intentional programming 5, stabilize 3, silent close 2. The 10-minute design uses 2, 1, 4, 2, 1. These are app designs, not a literal Cannon or Vogel treatment protocol.
- Editable fundamental from 80–2000 Hz (default 256); fifth and octave at 1.5× and 2×. Relative amplitude 1:0.5:0.25, fixed divisor 1.75 across the entire score. Programming adds voices in thirds; stabilization removes them in thirds. Final phase has no generated tone.
- Speaker, headphones, or own voice/silence; sound checkbox and master level. Spanish browser speech is optional, has a separate level and speaks once per guide change. It stops when hidden; background speech is not guaranteed.
- Explicit start, pause/resume, stop, explicit save or discard. Session settings are frozen while the snapshot exists. The progress bar measures session time and never claims to measure energy or charge in the crystal.
- An existing piece is sufficient to start. Source/care notes are available in a disclosure, without turning the practice flow into a bibliography.

## Source and design boundaries

Consulted 2026-11-23:

- Marcel Vogel legacy method: https://marcelvogel.org/vogel-healing-method.html. Documents operator participation, breath, intention and well-being in that tradition. We use natural breathing, do not reproduce forceful breath/pressure maneuvers, and do not provide treatment or efficacy claims.
- User-provided Dolores Cannon, The Convoluted Universe, Book Two, PDF pages 54–55, 122–123 and 147–149. Regression narratives describe supports/amplifiers and tone/color systems but supply no universal Hz prescription. No copyrighted PDF is copied into this public repository.
- NIST: https://www.nist.gov/pml/time-and-frequency-division/popular-links/time-frequency-z/time-and-frequency-z-q-ra. Quartz resonance in devices depends on physical design. The audio score does not identify or measure the specimen's resonance.
- GIA: https://www.gia.edu/amethyst-care-cleaning. Relevant care notes for identified amethyst; no universal sun, salt, heat or solvent recommendation for unidentified minerals.

There are no torsion-field, aura, chakra-clearing, permanent-charge, water-purification or manifestation-success indicators. The user can record experience and interpretation separately, including exploratory energetic interpretations. Audible numbers, duration and musical ratios are selected by Resonance Lab; they are not attributed as ancient/Vogel mineral-programming codes.

## Audio lifecycle

`CrystalAudio` owns an independent bounded Web Audio graph. It uses the existing playback-session lease and media controls. All oscillator starts/stops and envelopes are scheduled on AudioContext time at explicit user start, so phase changes need no background UI timer. Every voiced step has a short fade; the last phase contains no oscillators. The clock still covers that silent tail. UI timers only display the current phase and detect completion.

Pause snapshots audio time and stops current/future sources; resume rebuilds only the remainder. Stop invalidates pending `resume()` operations. A genuine AudioContext interruption preserves elapsed time and pauses; route exit disposes the context. iOS/Android physical lock-screen playback requires device validation. There is no blanket guarantee for operating-system interruptions.

## Data and portability

One new localStorage namespace: `fh.crystals.v1`, document `{schemaVersion:1, preparation, sessions}`. Explicit saves only. The preparation can be saved before practicing. Sessions snapshot crystal, purpose, intention, scene, tone base, sound/exposure, duration, design version, initial volume and timestamped active-time level changes. Notes and subsequent dated follow-ups are distinct.

The module has its own JSON export/import; it is not silently added to the existing versioned unified-export allowlist. Export/import permits transfer to another device; there is no automatic cloud sync. Import merges by immutable session ID and follow-up ID, preserves the current local preparation and rejects conflicting cores or observations before writing. Import is capped at 5 MB and 1000 sessions. Malformed existing storage is never overwritten; raw export and unsaved-session recovery download are available. Storage quotas surface as failures, not successful saves.

## Validation

- `npm test`: 318 passing tests, including 11 new cases for crystal score timing, normalization, silence, validation, audio graph scheduling, pause/resume, pending-start cancellation, interruption, snapshot isolation, append/import and corruption handling.
- `npm run typecheck` and scoped ESLint: pass.
- Production build: the ordinary Turbopack build was blocked by Google Fonts network access. A Webpack production build passed using a temporary Next font-response fixture with a local font. The fixture is outside the repository; production font configuration is unchanged. This validates code/build integration, not fetching the real fonts.
- HTTP smoke against the production build returned 200 and the module heading, preparation form and notebook.
- The standalone browser flow could not launch Chromium: this execution environment denied its Unix socket creation. A subsequent manual UI check through connected Chrome on the Vercel preview verified preparation save, 10-minute selection, invalid-frequency rejection, start (master volume zero), pause time preservation, resume/stop, stopped-session save, dated follow-up and persistence after reload. This is not a full automated UI-suite pass or a physical-listening result.
- The Vercel preview deployed successfully using its normal build environment.
- Added `node --test ui/crystals-flow.test.mjs` for preparation, invalid input, native audio lifecycle, stopped-session save, reload, dated follow-up, JSON download and transfer into a second isolated browser context. Browser execution does not establish physical listening or energetic effects.

Default volume is conservative app gain, not calibrated sound pressure. No control applies electricity to a mineral or to a body.


## Coils output option

The output selector also offers **Mis coils · conexión de audio** (`exposure: coils`). It generates the same bounded harmonic timeline through the browser's existing default audio destination. The user connects their coil controller and chooses the cable/USB route in the operating system; the UI does not claim hardware detection, automatic routing, calibration or validated coil support. Browser narration is turned off and unavailable for this mode because speech would otherwise use the same system destination. Written guidance remains available. The choice is included in saved sessions and JSON portability. No coil-specific frequency effects or magnetic-field strength are inferred from the audio gain.

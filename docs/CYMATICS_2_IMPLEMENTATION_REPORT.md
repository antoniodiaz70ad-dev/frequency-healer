# Cimática 2.0 — implementation report

Date: 2026-10-11  
Branch: `codex/cymatics-2-v1`  
Base: `d758619ce73ced96edcb0c776d4d3e37a97b4396`

## Scope delivered

- Corrected circular-membrane modal mass using the Bessel-mode norm and angular integral.
- Circular-field RMS now integrates only the physical disk, excluding zero-filled pixels outside it.
- Ambiguous four-edge zero-contour cells use the cell-center sign to choose topology.
- Added a local radix-2 FFT with Hann, Hamming and rectangular windows; the UI uses Hann and reports dBFS.
- Added a bounded, in-memory spectrogram. Microphone samples are not persisted or transmitted.
- Added three versioned scientific protocols and explicit V2 experimental records.
- Preserved the existing audio engine, binaural channel separation, V1 gallery and all prior routes.

## Physical model

The plate remains a simply supported, isotropic thin plate with
`D = E h³ / [12(1 − ν²)]`. The circular membrane remains homogeneous, fixed at
the edge, with `f_mn = α_mn / (2πR) √(T/μ)`. Forced response still sums complex
modal responses before computing magnitude. Damping remains positive and finite.

The membrane modal mass now follows the unnormalised real mode used by the
field computation:

`M_mn = μ R² J_(m+1)(α_mn)² / 2 × A_m`, where `A_0 = 2π` and `A_m = π` for
`m > 0`.

## Data and privacy

New namespace: `fh:cymatics-experiments-v2`.

Each saved record contains its protocol identity, immutable validated
`CymaticsConfigV1`, optional note, optional scalar spectral summary, and method
provenance. It contains no microphone samples, audio recording or blob. Saving is
explicit; malformed existing data is preserved and blocks writes.

## Validation

- Unit/integration: 260 passed.
- Browser/UI: 117 passed.
- TypeScript: passed.
- ESLint: passed.
- Next.js production build (`--webpack`): passed; 15 routes generated.
- Existing and new binaural/audio cleanup browser coverage: passed.
- Field/particle and ideal/forced captures generated under `artifacts/cymatics-2/`.

## Limitations

- FFT frequency resolution is `sampleRate / 4096`; the displayed peak is the
  strongest FFT bin and does not use sub-bin interpolation.
- The spectrogram is an in-memory educational display with a 120-frame limit,
  not a calibrated measurement instrument.
- Microphone response depends on device hardware, OS processing and acoustic
  conditions even when browser constraints request no AGC/noise suppression.
- Particle motion remains explicitly illustrative; it is not a granular-fluid
  or experimentally calibrated sand simulation.
- Modal truncation remains the configured finite cutoff; this version does not
  add an automatic convergence estimator.
- Generated browser captures are automated desktop evidence. No new physical
  mobile microphone validation was claimed for this branch.

# Mi frecuencia · Mi voz

Adds a live voice comparison panel to `/laboratorio-cimatico`, based on
`codex/cymatics-live-particles-first` at `64964476bc5570739ca1eee395bceb9bd8aab713`.

## User flow

1. Press **Conectar mi voz en vivo** and allow microphone access.
2. Sustain a comfortable vowel or hum. Estimated fundamental (60–1200 Hz)
   drives a simulated surface beside a 432 Hz reference (editable).
3. Use **Usar mi tono como referencia** to hold a vocal target, then vary pitch.
4. Capture vocal A and B to compare two stationary modeled responses using
   identical physical settings, unit virtual force and a shared color scale.
5. Export the numeric snapshots/configuration as JSON, or transfer either
   snapshot into the existing laboratory for particles, PNG and gallery tools.

## Model and interpretation

The current comparison uses the estimated fundamental only. It does not drive
all spectral components simultaneously. The FFT/spectrogram remains available
in a disclosure to inspect the voice's other components. It neither measures
body vibration nor assigns health, emotion, identity or quantum meaning.

Live fields are recalculated stationary modal responses, not transient physical
plate measurements. A shared pairwise color maximum updates with each reading;
brighter colors across different moments are not evidence of higher amplitude.
The physical configuration is frozen when starting a microphone session. A new
session clears A/B captures to avoid comparing different physical settings.
Weak/off-range responses remain weak; pitch is never snapped to resonance.

## Lifecycle and privacy

- No capture or playback before an explicit user action.
- Audio capture feeds only an analyser, never the output destination.
- Analysis and display update at at most 10 Hz; no audio samples are stored or sent.
- Noise, silence and low confidence clear the live pitch and disable captures.
- Stop, hidden tab, unmount and stream ending release resources.
- Cancellation tokens stop late streams after a permission request is cancelled.
- Generator, example playback, guided-session start and the existing advanced
  microphone stop the new voice input. Starting voice stops existing lab activity.
- Captures remain in component memory until an explicit JSON download or transfer;
  the existing gallery only persists through its existing explicit save action.

## Validation

- TypeScript check, ESLint on changed components/helpers, production build.
- 269 unit tests passed, including harmonic vocal mixtures, silence/confidence
  gating and octave/unison/difference calculations.
- Three browser integration tests passed with a synthetic microphone and real
  Web Audio analysis: 220→330 Hz tracking, silence, capture/export, mobile width,
  generator handoff, denied permissions and late permission cancellation.
- Desktop/mobile screenshots inspected locally.
- Existing cymatics UI regression: 15/16 passed. Guided-session skip test
  times out at the click on `Saltar paso`; the identical failure was reproduced
  on untouched base commit `6496447` in a separate checkout. It remains an
  existing limitation rather than a passing check.
- The reference physical configuration is stable even while the microphone is
  off, avoiding modal recomputation during unrelated laboratory sweeps.

Physical microphones, device-specific input processing, Bluetooth latency and
Safari/iPhone still require device testing. Browser tests use an injected stream;
they do not certify pitch accuracy on arbitrary voices or microphones.

## Microphone follow-up

Adds an input meter independent of pitch detection, the actual input label and
a device selector populated after permission. Local low-level voice detection
uses an RMS gate of .001 (the general pitch detector keeps its .008 default).
The voice-mode lower bound is 60 Hz for low voices. Permission and hardware
errors now have specific Spanish guidance. The audio context is created/resumed
inside the initiating button gesture, before awaiting device permission.
Additional checks cover soft speech, DC rejection and 65 Hz input. The three
browser tests pass, including low-level input at .003 gain and input-meter updates.

## Circular particle presentation

The laboratory now opens with a fixed-edge circular membrane at the calculated
(0, 2) resonance. Voice/reference views default to illustrative live particles;
the other visual modes remain selectable. A/B captures retain the chosen view.
The lightweight particle clock preserves partial simulation time across live
pitch updates, so changing fields does not repeatedly restart grain motion.
The physical default factory remains unchanged for saved files and plate examples.

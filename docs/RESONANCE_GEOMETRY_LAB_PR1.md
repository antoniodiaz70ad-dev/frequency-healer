# Resonance Geometry Lab — PR 1

## Scope

This increment adds a deterministic artistic geometry engine. It does not change cymatics physics, audio scheduling, microphone capture, experiment schemas, or saved records.

Every generated figure is classified as `ARTISTIC_GEOMETRY`. The acoustic reference frequency is stored separately from the geometric parameters and does not participate in the geometry signature.

## Mathematical families

- Star polygons `{n/k}`. Coprime pairs produce a single cycle. Non-coprime pairs remain valid compound polygons with `gcd(n,k)` cycles.
- Orbital circles with rotational symmetry.
- Radial wheels with an independent inner star construction.
- Parametric Lissajous curves.
- Polar curves with controlled radial symmetry.

The seven reference presets are original parameter combinations for 33, 66, 99, 333, 666, 999, and 1998 Hz. Their frequency labels are reference metadata, not evidence that a tone exclusively creates the corresponding shape.

## Particle defect registered for the next PR

### Report

On some runs of the existing Cymatics Lab, the particle view remains visually dispersed and does not make the modeled low-amplitude contours legible within the intended 3–5 second illustrative settling period.

### Reproduction

1. Open `/laboratorio-cimatico` on a cold page load.
2. Select the square-plate `(2,2)` example.
3. Switch the view to `Partículas ilustrativas`.
4. Reset particles with the fixed seed.
5. Observe at 0, 3, and 5 seconds without changing frequency or excitation.
6. Repeat with the circular-membrane examples and with reduced motion enabled and disabled.

### Current evidence

The pure particle integrator test passes: seeded particles remain finite and bounded and their mean field potential decreases after four simulated seconds. The reported defect therefore remains reproducible at the rendered-system level and must not be dismissed as a purely mathematical or purely visual issue.

The next PR must inspect separately:

- worker timing and message delivery;
- fixed-step accumulation after visibility changes;
- particle density and device-pixel scaling;
- force/threshold propagation from the React component;
- contrast and contour overlay;
- iPhone frame throttling.

### Protected boundary

PR 1 does not change `physics.ts`, `particles.ts`, the particle worker, Canvas/WebGL renderers, or the audio engine. Baseline screenshots should be captured with the same example, seed, viewport, and timestamps so the next change can be compared objectively.

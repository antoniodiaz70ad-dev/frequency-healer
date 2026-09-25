# Frequency Healer V1 Data / Export Integrity

## Contract

`frequency-healer-data-export-v1` is a read-only, local JSON export. It does not import, repair, synchronize, migrate or write browser data. The exporter calls `getItem` only for the exact allowlist below; it never enumerates browser storage.

## Explicit namespace allowlist

1. `fh:voice-sessions-v1`
2. `fh:voice-consent-v1`
3. `fh:voice-settings-v1`
4. `fh:experiment-sessions-v1`
5. `fh:experiment-sessions-v2`
6. `fh:harmonic-constellations-v1`
7. `fh:protocol-discovery-plans-v1`
8. `fh:personalized-experiments-v1`
9. `fh:adaptive-experiments-v1`
10. `fh:obe-session-logs-v1`
11. `fh:next-session-config-v1`
12. `fh:hemi-sync-disclaimer-accepted-v1`

Each entry carries the exact raw value and one status: `absent`, `valid` or `invalid`. Invalid bytes are preserved and identified; they are never normalized or overwritten. Newer stores use their existing runtime validators. The two legacy OBE payloads and disclaimer use strict export-only validation matching their current writers.

## Seed Selection V1 provenance

The manifest always names `voice-rules-v2`, `seed-registry-v1` and `seed-selection-v1`. For a valid voice history it counts legacy and V2 proposals. Every V2 proposal must retain its validated `seedSelection` and `proposalIdentity`, including rule version, registry version, selection version, intent, effective progression, selected seed and final `HarmonicConfig`. Invalid voice history remains exportable byte-for-byte and is explicitly marked `voiceRecordsStatus: invalid`; no provenance is inferred from corrupt data.

## Integrity verifier

The verifier checks the top-level contract, exact allowlist and order, each namespace against its current validator, Seed Selection provenance counts and a SHA-256 digest over the complete manifest and raw namespace values. A changed byte, status, count, timestamp, namespace or provenance field invalidates the export. Verification performs no storage access and no writes.

This is an integrity-checked export, not an import or cloud backup facility.

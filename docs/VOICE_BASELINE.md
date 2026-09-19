# Voice Journey baseline — 2026-09-19

- Original checkout: `/Users/ensenada/Movies/frequency-healer`, clean, branch `feature/command-cards`, HEAD `560847872a266accb017ab69c1698832312bccbd`. Unchanged.
- Isolated worktree: `/Users/ensenada/Movies/frequency-healer-voice`.
- Work branch: `codex/voice-journey-grant`.
- Base: remote main `3fc370a6748a6ba3c9b6d4e3ff30d26204babd38`.
- Applicable instruction: `frontend/AGENTS.md`; installed Next 16.2.0 docs consulted (server/client components, route handlers, notFound, environment variables).
- Existing harmonic laboratory, harmonic presets and prior harmonic specification not found in repository or searched document folders. Implement the harmonic contract contained in the supplied Voice Journey specification as a separate additive foundation.
- Baseline lint and TypeScript: pass. Baseline sandbox build: fails downloading existing Geist fonts from Google; retry with network access recorded in final report.
- Protected: old audio engine API, AudioVisualizer singleton, routes and all existing local storage keys. New storage namespace only.
- Confirmed preexisting issue: generator has no unmount cleanup and can leave audio/timers running after navigation. Minimal route cleanup will be isolated in integration commit.
- Existing engine `stopProtocol` clears its timer without resolving its pending Promise. No rewrite in this change; new flow does not call `playProtocol`.
- Backend is unchanged. No production environment changes, production deployment or main merge authorized.

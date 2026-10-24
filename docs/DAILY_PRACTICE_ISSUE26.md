# Sintonizar mi día — issue #26

## Result

Adds a daily practice entry at `/inicio` and a daily mode at `/voz?practica=diaria`. The existing guided session remains at `/voz`. Daily mode asks for optional pre-session ratings, an explicitly selected calm/clarity/focus goal, and the user's own intention. Its initial proposal lasts five minutes; users can review and change it before explicit playback confirmation.

After playback, optional post-session ratings and reflection remain available. A new optional action field connects the practice with one concrete action. Saving persists the action together with the session. Discarding persists neither. Inicio displays the most recently created action even if newer sessions have no action, with explicit done/pending/edit controls. The history displays its original and subsequent revisions.

The optional preparation pause suggests comfortable breathing at the user's own pace and mentally rehearsing a situation. It does not change the OBE breathing component, implement a new breathing timer, or claim cardiorespiratory measurements. No sound/microphone starts while entering, choosing a goal, viewing history or updating an action.

## Minimal data extension

`VoiceSessionRecordV1` gains optional `dailyAction`, a separately versioned value:

```ts
{
  schemaVersion: 1,
  revisions: Array<{
    text: string; // trimmed, 1–280 characters
    status: 'pending' | 'done';
    changedAt: string;
  }>;
}
```

The first revision is pending. Subsequent explicit changes append a revision, retaining the original action and session evidence. Validation rejects empty/unknown/malformed or backwards-dated revisions and caps history at 1,000 revisions per action. These are storage constraints, not a psychological metric.

Session and action share the existing `fh:voice-sessions-v1` item and one `setItem` under the existing Web Lock. There are no cross-key partial commits or orphan actions. Updating requires the exact expected action snapshot; stale cross-tab editors and deleted records fail explicitly. Matching save retries remain idempotent; conflicting session IDs now fail instead of silently claiming a different payload was saved.

All old records remain valid without the optional field. The current validator, session export, raw export and unified export preserve action revisions. Deleting a session or the voice history removes its embedded action automatically. Corrupt stored records and quota errors are surfaced without silent repair/eviction. A valid failed-save candidate remains in memory for explicit export, as in the existing journey. This is local to the browser/origin, with no cloud synchronization or new remote services.

Compatibility boundary: this new version reads old records. An older deployed client does not understand the new optional field and may strip it when it rewrites the voice-history item; do not use an older client on the same origin after saving daily actions without first exporting the original data. This change does not add an import/rollback migration.

## Files and reuse

- `app/inicio/page.tsx`: daily entry and latest-action follow-up, with storage/focus refresh.
- `app/voz/page.tsx`: reads the documented asynchronous Next.js searchParams API; selects and keys the journey mode. `/voz` is now rendered dynamically when enabled.
- `components/voice/VoiceJourney.tsx`: daily start and action closeout; uses the existing ratings, audio proposal, playback confirmation, save/error/history flow.
- `components/voice/DailyActionCard.tsx`: accessible explicit follow-up, edit/cancel and stale/error recovery.
- `components/voice/VoiceHistory.tsx`: current action and revision reader.
- `lib/voice/dailyPractice.ts`: local goal selection and nested action validation/helpers.
- `lib/voice/types.ts`, `storage.ts`, `orchestrator.ts`: narrowly scoped type, atomic persistence and reviewed-intention support.
- `tests/daily-practice.test.ts`: seven pure/integration cases.
- `ui/daily-practice.test.mjs`: three real-browser cases, including mobile layout, no automatic playback/microphone, save/reload/update/export/delete, omission/discard and invalid-text recovery.

## Validation

Local unit/integration suite: **267 passed**. TypeScript and ESLint passed. Production builds with flags ON and OFF passed, together with both existing HTTP/landing smoke runs. Feature-disabled routes correctly return 404.

The three dedicated browser tests passed locally against the production build: the complete 390 × 844 mobile text flow (save, reload, follow-up, export and delete), the desktop optional-action/discard flow, and invalid-intention recovery without autoplay or microphone access. The same browser suite also passed in the existing Flags ON CI job. No physical listening, mobile-device microphone, Safari test or screenshot is claimed.

Reviewed against the installed Next.js guides and the React best-practices checklist. No dependency, acoustic engine, physics model, protocol rule, OBE diary, Bentov or pending cymatics PR changes. No merge or production deployment is part of this task.

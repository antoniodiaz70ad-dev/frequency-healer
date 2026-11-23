# Private composer account

Scope: saved composer recipes and composer sessions, including action plans, initial observations and dated follow-ups. Recording blobs, the guided Marina diary, crystal notebooks and other namespaces remain outside this version. Existing JSON export stays available. No audio engine or background playback changes.

The account panel uses a pinned Supabase JS client (2.119.2), passwordless email code verification and persistent refreshable sessions. Signing in does not upload local data: the user activates synchronization for the displayed account. A browser is bound to one account, and attempts to combine the local data with another account fail closed. Signing out retains the local copy and stops this panel's synchronization; the UI explicitly recommends a personal device.

## Merge and delivery

- The existing local namespaces remain authoritative for offline edits. Explicit save operations notify the account panel. It also checks on focus, reconnection, visibility and every 15 seconds while the composer is mounted and visible. This is not a service worker or a guarantee of background synchronization after the page is closed.
- A dedicated owner row stores a validated document and monotonic revision. Updates use a compare-and-set revision predicate, with at most four merge attempts. Insert conflicts are retried. In-flight operations stop applying local results after account changes, pause or unmount.
- Recipe hashes from the last successful merge distinguish normal edits from concurrent edits. Normal edits propagate; conflicting edits create stable named copies. The merge preserves original session observations. Follow-ups combine by ID; differing content is preserved with a deterministic conflict ID. Retries do not multiply copies.
- Upload precedes applying merged local records. Separate localStorage writes are not an atomic transaction. A local quota failure leaves the merged cloud document recoverable, does not acknowledge success and allows idempotent retry. Corrupt local/cloud records block synchronization rather than replacing data with an empty history.
- Limits: 5 MB JSON and 5000 entries per collection. The UI reports pending/error states; a local save still succeeds when the network does not. Unsupported or hidden-page timing does not affect the playing recipe.

## Production activation gates

1. Dedicated production Supabase project in the user-approved organization; do not reuse the ATENEA staging project. New project quote: US$10/month; approval is required before creation.
2. Apply `COMPOSER_CLOUD_SCHEMA.sql`, inspect its RLS/privileges, and run owner/other-user/anonymous/CAS tests in a rolled-back transaction. No public read or anonymous writes; authenticated users are restricted to their `auth.uid()`.
3. Configure both signup-confirmation and magic-link email templates to show `{{ .Token }}` for the code entry flow. Verify the sending address can receive auth email. Supabase's default mail transport is restricted to project-team addresses; other addresses require an authorized custom SMTP service. Do not disable email confirmation to bypass delivery.
4. Configure `NEXT_PUBLIC_COMPOSER_SUPABASE_URL` and `NEXT_PUBLIC_COMPOSER_SUPABASE_KEY` with the new project's public client URL and publishable key. Never deploy service-role credentials to the client.
5. Validate code delivery/sign-in and an actual two-device transfer before claiming the user's cloud account is active. Synthetic UI checks are not live email or live RLS verification.

Current work is prepared for review; provisioning, mail configuration and production activation remain gated until these requirements are met. The existing published app remains usable with local storage.

## Validation

Unit/integration coverage: second-device restore; offline additions; three-way normal and concurrent recipe edits; immutable observations and follow-up conflicts; compare-and-set races; local edits during a network await; quota/network recovery; account switch/pause/cancellation; malformed documents. Native Chromium regression mocks only the explicitly fake `https://composer-test.invalid` endpoint and uses synthetic accounts to exercise code entry, explicit activation, two profiles, automatic saves, offline retry and sign-out. CI injects fake configuration; it does not access production.

Sources: [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless), [email delivery constraints](https://supabase.com/docs/guides/auth/auth-smtp), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

# ATENEA private library — integration phase boundary

## Delivered in this phase

- A server-only use case that accepts a search string, obtains the principal only from an injected server-side verifier, rejects missing/expired sessions, and never accepts owner/requester IDs from the browser.
- A repository contract that requires a single consistent snapshot of identity-to-owner mapping, live permission, current source revision/rights/deletion state, documents, and chunks. Repository/auth failures fail closed. Responses are private/no-store and omit internal identifiers.
- Synthetic adversarial tests for missing and expired sessions, client-forged IDs, cross-owner snapshots, permission revocation, source deletion, stale revisions, malformed input, and database failure.
- Dropbox App Folder path policy and a forward-only constraint correction; staging migration and SQL path matrix are recorded in `docs/evidence/ATENEA_APP_FOLDER_PATHS_2026-11-02.md`.
- Dropbox OAuth design boundary below. No OAuth client, secret, route, credential, token, or real book is added.

## Explicit integration blocker

### Identity decision: Supabase Auth staging session

PR #40 is the authoritative staging login line: it implements invited-account activation and remote identity checks with Supabase Auth. PR #41 is not a competing identity provider; it hardens the revocable ATENEA **voice** session and does not implement its proposed Auth0 login. The library must derive its principal from the verified Supabase Auth session in PR #40, then apply library authorization independently. Do not accept a voice session as library identity, introduce Auth0 as another provider, or map by email. This decision applies to staging; production identity remains NO-GO until separately approved and configured.

PR #40 remains a draft and its Vercel hostname is a branch Preview, not a stable callback origin. This phase does not wire a public route or invent a verifier. Before any Dropbox OAuth flow, the Supabase Auth line must be integrated and verified on the stable staging origin, and its verified `(issuer, subject)` must map unambiguously to the opaque internal owner. The use case still requires a real server verifier and concrete repository implementation.

The Supabase project currently grants the private schema only to server `service_role`, which has `BYPASSRLS`. RLS is therefore not the backend authorization control. A production repository must derive the stable opaque `owner_id` from the verified `(issuer, subject)` mapping and read current permission/source/document/chunk rows within one database transaction. Missing or ambiguous mappings must deny access. The migration schema's `app_user_id` mapping must be reconciled with the actual identity provider before implementation; no email address or client-supplied UUID is an acceptable key.

## Dropbox authorization plan (not activated)

1. Register a separate ATENEA app with Dropbox's minimum read-only scope; use exact HTTPS redirect URIs for the eventual canonical domain and staging separately.
2. Use authorization code with PKCE/state/nonce where supported; bind callback to the authenticated ATENEA session and reject mismatched state, replay, or account changes.
3. Store refresh/access tokens only in the server secret manager or encrypted server-side token store, keyed to the verified owner. Never send tokens to the browser, logs, analytics, GitHub, or model prompts.
4. Use Dropbox App Folder scope. Dropbox API paths are relative to that app's private root; represent the pilot copy as `/Tertium_Organum_-_PD_Ouspensky.pdf`. Do not look for `/Mis plataformas/`. Require a canonical absolute API path with no empty, `.` or `..` segments, backslashes, control characters, or non-NFC names; accept only PDF paths and independently validate file ID, revision, PDF signature and size. HTML and malformed paths fail closed. A rename/path change is not identity; use provider file ID + revision.
5. Incremental sync must process changed/deleted entries and revoke retrieval immediately when the source, rights, owner authorization, or revision changes. Purge derived chunks according to the retention policy.
6. First pilot: one explicitly rights-reviewed `Tertium Organum` PDF in isolated staging, synthetic identity isolation checks first, then human review of extracted page mapping/citations. No protected books are copied during this phase.

## GO / NO-GO

| Gate | State |
|---|---|
| PR #47 pure filtering and PDF/chapter regressions | CI passed for SHA `80f600d` |
| Dropbox App Folder path policy and forward-only staging constraint | **Applied and SQL-verified in staging; 279/279 local tests pass** |
| Server query orchestration and synthetic adversarial cases | Implemented; local suite, typecheck and lint pass; CI pending |
| Authoritative staging identity | **Decision: Supabase Auth session in PR #40; draft, not yet integrated into library** |
| Supabase transactional repository using verified identity | **NO-GO: adapter contract only** |
| Stable staging HTTPS origin and exact Dropbox callback | **NO-GO: only branch Preview is verified; do not register a callback yet** |
| Dropbox OAuth, real PDF extraction, embeddings, voice RAG | **NO-GO: not implemented** |
| Production data/deployment | **Untouched** |

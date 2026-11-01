# ATENEA private library — integration phase boundary

## Delivered in this phase

- A server-only use case that accepts a search string, obtains the principal only from an injected server-side verifier, rejects missing/expired sessions, and never accepts owner/requester IDs from the browser.
- A repository contract that requires a single consistent snapshot of identity-to-owner mapping, live permission, current source revision/rights/deletion state, documents, and chunks. Repository/auth failures fail closed. Responses are private/no-store and omit internal identifiers.
- Synthetic adversarial tests for missing and expired sessions, client-forged IDs, cross-owner snapshots, permission revocation, source deletion, stale revisions, malformed input, and database failure.
- Dropbox OAuth design boundary below. No OAuth client, secret, route, credential, token, or real book is added.

## Explicit integration blocker

This repository has no installed or configured Auth0 session provider for the library. PR #41 hardens the revocable ATENEA **voice** session but explicitly leaves Auth0 login incomplete; that voice session is not automatically a library identity. Consequently, this phase deliberately does not wire a public route or invent a verifier. The use case cannot be called from the application until a real identity verifier and repository implementation are injected by the server.

The Supabase project currently grants the private schema only to server `service_role`, which has `BYPASSRLS`. RLS is therefore not the backend authorization control. A production repository must derive the stable opaque `owner_id` from the verified `(issuer, subject)` mapping and read current permission/source/document/chunk rows within one database transaction. Missing or ambiguous mappings must deny access. The migration schema's `app_user_id` mapping must be reconciled with the actual identity provider before implementation; no email address or client-supplied UUID is an acceptable key.

## Dropbox authorization plan (not activated)

1. Register a separate ATENEA app with Dropbox's minimum read-only scope; use exact HTTPS redirect URIs for the eventual canonical domain and staging separately.
2. Use authorization code with PKCE/state/nonce where supported; bind callback to the authenticated ATENEA session and reject mismatched state, replay, or account changes.
3. Store refresh/access tokens only in the server secret manager or encrypted server-side token store, keyed to the verified owner. Never send tokens to the browser, logs, analytics, GitHub, or model prompts.
4. Query only `/Mis plataformas/`, validate Dropbox file ID, revision, actual PDF signature and size, and re-check rights before extraction. A rename/path change is not identity; use provider file ID + revision.
5. Incremental sync must process changed/deleted entries and revoke retrieval immediately when the source, rights, owner authorization, or revision changes. Purge derived chunks according to the retention policy.
6. First pilot: one explicitly rights-reviewed `Tertium Organum` PDF in isolated staging, synthetic identity isolation checks first, then human review of extracted page mapping/citations. No protected books are copied during this phase.

## GO / NO-GO

| Gate | State |
|---|---|
| PR #47 pure filtering and PDF/chapter regressions | CI passed for SHA `80f600d` |
| Server query orchestration and synthetic adversarial cases | Implemented in this phase; run CI on the new commit |
| Real Auth0 session verifier for library | **NO-GO: Auth0 login not yet implemented/configured** |
| Supabase transactional repository using verified identity | **NO-GO: adapter contract only** |
| Dropbox OAuth, real PDF extraction, embeddings, voice RAG | **NO-GO: not implemented** |
| Production data/deployment | **Untouched** |

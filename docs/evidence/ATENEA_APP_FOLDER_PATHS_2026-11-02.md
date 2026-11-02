# ATENEA Dropbox App Folder path correction — staging evidence

Date: 2026-11-02 (UTC)

## Scope

Correct the library path assumption for the Dropbox app `Atenea Biblioteca`, which uses App Folder scope. The pilot is an authorized private copy of `Tertium_Organum_-_PD_Ouspensky.pdf` inside that app folder. The original file remains untouched. This change does not connect Dropbox, start OAuth, index a book, or expose a search endpoint.

## Schema before and after

Before: staging constraint `knowledge_sources_path_check` required `path LIKE '/Mis plataformas/%'`, which rejects App Folder root paths.

Forward-only migration: `supabase/migrations/20261102001246_atenea_app_folder_paths.sql` drops only that path check and adds `knowledge_sources_app_folder_path_check`. It permits canonical absolute Dropbox API paths rooted at the app folder, PDF suffixes, and rejects empty/dot traversal segments, backslashes, and control characters. It leaves the original schema migrations unchanged.

After applying the migration to Supabase staging project `rayebpxdfatsnkbderot`, a catalog query returned `convalidated=true` for the new constraint and no old path constraint. A read-only SQL matrix returned:

| Path | Accepted |
|---|---:|
| `/Tertium_Organum_-_PD_Ouspensky.pdf` | yes |
| `/books/valid.pdf` | yes |
| `/books/../secret.pdf` | no |
| `/books//bad.pdf` | no |
| `/books/page.html` | no |
| `/books\\escape.pdf` | no |

## Code and test evidence

- TypeScript rejects noncanonical paths, non-NFC names, malformed separators, dot segments and control characters; the source policy still independently requires PDF name/MIME, bounded size, current file ID/revision, nondeleted source, and explicit private-use rights.
- `npm test`: **279 passed, 0 failed, 0 skipped**.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

These are local checks before publishing this corrective draft. GitHub CI evidence is to be added for the published commit. The migration was applied only to staging; production was not changed.

## Remaining integration gates

- PR #40 Supabase Auth staging session is the selected identity line; it remains draft and is not yet wired to the library adapter.
- The known Vercel domain `frequency-healer.vercel.app` is the production project domain; the PR #40 hostname is an ephemeral branch Preview. Neither is a stable staging callback origin. No Dropbox redirect URI should be registered until a stable HTTPS staging hostname exists and is deployed.
- The real Dropbox callback, token storage, server-side authorization mapping, real two-session isolation/revocation check, indexing and voice RAG remain NO-GO.

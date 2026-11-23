# Documents in the existing frequency atlas

`/biblioteca?tab=documentos` opens a browser-private document collection alongside
the unchanged frequencies and command cards. Import MD/TXT through a file chooser
or paste, review a preview, then explicitly save. Original text remains intact and
is rendered as text, never executable HTML. No document is bundled with the app.

Features: heading-based reading with original line references, full-text/accent
insensitive search, favorites, recently opened ordering, personal notes, source
links, original downloads and versioned JSON backup/merge. Equal SHA-256 content
opens the existing item; equal names with changed content preserve both versions.
Invalid storage and quota failures retain recoverable data. Backup content hashes
are verified before a single merged write; existing annotations take precedence.

Relevant-tool links open crystal preparation, cymatics and/or the composer. They
do not auto-extract executable recipes, change an existing preparation, start audio,
or turn a document's suggested duration into a supported player duration. This
prevents a source's alternative 12-minute recipe from silently replacing the crystal
module's existing 10/15-minute designs.

Documents live under `fh.library.documents.v1` in this browser origin. Limits:
512 KiB per source, 40 documents and 2 MiB serialized library. Export preserves the
original content and personal metadata. There is no server upload or account sync
in this feature; composer account synchronization is separate pending work.

Validation: targeted unit tests cover exact originals, deduplication, retained
versions/notes, corrupt and oversized inputs, quota failure, backup digests,
cancellation, source-link filtering and neutral tool links. The browser flow uses
synthetic content to verify preview-before-save, safe text rendering, reload,
favorites, annotations, duplicate import and restore in another browser context.

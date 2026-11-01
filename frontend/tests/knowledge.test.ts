import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkExtractedPages } from '../src/lib/knowledge/chunking';
import { isDropboxReadOnlyRequest, sourceEligibility } from '../src/lib/knowledge/policy';
import { buildGroundedContext, searchKnowledge, searchAuthorizedKnowledge } from '../src/lib/knowledge/retrieval';
import type { DropboxPdfSource } from '../src/lib/knowledge/types';

const source: DropboxPdfSource = {
  fileId: 'dbx-file-1', path: '/Mis plataformas/book.pdf', revision: 'rev-1', name: 'book.pdf',
  mimeType: 'application/pdf', sizeBytes: 1234, rights: 'owner-authorized-private-use',
};

test('source policy excludes unsupported files, unreviewed rights, oversized and deleted files', () => {
  assert.deepEqual(sourceEligibility(source), { ok: true });
  assert.equal(sourceEligibility({ ...source, name: 'index.html', mimeType: 'text/html' }).ok, false);
  assert.equal(sourceEligibility({ ...source, rights: 'pending' }).ok, false);
  assert.equal(sourceEligibility({ ...source, sizeBytes: 101 * 1024 * 1024 }).ok, false);
  assert.equal(sourceEligibility({ ...source, deleted: true }).ok, false);
  assert.equal(isDropboxReadOnlyRequest('GET'), true);
  assert.equal(isDropboxReadOnlyRequest('POST'), false);
});

test('chunking preserves work, chapter and exact page provenance; missing pages stay unverified', () => {
  const chunks = chunkExtractedPages({
    ownerId: 'owner-a', sourceFileId: source.fileId, sourceRevision: source.revision,
    author: 'P. D. Ouspensky', work: 'Tertium Organum', pages: [
      { pageNumber: 14, provenance: { kind: 'pdf-page-extractor', pdfPageIndex: 13, sourceFileId: source.fileId, sourceRevision: source.revision }, text: 'Chapter 2\nLa observación requiere distinguir entre el observador y lo observado. '.repeat(3) },
      { pageNumber: null, text: 'Este fragmento no tiene una página verificable. '.repeat(5) },
    ],
  });
  assert.equal(chunks[0].chapter, 'Chapter 2');
  assert.equal(chunks[0].pageNumber, 14);
  assert.equal(chunks[0].pageVerified, true);
  assert.ok(chunks.some((chunk) => chunk.pageNumber === null && !chunk.pageVerified));
  assert.ok(chunks.every((chunk) => chunk.text.length <= 1_200));
});

test('retrieval is owner-scoped, citation-first, bounded and supports an injected semantic ranker', () => {
  const chunks = chunkExtractedPages({
    ownerId: 'owner-a', sourceFileId: source.fileId, sourceRevision: source.revision,
    author: 'P. D. Ouspensky', work: 'Tertium Organum', pages: [
      { pageNumber: 14, text: 'La observación del observador distingue conciencia, percepción y experiencia. '.repeat(3) },
    ],
  });
  const privateChunk = { ...chunks[0], id: 'private-other-user', ownerId: 'owner-b' };
  const hits = searchKnowledge({
    query: 'observación percepción', requesterId: 'owner-a', chunks: [...chunks, privateChunk], limit: 12,
    semanticScores: new Map([[chunks[0].id, 1]]),
  });
  assert.equal(hits.length, 1);
  assert.match(hits[0].citation, /Ouspensky.*p\. 14/);
  assert.equal(searchKnowledge({ query: 'observación', requesterId: 'owner-b', chunks }).length, 0);
  assert.ok(searchKnowledge({ query: 'observación', requesterId: 'owner-a', chunks, limit: 99 }).length <= 8);
  assert.ok(buildGroundedContext(hits, 30)[0].text.length <= 30);
});


test('a bare or mismatched page number is never considered verified', () => {
  const args = {
    ownerId: 'owner-a', sourceFileId: source.fileId, sourceRevision: source.revision,
    author: 'P. D. Ouspensky', work: 'Tertium Organum',
  };
  const bare = chunkExtractedPages({ ...args, pages: [{ pageNumber: 3, text: 'Contenido de prueba '.repeat(12) }] });
  assert.equal(bare[0].pageVerified, false);
  assert.match(searchKnowledge({ query: 'contenido', requesterId: 'owner-a', chunks: bare })[0].citation, /página no verificada/);
  const wrongRevision = chunkExtractedPages({ ...args, pages: [{
    pageNumber: 3, text: 'Contenido de prueba '.repeat(12),
    provenance: { kind: 'pdf-page-extractor', pdfPageIndex: 2, sourceFileId: source.fileId, sourceRevision: 'old-rev' },
  }] });
  assert.equal(wrongRevision[0].pageVerified, false);
});

test('chapter headings appearing mid-page do not relabel earlier text', () => {
  const chunks = chunkExtractedPages({
    ownerId: 'owner-a', sourceFileId: source.fileId, sourceRevision: source.revision,
    author: 'P. D. Ouspensky', work: 'Tertium Organum', pages: [{
      pageNumber: 4,
      text: 'Contexto anterior de conciencia '.repeat(6) + '\nChapter 2\n' +
        'Nueva sección sobre el tiempo '.repeat(6) + '\nChapter 3\n' +
        'Tercera sección de la percepción '.repeat(6),
    }],
  });
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].chapter, null);
  assert.equal(chunks[1].chapter, 'Chapter 2');
  assert.equal(chunks[2].chapter, 'Chapter 3');
});

test('authorized lookup fails closed on revoked permission, deleted source and changed revision', () => {
  const ownerId = 'owner-a', requesterId = 'verified-user-a';
  const chunks = chunkExtractedPages({
    ownerId, sourceFileId: source.fileId, sourceRevision: source.revision,
    author: 'P. D. Ouspensky', work: 'Tertium Organum', pages: [{
      pageNumber: 1, text: 'Observador consciente y atención consciente '.repeat(6),
    }],
  });
  const sourceState = {
    ownerId, sourceFileId: source.fileId, currentRevision: source.revision,
    ingestionStatus: 'indexed' as const, rights: 'owner-authorized-private-use' as const,
  };
  const documentState = { ownerId, sourceFileId: source.fileId, sourceRevision: source.revision };
  const permissionState = { ownerId, appUserId: requesterId, scope: 'read-private-library' as const };
  const run = (overrides: Record<string, unknown> = {}) => searchAuthorizedKnowledge({
    query: 'observador', verifiedRequesterId: requesterId, verifiedOwnerId: ownerId,
    sources: [sourceState], documents: [documentState], permissions: [permissionState], chunks,
    ...overrides,
  });
  assert.equal(run().length, 1);
  assert.deepEqual(run({ permissions: [{ ...permissionState, revokedAt: '2026-11-01T00:00:00Z' }] }), []);
  assert.deepEqual(run({ sources: [{ ...sourceState, deletedAt: '2026-11-01T00:00:00Z' }] }), []);
  assert.deepEqual(run({ sources: [{ ...sourceState, rights: 'restricted' }] }), []);
  assert.deepEqual(run({ sources: [{ ...sourceState, currentRevision: 'rev-2' }] }), []);
  assert.deepEqual(run({ verifiedRequesterId: 'unverified-or-another-user' }), []);
  assert.deepEqual(run({ documents: [] }), []);
});

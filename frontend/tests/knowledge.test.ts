import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkExtractedPages } from '../src/lib/knowledge/chunking';
import { isDropboxReadOnlyRequest, sourceEligibility } from '../src/lib/knowledge/policy';
import { buildGroundedContext, searchKnowledge } from '../src/lib/knowledge/retrieval';
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
      { pageNumber: 14, text: 'Chapter 2\nLa observación requiere distinguir entre el observador y lo observado. '.repeat(3) },
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePrivateKnowledgeQuery } from '../src/lib/knowledge/serverAdapter';
import type { KnowledgeServerDependencies, KnowledgeSnapshot } from '../src/lib/knowledge/serverAdapter';
import { chunkExtractedPages } from '../src/lib/knowledge/chunking';

const principal = { issuer: 'https://identity.example/', subject: 'subject-a', sessionId: 'session-a', expiresAt: 10_000 };
const ownerId = 'opaque-owner-a';
const appUserId = 'internal-app-user-a';
const sourceId = 'dropbox-file-a';
const revision = 'rev-1';
const chunks = chunkExtractedPages({
  ownerId, sourceFileId: sourceId, sourceRevision: revision,
  author: 'Author', work: 'Work', pages: [{ pageNumber: 1, text: 'observador y atención consciente '.repeat(8) }],
});
const snapshot: KnowledgeSnapshot = {
  appUserId,
  ownerId,
  permissions: [{ ownerId, appUserId, scope: 'read-private-library' }],
  sources: [{ ownerId, sourceFileId: sourceId, currentRevision: revision, ingestionStatus: 'indexed', rights: 'owner-authorized-private-use' }],
  documents: [{ ownerId, sourceFileId: sourceId, sourceRevision: revision }],
  chunks,
};
const request = (body: unknown, headers: Record<string, string> = {}) => new Request('https://atenea.example/api/private-knowledge', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const dependencies = (overrides: Partial<KnowledgeServerDependencies> = {}): KnowledgeServerDependencies => ({
  authenticate: async () => principal,
  repository: { loadCurrentSnapshot: async () => snapshot },
  now: () => 1_000,
  ...overrides,
});

test('server adapter derives requester only from verifier and returns no-store citation data', async () => {
  let observedSubject = '';
  const deps = dependencies({ authenticate: async () => principal, repository: {
    loadCurrentSnapshot: async (identity) => { observedSubject = identity.subject; return snapshot; },
  } });
  const response = await handlePrivateKnowledgeQuery(request({ query: 'observador', ownerId: 'attacker-selected' }), deps);
  assert.equal(response.status, 200);
  assert.equal(observedSubject, 'subject-a');
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  const result = await response.json();
  assert.equal(result.hits.length, 1);
  assert.equal('ownerId' in result.hits[0], false);
});

test('missing, expired, or unverifiable sessions fail closed without querying repository', async () => {
  let reads = 0;
  const repo = { loadCurrentSnapshot: async () => { reads++; return snapshot; } };
  const missing = await handlePrivateKnowledgeQuery(request({ query: 'observador' }), dependencies({ authenticate: async () => null, repository: repo }));
  const expired = await handlePrivateKnowledgeQuery(request({ query: 'observador' }), dependencies({ authenticate: async () => ({ ...principal, expiresAt: 900 }), repository: repo }));
  assert.equal(missing.status, 401);
  assert.equal(expired.status, 401);
  assert.equal(reads, 0);
});

test('revoked permission, another owner, stale revision, and deleted source return no hits', async () => {
  const variants: KnowledgeSnapshot[] = [
    { ...snapshot, permissions: [{ ...snapshot.permissions[0], revokedAt: 'now' }] },
    { ...snapshot, ownerId: 'owner-b', permissions: [{ ...snapshot.permissions[0], ownerId: 'owner-b' }] },
    { ...snapshot, sources: [{ ...snapshot.sources[0], currentRevision: 'rev-2' }] },
    { ...snapshot, sources: [{ ...snapshot.sources[0], deletedAt: 'now' }] },
  ];
  for (const variant of variants) {
    const response = await handlePrivateKnowledgeQuery(request({ query: 'observador' }), dependencies({ repository: { loadCurrentSnapshot: async () => variant } }));
    assert.deepEqual((await response.json()).hits, []);
  }
});

test('client-supplied identity is ignored and repository failures return unavailable', async () => {
  let subject = '';
  const response = await handlePrivateKnowledgeQuery(request({ query: 'observador', requesterId: 'attacker', ownerId: ownerId }), dependencies({
    repository: { loadCurrentSnapshot: async (identity) => { subject = identity.subject; throw new Error('db unavailable'); } },
  }));
  assert.equal(subject, 'subject-a');
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'temporarily_unavailable' });
});

test('malformed query and non-POST requests are rejected before authentication', async () => {
  let authCalls = 0;
  const deps = dependencies({ authenticate: async () => { authCalls++; return principal; } });
  assert.equal((await handlePrivateKnowledgeQuery(new Request('https://atenea.example/api/private-knowledge'), deps)).status, 405);
  assert.equal((await handlePrivateKnowledgeQuery(request({ query: '   ' }), deps)).status, 400);
  assert.equal(authCalls, 0);
});

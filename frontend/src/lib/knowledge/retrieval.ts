import type {
  KnowledgeChunk, KnowledgeHit, KnowledgeSourceState,
  KnowledgeDocumentState, KnowledgePermissionState,
} from './types';

function terms(value: string) {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[\p{L}\p{N}]{3,}/gu) ?? [];
}

/** Citation-first lexical baseline. Semantic ranking is injected only after an approved embedding provider exists. */
export function searchKnowledge(input: {
  query: string;
  requesterId: string;
  chunks: KnowledgeChunk[];
  semanticScores?: ReadonlyMap<string, number>;
  limit?: number;
}): KnowledgeHit[] {
  const queryTerms = [...new Set(terms(input.query))];
  if (!queryTerms.length || !input.requesterId) return [];
  const limit = Math.max(1, Math.min(input.limit ?? 4, 8));

  return input.chunks
    .filter((chunk) => chunk.ownerId === input.requesterId && chunk.ingestionStatus === 'indexed')
    .map((chunk) => {
      const haystack = terms(`${chunk.author} ${chunk.work} ${chunk.chapter ?? ''} ${chunk.text}`);
      const counts = new Map<string, number>();
      for (const term of haystack) counts.set(term, (counts.get(term) ?? 0) + 1);
      const lexical = queryTerms.reduce((score, term) => score + Math.min(counts.get(term) ?? 0, 3), 0) / queryTerms.length;
      const semantic = Math.max(0, Math.min(1, input.semanticScores?.get(chunk.id) ?? 0));
      return { ...chunk, score: lexical * 0.65 + semantic * 0.35 };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((hit) => ({
      ...hit,
      citation: `${hit.author}, *${hit.work}*${hit.chapter ? `, ${hit.chapter}` : ''}${hit.pageVerified && hit.pageNumber ? `, PDF p. ${hit.pageNumber}` : ' (página no verificada)'}`,
    }));
}

/**
 * Fail-closed application-level filtering. ALL parameters must originate from
 * a trusted server adapter after independently verifying the user's session.
 * This function is NOT authentication; service_role bypasses PostgreSQL RLS.
 * Never expose raw searchKnowledge with client-selected requesterId.
 */
export function searchAuthorizedKnowledge(input: {
  query: string;
  verifiedRequesterId: string;
  verifiedOwnerId: string;
  sources: KnowledgeSourceState[];
  documents: KnowledgeDocumentState[];
  permissions: KnowledgePermissionState[];
  chunks: KnowledgeChunk[];
  semanticScores?: ReadonlyMap<string, number>;
  limit?: number;
}): KnowledgeHit[] {
  const { verifiedOwnerId: owner, verifiedRequesterId: requester } = input;
  if (!owner || !requester) return [];
  if (!input.permissions.some((p) =>
    p.ownerId === owner && p.appUserId === requester &&
    p.scope === 'read-private-library' && !p.revokedAt
  )) return [];

  const allowedSources = new Set(
    input.sources.filter((s) =>
      s.ownerId === owner && s.ingestionStatus === 'indexed' &&
      s.rights === 'owner-authorized-private-use' && !s.deletedAt
    ).map((s) => [s.sourceFileId, s.currentRevision].join('\0'))
  );
  const allowedDocuments = new Set(
    input.documents.filter((d) =>
      d.ownerId === owner && !d.deletedAt &&
      allowedSources.has([d.sourceFileId, d.sourceRevision].join('\0'))
    ).map((d) => [d.sourceFileId, d.sourceRevision].join('\0'))
  );
  const eligible = input.chunks.filter((c) =>
    c.ownerId === owner &&
    allowedDocuments.has([c.sourceFileId, c.sourceRevision].join('\0'))
  );
  return searchKnowledge({
    query: input.query,
    requesterId: owner,
    chunks: eligible,
    semanticScores: input.semanticScores,
    limit: input.limit,
  });
}

export function buildGroundedContext(hits: KnowledgeHit[], maxCharacters = 5_000) {
  const safeLimit = Math.max(0, Math.min(maxCharacters, 8_000));
  let used = 0;
  const selected: Array<Pick<KnowledgeHit, 'citation' | 'text' | 'pageVerified'>> = [];
  for (const hit of hits) {
    const text = hit.text.slice(0, Math.max(0, safeLimit - used));
    if (!text) break;
    selected.push({ citation: hit.citation, text, pageVerified: hit.pageVerified });
    used += text.length;
    if (used >= safeLimit) break;
  }
  return selected;
}

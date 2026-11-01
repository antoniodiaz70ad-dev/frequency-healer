import type { KnowledgeChunk, KnowledgeHit } from './types';

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
      citation: `${hit.author}, *${hit.work}*${hit.chapter ? `, ${hit.chapter}` : ''}${hit.pageVerified && hit.pageNumber ? `, p. ${hit.pageNumber}` : ' (página no verificada)'}`,
    }));
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

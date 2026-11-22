import { createHash } from 'node:crypto';
import type { ExtractedPage, KnowledgeChunk } from './types';

const MAX_CHUNK_CHARS = 1_200;
const MIN_CHUNK_CHARS = 80;

function normalize(text: string) {
  return text.replace(/\u0000/g, '').replace(/[\t\f\v ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

function splitText(text: string, limit: number): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf(' ', limit);
    if (cut < Math.floor(limit * 0.55)) cut = limit;
    const part = rest.slice(0, cut).trim();
    if (part) parts.push(part);
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/**
 * Convert extractor output into small chunks while retaining exact page provenance.
 * Page numbers are only considered verified when the extractor supplies a positive integer.
 */
export function chunkExtractedPages(input: {
  ownerId: string;
  sourceFileId: string;
  sourceRevision: string;
  author: string;
  work: string;
  pages: ExtractedPage[];
  maxChunkChars?: number;
}): KnowledgeChunk[] {
  const limit = Math.max(200, Math.min(input.maxChunkChars ?? MAX_CHUNK_CHARS, MAX_CHUNK_CHARS));
  const contentHash = createHash('sha256').update(input.pages.map((p) => p.text).join('\n\f\n')).digest('hex');
  const chunks: KnowledgeChunk[] = [];
  let chapter: string | null = null;

  for (const page of input.pages) {
    const pageNumber = Number.isSafeInteger(page.pageNumber) && (page.pageNumber ?? 0) > 0 ? page.pageNumber : null;
    const text = normalize(page.text);
    for (const line of text.split('\n')) {
      const heading = line.match(/^(?:chapter|cap[ií]tulo)\s+[^\n]{1,100}$/i);
      if (heading) chapter = line.trim();
    }
    const body = text.replace(/^(?:chapter|cap[ií]tulo)\s+[^\n]{1,100}\n?/i, '').trim();
    if (!body) continue;

    for (const part of splitText(body, limit)) {
      if (part.length < MIN_CHUNK_CHARS && chunks.length > 0) {
        const previous = chunks[chunks.length - 1];
        if (previous.pageNumber === pageNumber && previous.text.length + part.length + 1 <= limit) {
          previous.text = `${previous.text}\n${part}`;
          continue;
        }
      }
      const locator = `${input.sourceFileId}:${pageNumber ?? 'unverified'}:${chunks.length}`;
      chunks.push({
        id: createHash('sha256').update(`${input.ownerId}\0${input.sourceRevision}\0${locator}`).digest('hex'),
        ownerId: input.ownerId,
        sourceFileId: input.sourceFileId,
        sourceRevision: input.sourceRevision,
        contentHash,
        author: input.author,
        work: input.work,
        chapter,
        pageNumber,
        pageVerified: pageNumber !== null,
        text: part,
        ingestionStatus: 'indexed',
      });
    }
  }
  return chunks;
}

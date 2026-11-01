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
    const pageNumber = Number.isSafeInteger(page.pageNumber) && (page.pageNumber ?? 0) > 0
      ? page.pageNumber : null;
    // A page number alone proves nothing. Treat it as verified only when a trusted
    // extractor identifies its physical PDF index and the matching source revision.
    const provenance = page.provenance;
    const pageVerified = Boolean(pageNumber !== null &&
      provenance?.kind === 'pdf-page-extractor' &&
      provenance.pdfPageIndex === pageNumber - 1 &&
      provenance.sourceFileId === input.sourceFileId &&
      provenance.sourceRevision === input.sourceRevision);

    const append = (body: string, currentChapter: string | null) => {
      if (!body.trim()) return;
      for (const part of splitText(body.trim(), limit)) {
        if (part.length < MIN_CHUNK_CHARS && chunks.length > 0) {
          const previous = chunks[chunks.length - 1];
          if (previous.pageNumber === pageNumber && previous.chapter === currentChapter &&
              previous.text.length + part.length + 1 <= limit) {
            previous.text = previous.text + '\n' + part;
            continue;
          }
        }
        const locator = [input.sourceFileId, pageNumber ?? 'unverified', chunks.length].join(':');
        chunks.push({
          id: createHash('sha256').update([input.ownerId, input.sourceRevision, locator].join('\0')).digest('hex'),
          ownerId: input.ownerId,
          sourceFileId: input.sourceFileId,
          sourceRevision: input.sourceRevision,
          contentHash,
          author: input.author,
          work: input.work,
          chapter: currentChapter,
          pageNumber,
          pageVerified,
          text: part,
          ingestionStatus: 'indexed',
        });
      }
    };

    const lines = normalize(page.text).split('\n');
    let section: string[] = [];
    for (const line of lines) {
      const heading = line.trim().match(/^(?:chapter|cap[ií]tulo)\s+\S.{0,99}$/i);
      if (heading) {
        // Flush text BEFORE this heading under the preceding chapter.
        append(section.join('\n'), chapter);
        section = [];
        chapter = line.trim();
      } else {
        section.push(line);
      }
    }
    append(section.join('\n'), chapter);
  }

  return chunks;
}

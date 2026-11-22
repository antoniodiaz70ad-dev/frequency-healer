import type { DropboxPdfSource } from './types';

const PDF_MIME_TYPES = new Set(['application/pdf', 'application/x-pdf']);
const MAX_PDF_BYTES = 100 * 1024 * 1024;

/** Fail closed: inventory is read-only, PDFs only, and rights need explicit owner review. */
export function sourceEligibility(source: DropboxPdfSource): { ok: true } | { ok: false; reason: string } {
  if (source.deleted) return { ok: false, reason: 'deleted' };
  if (!source.fileId || !source.revision || !source.path.startsWith('/Mis plataformas/')) return { ok: false, reason: 'outside-library' };
  if (!source.name.toLowerCase().endsWith('.pdf') || !PDF_MIME_TYPES.has(source.mimeType.toLowerCase())) return { ok: false, reason: 'unsupported-file' };
  if (!Number.isSafeInteger(source.sizeBytes) || source.sizeBytes <= 0 || source.sizeBytes > MAX_PDF_BYTES) return { ok: false, reason: 'size-limit' };
  if (source.rights !== 'owner-authorized-private-use') return { ok: false, reason: 'rights-not-reviewed' };
  return { ok: true };
}

export function isDropboxReadOnlyRequest(method: string) {
  return method === 'GET' || method === 'HEAD';
}

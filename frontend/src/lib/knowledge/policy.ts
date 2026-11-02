import type { DropboxPdfSource } from './types';

const PDF_MIME_TYPES = new Set(['application/pdf', 'application/x-pdf']);
const MAX_PDF_BYTES = 100 * 1024 * 1024;

/** Dropbox App Folder paths are rooted at `/`; require one canonical, relative file path. */
export function isCanonicalDropboxAppFolderPath(path: string): boolean {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path !== path.normalize('NFC')) return false;
  const segments = path.slice(1).split('/');
  if (segments.length === 0 || segments.some((segment) => !segment || segment === '.' || segment === '..')) return false;
  if (/[\u0000-\u001f\u007f]/u.test(path)) return false;
  return path.toLowerCase().endsWith('.pdf');
}

/** Fail closed: inventory is read-only, PDFs only, and rights need explicit owner review. */
export function sourceEligibility(source: DropboxPdfSource): { ok: true } | { ok: false; reason: string } {
  if (source.deleted) return { ok: false, reason: 'deleted' };
  if (!source.fileId || !source.revision || !isCanonicalDropboxAppFolderPath(source.path)) return { ok: false, reason: 'outside-library' };
  if (!source.name.toLowerCase().endsWith('.pdf') || !PDF_MIME_TYPES.has(source.mimeType.toLowerCase())) return { ok: false, reason: 'unsupported-file' };
  if (!Number.isSafeInteger(source.sizeBytes) || source.sizeBytes <= 0 || source.sizeBytes > MAX_PDF_BYTES) return { ok: false, reason: 'size-limit' };
  if (source.rights !== 'owner-authorized-private-use') return { ok: false, reason: 'rights-not-reviewed' };
  return { ok: true };
}

export function isDropboxReadOnlyRequest(method: string) {
  return method === 'GET' || method === 'HEAD';
}

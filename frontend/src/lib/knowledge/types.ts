/** Private, source-aware records for the ATENEA knowledge library. */
export type KnowledgeSourceRights = 'pending' | 'owner-authorized-private-use' | 'restricted';
export type KnowledgeIngestionStatus = 'discovered' | 'blocked-rights' | 'indexed' | 'changed' | 'deleted' | 'failed';

export interface DropboxPdfSource {
  fileId: string;
  path: string;
  revision: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  rights: KnowledgeSourceRights;
  deleted?: boolean;
}

/** Evidence must be supplied by a trusted PDF extractor over this exact file revision. */
export interface PdfPageProvenance {
  kind: 'pdf-page-extractor';
  sourceFileId: string;
  sourceRevision: string;
  /** Zero-based physical page index in the PDF; not the printed page label. */
  pdfPageIndex: number;
}

export interface ExtractedPage {
  /** Physical 1-based PDF page. A bare positive number is not verified evidence. */
  pageNumber: number | null;
  text: string;
  provenance?: PdfPageProvenance;
}

/** Trusted server-loaded status; never hydrate these from a browser request. */
export interface KnowledgeSourceState {
  ownerId: string;
  sourceFileId: string;
  currentRevision: string;
  ingestionStatus: KnowledgeIngestionStatus;
  rights: KnowledgeSourceRights;
  deletedAt?: string | null;
}
export interface KnowledgeDocumentState {
  ownerId: string;
  sourceFileId: string;
  sourceRevision: string;
  deletedAt?: string | null;
}
export interface KnowledgePermissionState {
  ownerId: string;
  appUserId: string;
  scope: 'read-private-library';
  revokedAt?: string | null;
}

export interface KnowledgeChunk {
  id: string;
  ownerId: string;
  sourceFileId: string;
  sourceRevision: string;
  contentHash: string;
  author: string;
  work: string;
  chapter: string | null;
  pageNumber: number | null;
  pageVerified: boolean;
  text: string;
  ingestionStatus: 'indexed';
}

export interface KnowledgeHit extends KnowledgeChunk {
  score: number;
  citation: string;
}

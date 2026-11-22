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

export interface ExtractedPage {
  pageNumber: number | null;
  text: string;
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

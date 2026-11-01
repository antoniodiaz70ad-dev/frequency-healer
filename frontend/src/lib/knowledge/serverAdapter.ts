import { searchAuthorizedKnowledge } from './retrieval';
import type {
  KnowledgeChunk,
  KnowledgeDocumentState,
  KnowledgePermissionState,
  KnowledgeSourceState,
} from './types';

/** Identity returned only by a server-side session verifier (never parsed from JSON). */
export interface VerifiedKnowledgePrincipal {
  issuer: string;
  subject: string;
  sessionId: string;
  expiresAt: number;
}

export interface KnowledgeSnapshot {
  /** Internal application account ID resolved from the verified issuer+subject. */
  appUserId: string;
  ownerId: string;
  permissions: KnowledgePermissionState[];
  sources: KnowledgeSourceState[];
  documents: KnowledgeDocumentState[];
  chunks: KnowledgeChunk[];
}

/**
 * Implementations must resolve the principal-to-owner mapping and read current
 * permissions, sources, documents, and chunks in one consistent DB transaction.
 * A Supabase service_role implementation must enforce these filters itself:
 * service_role has BYPASSRLS, so PostgreSQL RLS is not the authorization layer.
 */
export interface PrivateKnowledgeRepository {
  loadCurrentSnapshot(principal: VerifiedKnowledgePrincipal): Promise<KnowledgeSnapshot | null>;
}

export interface KnowledgeServerDependencies {
  authenticate(request: Request): Promise<VerifiedKnowledgePrincipal | null>;
  repository: PrivateKnowledgeRepository;
  now?: () => number;
}

/**
 * Server-only use case. It accepts a query, never an owner/user ID. It returns
 * generic denial responses and cannot be used until a real verifier and
 * transactionally consistent repository are supplied by the application.
 */
export async function handlePrivateKnowledgeQuery(
  request: Request,
  dependencies: KnowledgeServerDependencies,
): Promise<Response> {
  const json = (body: unknown, status: number) => Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization' },
  });

  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: 'unsupported_media_type' }, 415);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }
  if (!payload || typeof payload !== 'object' ||
      typeof (payload as { query?: unknown }).query !== 'string') {
    return json({ error: 'invalid_request' }, 400);
  }
  const query = (payload as { query: string }).query.trim();
  if (!query || query.length > 500) return json({ error: 'invalid_request' }, 400);

  try {
    const principal = await dependencies.authenticate(request);
    const now = dependencies.now?.() ?? Date.now();
    if (!principal || !principal.issuer || !principal.subject || !principal.sessionId ||
        !Number.isFinite(principal.expiresAt) || principal.expiresAt <= now) {
      return json({ error: 'unauthorized' }, 401);
    }

    const snapshot = await dependencies.repository.loadCurrentSnapshot(principal);
    if (!snapshot || !snapshot.appUserId || !snapshot.ownerId) return json({ error: 'forbidden' }, 403);

    const hits = searchAuthorizedKnowledge({
      query,
      verifiedRequesterId: snapshot.appUserId,
      verifiedOwnerId: snapshot.ownerId,
      permissions: snapshot.permissions,
      sources: snapshot.sources,
      documents: snapshot.documents,
      chunks: snapshot.chunks,
    });

    // Do not return private IDs, scores, owner identifiers, or extracted metadata.
    return json({
      hits: hits.map(({ citation, text, pageVerified }) => ({ citation, text, pageVerified })),
    }, 200);
  } catch {
    // Repository/auth failures never degrade to an unfiltered search.
    return json({ error: 'temporarily_unavailable' }, 503);
  }
}

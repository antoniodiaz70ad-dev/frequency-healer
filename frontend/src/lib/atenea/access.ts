/** Production bindings must authenticate server-side and reserve persistent quotas atomically.
 * An in-memory counter is intentionally not supplied for billable sessions. */
export interface AccessBindings {
  authenticate(request: Request): Promise<string | null>;
  reserve(input: { userId: string; kind: 'voice' | 'standard' | 'pro'; maxSeconds: number; signal: AbortSignal }): Promise<boolean>;
}
export async function authorize(request: Request, enabled: boolean, bindings?: AccessBindings, canonicalOrigin = new URL(request.url).origin) {
  if (!enabled) return 404;
  if (!request.headers.get('origin') || request.headers.get('sec-fetch-site') === 'cross-site') return 403;
  if (!canonicalOrigin) return 503;
  if (request.headers.get('origin') !== canonicalOrigin) return 403;
  if (!bindings) return 503;
  const userId = await bindings.authenticate(request);
  return userId ? 200 : 401;
}

/** Never use names suggested by a draft spec without provider documentation verification. */
export const providerRequirements = {
  voiceCandidate: 'gpt-live-1', analysisCandidate: 'gpt-6-astra',
  verified: false, realApiEnabled: false,
} as const;

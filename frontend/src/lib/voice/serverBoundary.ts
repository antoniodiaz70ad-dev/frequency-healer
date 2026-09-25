/** Small pure HTTP boundary helpers, independently testable without credentials. */
export function isSameOrigin(request: Request) {
  try {
    const origin = new URL(request.headers.get('origin') ?? '');
    const host = request.headers.get('host') ?? new URL(request.url).host;
    return origin.host === host && (origin.protocol === 'https:' || (origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname)));
  } catch { return false; }
}
export async function readBounded(stream: ReadableStream<Uint8Array> | null, limit: number) {
  if (!stream) throw new Error('Missing body');
  const reader = stream.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > limit) { await reader.cancel(); throw new Error('Body too large'); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const buffer = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; } return buffer;
}

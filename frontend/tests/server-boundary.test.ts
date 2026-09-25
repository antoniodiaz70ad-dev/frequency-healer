import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSameOrigin, readBounded } from '../src/lib/voice/serverBoundary';
test('origin uses routed Host behind Next proxy and rejects unrelated/missing/unsafe origins', () => {
  const request = (origin: string, host = '127.0.0.1:4319') => new Request('http://localhost:4319/api/voice/transcribe', { headers: { Origin: origin, Host: host } });
  assert.equal(isSameOrigin(request('http://127.0.0.1:4319')), true);
  assert.equal(isSameOrigin(request('https://example.com', 'example.com')), true);
  assert.equal(isSameOrigin(request('http://example.com', 'example.com')), false);
  assert.equal(isSameOrigin(request('https://evil.example')), false);
  assert.equal(isSameOrigin(request('null')), false); assert.equal(isSameOrigin(request('')), false);
});
test('streaming body limits enforce byte ceiling even without Content-Length', async () => {
  const stream = (size: number) => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(size)); c.close(); } });
  assert.equal((await readBounded(stream(10), 10)).byteLength, 10);
  await assert.rejects(readBounded(stream(11), 10), /large/); await assert.rejects(readBounded(null, 10), /Missing/);
});

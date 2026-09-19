import assert from 'node:assert/strict';

const origin = process.argv[2] ?? 'http://127.0.0.1:4322';
const enabled = process.argv[3] === 'enabled';
const response = await fetch(origin + '/landing');
assert.equal(response.status, 200);
const html = await response.text();
assert.equal((html.match(/<h1\b/g) ?? []).length, 1, 'one primary heading');
assert.equal((html.match(/<main\b/g) ?? []).length, 1, 'one main landmark');
assert.ok(!html.includes('<aside'), 'landing has no application sidebar');
assert.ok(html.includes('lang="en"'), 'English content declares its language');
assert.equal(html.includes('href="/laboratorio-armonico"'), enabled, 'lab CTA respects the flag');
assert.ok(html.includes('href="/"'), 'dashboard entry remains available');
for (const id of ['method', 'relationships', 'process', 'hero-title', 'map-title', 'closing-title']) {
  assert.ok(html.includes(`id="${id}"`), `section ${id}`);
}
const video = html.match(/<video\b[^>]*>/)?.[0];
assert.ok(video, 'hero video is rendered');
assert.ok(!/\ssrc=/.test(video), 'video source waits for the client motion preference');
assert.ok(video.includes('poster="/landing/harmonic-poster.webp"'), 'static fallback in initial HTML');
assert.ok(video.includes('preload="none"'), 'video does not compete with initial document');
assert.ok(html.includes('Planned exploration'), 'future tools are distinguished');
for (const [file, mime] of [['harmonic-hero.mp4', 'video/mp4'], ['harmonic-hero-mobile.mp4', 'video/mp4'], ['harmonic-poster.webp', 'image/webp']]) {
  const asset = await fetch(`${origin}/landing/${file}`, { headers: { Range: 'bytes=0-1023' } });
  assert.equal(asset.status, 206, `${file} range delivery`);
  assert.ok(asset.headers.get('content-type')?.startsWith(mime), file);
  assert.equal((await asset.arrayBuffer()).byteLength, 1024, file);
}
const dashboard = await fetch(origin + '/');
assert.equal(dashboard.status, 200);
assert.ok((await dashboard.text()).includes('<aside'), 'existing dashboard sidebar preserved');
console.log(`PASS landing, fallback, gated CTA, media ranges and dashboard frame (${enabled ? 'ON' : 'OFF'})`);

import assert from 'node:assert/strict';
const origin = process.argv[2] ?? 'http://127.0.0.1:4319';
const enabled = process.argv[3] === 'enabled';
for (const path of ['/', '/generador', '/protocolos', '/biblioteca', '/sesion-nueva', '/diario']) {
  const response = await fetch(origin + path);
  assert.equal(response.status, 200, path);
  const body = await response.text();
  if (path === '/') { assert.equal(body.includes('href="/voz"'), enabled, 'voice navigation flag'); assert.equal(body.includes('href="/laboratorio-armonico"'), enabled, 'lab navigation flag'); }
  if (path === '/') { assert.equal(body.includes('Comenzar sesión guiada'), enabled); assert.ok(body.includes('Abrir generador manual')); assert.ok(body.includes('Navegación principal')); }
  console.log(`PASS ${path} 200`);
}
for (const path of ['/voz', '/laboratorio-armonico']) {
  const response = await fetch(origin + path); assert.equal(response.status, enabled ? 200 : 404, path); console.log(`PASS ${path} ${response.status}`);
}
for (const path of ['/api/voice/interpret', '/api/voice/transcribe']) {
  const rejected = await fetch(origin + path, { method: 'POST', headers: { Origin: 'https://unrelated.example' }, body: '{}' });
  assert.equal(rejected.status, enabled ? 403 : 404, 'cross origin');
  const unconfigured = await fetch(origin + path, { method: 'POST', headers: { Origin: origin }, body: '{}' });
  assert.equal(unconfigured.status, enabled ? 503 : 404, 'unconfigured provider'); console.log(`PASS ${path} guarded / no credentials fallback`);
}

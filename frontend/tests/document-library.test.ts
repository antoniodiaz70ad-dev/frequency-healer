import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DOCUMENT_LIBRARY_KEY, DOCUMENT_LIMIT_BYTES, prepareDocument, addLibraryDocument, readDocumentLibrary,
  updateLibraryDocument, restoreDocumentLibrary, parseDocumentLibrary, documentSections,
  documentSourceLinks, libraryDocumentLinks, validateDocumentText,
} from '../src/lib/documentLibrary';
function memory(initial: string | null = null) {
  let raw = initial; return { getItem(key: string) { assert.equal(key, DOCUMENT_LIBRARY_KEY); return raw; }, setItem(key: string, value: string) { assert.equal(key, DOCUMENT_LIBRARY_KEY); raw = value; } };
}
const text = '# Cristales y frecuencias\r\n\r\n## Resonancia\r\nCuarzo e intención.\r\n\r\n## Cimática\r\nPropuesta propia; 220 Hz, 12 minutos.\r\n';
test('original text round-trips exactly; duplicate content keeps notes and favorite', async () => {
  const store = memory(), d = await prepareDocument('fuente.md', text);
  assert.equal(d.title, 'Cristales y frecuencias'); addLibraryDocument(store, d);
  updateLibraryDocument(store, d.id, { notes: 'Mi lectura', favorite: true });
  const duplicate = addLibraryDocument(store, await prepareDocument('otra-copia.txt', text));
  assert.equal(duplicate.duplicate, true); assert.equal(duplicate.document.notes, 'Mi lectura');
  assert.equal(duplicate.document.favorite, true); assert.equal(duplicate.document.fileName, 'fuente.md');
  assert.equal(readDocumentLibrary(store).documents[0].content, text);
  addLibraryDocument(store, await prepareDocument('fuente.md', text + '\nNueva versión.'));
  assert.equal(readDocumentLibrary(store).documents.length, 2);
});
test('backup merge preserves local annotations, verifies digest and rejects damage atomically', async () => {
  const a = memory(), b = memory(); const d = await prepareDocument('uno.md', text);
  addLibraryDocument(a, d); updateLibraryDocument(a, d.id, { notes: 'Local', favorite: true });
  addLibraryDocument(b, d); addLibraryDocument(b, await prepareDocument('dos.txt', 'Otro documento'));
  await restoreDocumentLibrary(a, b.getItem(DOCUMENT_LIBRARY_KEY)!);
  assert.equal(readDocumentLibrary(a).documents.length, 2); assert.equal(readDocumentLibrary(a).documents[0].notes, 'Local');
  const before = a.getItem(DOCUMENT_LIBRARY_KEY), damaged = readDocumentLibrary(b); damaged.documents[0].content += ' alterado';
  await assert.rejects(restoreDocumentLibrary(a, JSON.stringify(damaged)), /alterado/);
  assert.equal(a.getItem(DOCUMENT_LIBRARY_KEY), before);
  await assert.rejects(restoreDocumentLibrary(a, b.getItem(DOCUMENT_LIBRARY_KEY)!, () => false), /cancel/);
  assert.equal(a.getItem(DOCUMENT_LIBRARY_KEY), before);
});
test('invalid formats, empty/binary/oversized content and corrupt existing storage are preserved', async () => {
  for (const name of ['archivo.pdf', '../archivo.md', 'x.html', 'a\\b.txt']) assert.throws(() => validateDocumentText(name, text));
  for (const value of ['', '  ', 'a\0b', 'ñ'.repeat(DOCUMENT_LIMIT_BYTES)]) assert.throws(() => validateDocumentText('archivo.md', value));
  for (const value of ['{}', '{', '{"schemaVersion":2,"documents":[]}']) {
    const store = memory(value), document = await prepareDocument('x.md', text); assert.throws(() => addLibraryDocument(store, document));
    assert.equal(store.getItem(DOCUMENT_LIBRARY_KEY), value);
  }
  assert.throws(() => parseDocumentLibrary(JSON.stringify({ schemaVersion: 1, documents: [null] })));
});
test('quota errors do not report a successful save and leave the original untouched', async () => {
  const base = memory(), d = await prepareDocument('x.md', text); addLibraryDocument(base, d);
  const before = base.getItem(DOCUMENT_LIBRARY_KEY);
  const full = { getItem: base.getItem, setItem: () => { throw new Error('QuotaExceededError'); } };
  assert.throws(() => updateLibraryDocument(full, d.id, { favorite: true }), /QuotaExceeded/);
  assert.equal(base.getItem(DOCUMENT_LIBRARY_KEY), before);
});
test('sections preserve provenance lines and links open tools without inventing or applying a recipe', async () => {
  const d = await prepareDocument('x.md', text);
  assert.deepEqual(documentSections(text).map(s => [s.title, s.line]), [['Resonancia', 3], ['Cimática', 6]]);
  assert.ok(documentSections(text)[1].text.includes('220 Hz, 12 minutos'));
  assert.deepEqual(libraryDocumentLinks(d).map(l => l.href), ['/preparacion-cristales', '/laboratorio-cimatico', '/marina-punto-cero/compositor']);
  assert.deepEqual(documentSourceLinks('[Fuente](https://www.nist.gov/test) javascript:alert(1) https://usuario:clave@example.com'), ['https://www.nist.gov/test']);
});

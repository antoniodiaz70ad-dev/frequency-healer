/** Private browser documents. Never bundled into the public frequency catalogue. */
export const DOCUMENT_LIBRARY_KEY = 'fh.library.documents.v1';
export const DOCUMENT_LIMIT_BYTES = 512 * 1024;
const LIBRARY_LIMIT_BYTES = 2 * 1024 * 1024;
export type LibraryDocument = {
  id: string; fileName: string; title: string; content: string; importedAt: string;
  favorite: boolean; lastOpenedAt: string | null; notes: string;
};
export type DocumentLibrary = { schemaVersion: 1; documents: LibraryDocument[] };
export type DocumentStore = Pick<Storage, 'getItem' | 'setItem'>;
export type DocumentSection = { title: string; text: string; line: number };
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;
const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
export const searchText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function validateDocumentText(fileName: string, content: string) {
  if (!/^[^/\\\u0000-\u001f]{1,180}\.(md|txt)$/i.test(fileName)) throw new Error('Elige un archivo MD o TXT con un nombre válido.');
  if (typeof content !== 'string' || !content.trim() || content.includes('\0') || bytes(content) > DOCUMENT_LIMIT_BYTES) throw new Error('El documento debe contener texto y ocupar como máximo 512 KB.');
}
export async function documentId(content: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}
export function documentSections(content: string): DocumentSection[] {
  const sections: DocumentSection[] = []; let current: DocumentSection = { title: 'Introducción', text: '', line: 1 };
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    const heading = line.match(/^#{1,3}\s+(.+?)\s*#*$/);
    if (heading) {
      if (current.text.trim()) sections.push(current);
      current = { title: heading[1].slice(0, 240), text: '', line: index + 1 };
    } else current.text += line + '\n';
  }
  if (current.text.trim()) sections.push(current);
  return sections;
}
export async function prepareDocument(fileName: string, content: string, now = new Date().toISOString()): Promise<LibraryDocument> {
  validateDocumentText(fileName, content);
  if (!validDate(now)) throw new Error('Fecha de importación inválida.');
  const title = content.split(/\r?\n/).find(line => /^#\s+/.test(line))?.replace(/^#\s+/, '').trim() || fileName.replace(/\.(md|txt)$/i, '').replace(/_/g, ' ');
  return { id: await documentId(content), fileName, title: title.slice(0, 240), content, importedAt: now, favorite: false, lastOpenedAt: null, notes: '' };
}
export function parseDocumentLibrary(raw: string | null): DocumentLibrary {
  if (raw === null) return { schemaVersion: 1, documents: [] };
  try {
    if (bytes(raw) > LIBRARY_LIMIT_BYTES) throw new Error();
    const book = JSON.parse(raw) as DocumentLibrary;
    if (book.schemaVersion !== 1 || !Array.isArray(book.documents) || book.documents.length > 40) throw new Error();
    const ids = new Set<string>();
    for (const d of book.documents) {
      if (!d || typeof d.id !== 'string' || !/^[a-f0-9]{64}$/.test(d.id) || ids.has(d.id) || typeof d.fileName !== 'string' || typeof d.title !== 'string' || !d.title.trim() || d.title.length > 240 || typeof d.favorite !== 'boolean' || !validDate(d.importedAt) || !(d.lastOpenedAt === null || validDate(d.lastOpenedAt)) || typeof d.notes !== 'string' || d.notes.length > 12000) throw new Error();
      validateDocumentText(d.fileName, d.content); ids.add(d.id);
    }
    return book;
  } catch { throw new Error('No se pudo leer la biblioteca. Se conserva el original; descarga un respaldo antes de continuar.'); }
}
export const readDocumentLibrary = (store: DocumentStore) => parseDocumentLibrary(store.getItem(DOCUMENT_LIBRARY_KEY));
function write(store: DocumentStore, book: DocumentLibrary) {
  const raw = JSON.stringify(book); parseDocumentLibrary(raw);
  store.setItem(DOCUMENT_LIBRARY_KEY, raw); return book;
}
export function addLibraryDocument(store: DocumentStore, document: LibraryDocument) {
  const book = readDocumentLibrary(store), existing = book.documents.find(d => d.id === document.id);
  if (existing) {
    if (existing.content !== document.content) throw new Error('El identificador coincide con otro contenido; no se cambió la biblioteca.');
    return { book, duplicate: true, document: existing };
  }
  const next = write(store, { ...book, documents: [...book.documents, document] });
  return { book: next, duplicate: false, document };
}
export function updateLibraryDocument(store: DocumentStore, id: string, patch: Partial<Pick<LibraryDocument, 'favorite' | 'lastOpenedAt' | 'notes'>>) {
  const book = readDocumentLibrary(store);
  if (!book.documents.some(d => d.id === id)) throw new Error('El documento ya no está disponible.');
  return write(store, { ...book, documents: book.documents.map(d => d.id === id ? { ...d, ...patch } : d) });
}
export async function restoreDocumentLibrary(store: DocumentStore, raw: string, isCurrent = () => true) {
  const incoming = parseDocumentLibrary(raw);
  for (const d of incoming.documents) if (await documentId(d.content) !== d.id) throw new Error('El respaldo contiene un documento alterado. No se cambió la biblioteca.');
  if (!isCurrent()) throw new Error('La restauración se canceló. No se cambió la biblioteca.');
  const current = readDocumentLibrary(store);
  const documents = new Map(current.documents.map(d => [d.id, d]));
  for (const d of incoming.documents) {
    const local = documents.get(d.id);
    if (local && local.content !== d.content) throw new Error('Hay documentos incompatibles con el mismo identificador.');
    if (!local) documents.set(d.id, d); // Local notes and preferences always survive a merge.
  }
  return write(store, { schemaVersion: 1, documents: [...documents.values()] });
}
export function libraryDocumentLinks(document: LibraryDocument): { label: string; href: string }[] {
  const text = searchText(document.title + '\n' + document.content);
  const links: { label: string; href: string }[] = [];
  if (/cristal|cuarzo|vogel/.test(text)) links.push({ label: 'Abrir preparación de cristales', href: '/preparacion-cristales' });
  if (/cimat|chladni|membrana/.test(text)) links.push({ label: 'Explorar en laboratorio cimático', href: '/laboratorio-cimatico' });
  if (/frecuenc|compositor|tono|binaural/.test(text)) links.push({ label: 'Abrir compositor', href: '/marina-punto-cero/compositor' });
  return links;
}
export function documentSourceLinks(content: string): string[] {
  return [...new Set(content.match(/https?:\/\/[^\s<>"\])]+/g) ?? [])].filter(url => {
    try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password; } catch { return false; }
  }).slice(0, 30);
}

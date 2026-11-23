'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FHSurface } from '@/components/ui/FHLayout';
import {
  DOCUMENT_LIBRARY_KEY, DOCUMENT_LIMIT_BYTES, addLibraryDocument, documentSections,
  documentSourceLinks, libraryDocumentLinks, prepareDocument, readDocumentLibrary,
  restoreDocumentLibrary, searchText, updateLibraryDocument,
  type DocumentLibrary as Library, type LibraryDocument,
} from '@/lib/documentLibrary';
import styles from './documents.module.css';

function download(text: string, name: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function DocumentLibrary() {
  const [book, setBook] = useState<Library>({ schemaVersion: 1, documents: [] });
  const [ready, setReady] = useState(false), [blocked, setBlocked] = useState(false), [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false), [name, setName] = useState('documento.md'), [text, setText] = useState('');
  const [preview, setPreview] = useState<LibraryDocument | null>(null), [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState(''), [favorites, setFavorites] = useState(false), [notes, setNotes] = useState(''), [message, setMessage] = useState('');
  const operation = useRef(0);
  const current = book.documents.find(d => d.id === selected);
  useEffect(() => {
    const load = () => { try { setBook(readDocumentLibrary(localStorage)); setBlocked(false); } catch (e) { setBlocked(true); setMessage((e as Error).message); } setReady(true); };
    const timer = setTimeout(load, 0);
    const storage = (e: StorageEvent) => { if (e.key === DOCUMENT_LIBRARY_KEY) load(); };
    window.addEventListener('storage', storage);
    return () => { clearTimeout(timer); window.removeEventListener('storage', storage); operation.current++; };
  }, []);
  function open(document: LibraryDocument) {
    try {
      setBook(updateLibraryDocument(localStorage, document.id, { lastOpenedAt: new Date().toISOString() }));
      setSelected(document.id); setNotes(document.notes); setMessage('');
    } catch (e) { setMessage((e as Error).message); }
  }
  function changeDraft(fileName: string, value: string) { operation.current++; setBusy(false); setName(fileName); setText(value); setPreview(null); }
  async function previewText(fileName = name, value = text) {
    const ticket = ++operation.current; setBusy(true); setMessage(''); setPreview(null);
    try { const row = await prepareDocument(fileName, value); if (ticket === operation.current) setPreview(row); }
    catch (e) { if (ticket === operation.current) setMessage((e as Error).message); }
    finally { if (ticket === operation.current) setBusy(false); }
  }
  async function loadFile(file: File) {
    const ticket = ++operation.current; setBusy(true); setPreview(null); setMessage('');
    try {
      if (file.size > DOCUMENT_LIMIT_BYTES) throw new Error('El documento supera 512 KB.');
      const value = await file.text(); if (ticket !== operation.current) return;
      setName(file.name); setText(value);
      const row = await prepareDocument(file.name, value); if (ticket === operation.current) setPreview(row);
    } catch (e) { if (ticket === operation.current) setMessage((e as Error).message); }
    finally { if (ticket === operation.current) setBusy(false); }
  }
  function savePreview() {
    if (!preview) return;
    try {
      const result = addLibraryDocument(localStorage, { ...preview, lastOpenedAt: new Date().toISOString() });
      setBook(result.book); setSelected(result.document.id); setNotes(result.document.notes);
      setImporting(false); setPreview(null); setText('');
      setMessage(result.duplicate ? 'Este contenido ya estaba importado. Abrimos el original y conservamos tus notas.' : 'Documento importado y guardado en este navegador.');
    } catch (e) { setMessage((e as Error).message + ' El texto sigue disponible para descargar.'); }
  }
  const matching = book.documents.filter(d => (!favorites || d.favorite) && searchText(d.title + ' ' + d.content + ' ' + d.notes).includes(searchText(query)))
    .sort((a, b) => (b.lastOpenedAt ?? b.importedAt).localeCompare(a.lastOpenedAt ?? a.importedAt));
  const sections = current ? documentSections(current.content) : [];
  return <section className={styles.root} aria-label="Mis documentos">
    <FHSurface>
      <div className={styles.toolbar}><div><h2>Mis documentos</h2><p>Importa MD o TXT, lee por secciones y abre la herramienta que necesites.</p></div>
        <button disabled={!ready || blocked || busy} onClick={() => { setImporting(true); setSelected(null); }}>Importar documento</button></div>
      <p className={styles.hint}>Guardado en este navegador. El respaldo permite transferir documentos a otro dispositivo; esta sección todavía no se sincroniza con una cuenta.</p>
      {message && <p role="status">{message}</p>}
      {blocked && <button onClick={() => download(localStorage.getItem(DOCUMENT_LIBRARY_KEY) ?? '', 'biblioteca-recuperacion.json', 'application/json')}>Descargar biblioteca para recuperar</button>}
      <div className={styles.toolbar}><label>Buscar en mis documentos<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cristales, NIST, intención, 256…" /></label>
        <label className={styles.check}><input type="checkbox" checked={favorites} onChange={e => setFavorites(e.target.checked)} />Solo favoritos</label>
        <button disabled={!ready || blocked} onClick={() => download(JSON.stringify(book, null, 2), 'resonance-lab-documentos.json', 'application/json')}>Exportar documentos</button>
        <label className={styles.file}>Restaurar respaldo<input type="file" accept="application/json,.json" disabled={!ready || blocked || busy} onChange={async e => {
          const file = e.currentTarget.files?.[0]; if (!file) return; e.currentTarget.value = ''; const ticket = ++operation.current; setBusy(true);
          try { if (file.size > 2 * 1024 * 1024) throw new Error('El respaldo supera 2 MB.'); const raw = await file.text(); if (ticket !== operation.current) return; const next = await restoreDocumentLibrary(localStorage, raw, () => ticket === operation.current); if (ticket === operation.current) { setBook(next); setMessage('Respaldo integrado. Se conservaron los documentos y notas existentes.'); } }
          catch (error) { if (ticket === operation.current) setMessage((error as Error).message); }
          finally { if (ticket === operation.current) setBusy(false); }
        }} /></label></div>
    </FHSurface>
    {importing && <FHSurface><h3>Importar documento</h3><p>El original se conserva completo. Revisa la vista previa antes de guardarlo.</p>
      <label className={styles.file}>Seleccionar archivo MD o TXT<input type="file" accept=".md,.txt,text/plain,text/markdown" disabled={busy} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (file) void loadFile(file); }} /></label>
      <details><summary>O pegar el contenido</summary>
        <label>Nombre del archivo<input value={name} maxLength={184} onChange={e => changeDraft(e.target.value, text)} /></label>
        <label>Contenido del documento<textarea rows={8} value={text} onChange={e => changeDraft(name, e.target.value)} /></label>
        <button disabled={busy || !text.trim()} onClick={() => void previewText()}>Revisar importación</button>
      </details>
      {busy && <p role="status">Preparando documento…</p>}
      {preview && <div className={styles.preview}><h3>Vista previa: {preview.title}</h3><p>{preview.fileName} · {documentSections(preview.content).length} secciones</p>
        <p>{preview.content.slice(0, 380)}{preview.content.length > 380 ? '…' : ''}</p>
        {book.documents.some(d => d.id === preview.id) ? <p>Este contenido ya existe. Se abrirá sin duplicarlo.</p> : book.documents.some(d => d.fileName === preview.fileName) && <p>Existe otro contenido con este nombre. Guardaremos una versión adicional y conservaremos la anterior.</p>}
        <button disabled={busy || blocked} onClick={savePreview}>Guardar documento en mi biblioteca</button></div>}
      <div className={styles.toolbar}>{text && <button onClick={() => download(text, /\.(md|txt)$/i.test(name) ? name : 'documento.txt')}>Descargar texto original</button>}
        <button onClick={() => { operation.current++; setBusy(false); setImporting(false); setPreview(null); }}>Cerrar importación</button></div>
    </FHSurface>}
    {!current && <FHSurface><h3>{favorites ? 'Favoritos' : 'Recientes'} · {matching.length}</h3>
      {ready && matching.length === 0 && <p>{query || favorites ? 'No hay documentos que coincidan.' : 'Importa tu primer documento para comenzar.'}</p>}
      <ul className={styles.list}>{matching.map(d => <li key={d.id}><button className={styles.document} onClick={() => open(d)}><strong>{d.favorite ? '★ ' : ''}{d.title}</strong><span>{d.fileName} · {new Date(d.importedAt).toLocaleDateString('es-MX')}</span></button></li>)}</ul>
    </FHSurface>}
    {current && <FHSurface><div className={styles.toolbar}><button onClick={() => setSelected(null)}>Volver a mis documentos</button>
      <button aria-pressed={current.favorite} onClick={() => { try { setBook(updateLibraryDocument(localStorage, current.id, { favorite: !current.favorite })); } catch (e) { setMessage((e as Error).message); } }}>{current.favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}</button>
      <button onClick={() => download(current.content, current.fileName)}>Descargar original</button></div>
      <h2>{current.title}</h2><p className={styles.hint}>{current.fileName} · Original conservado · {sections.length} secciones</p>
      <div className={styles.toolbar}>{libraryDocumentLinks(current).map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</div>
      <p className={styles.hint}>Estos accesos abren las herramientas. El documento no cambia tus recetas ni comienza audio automáticamente.</p>
      <div className={styles.sections}>{sections.map((section, index) => <details key={section.line} open={index === 0}><summary>{section.title}</summary><p className={styles.original}>{section.text}</p></details>)}</div>
      {documentSourceLinks(current.content).length > 0 && <details><summary>Fuentes enlazadas en el documento</summary><ul className={styles.sources}>{documentSourceLinks(current.content).map(url => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></li>)}</ul></details>}
      <label>Mis notas sobre este documento<textarea rows={4} value={notes} maxLength={12000} onChange={e => setNotes(e.target.value)} /></label>
      <button onClick={() => { try { setBook(updateLibraryDocument(localStorage, current.id, { notes })); setMessage('Notas guardadas en este navegador.'); } catch (e) { setMessage((e as Error).message); } }}>Guardar mis notas</button>
    </FHSurface>}
  </section>;
}

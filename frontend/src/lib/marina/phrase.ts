/** Local-only audio storage. No recording is sent to a server. */
export const MARINA_PHRASE_LIMIT = 10 * 1024 * 1024;
export async function marinaPhraseStore(blob?: Blob | null): Promise<Blob | null> {
  if (blob && (!blob.type.startsWith('audio/') || blob.size > MARINA_PHRASE_LIMIT)) throw new Error('Elige audio de hasta 10 MB.');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('fh-marina-phrase', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('phrase');
    request.onerror = () => reject(new Error('No se pudo abrir el guardado local de voz.'));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('phrase', blob === undefined ? 'readonly' : 'readwrite');
      const object = tx.objectStore('phrase');
      const op = blob === undefined ? object.get('current') : blob === null ? object.delete('current') : object.put(blob, 'current');
      let result: Blob | null = null;
      op.onsuccess = () => { result = blob === undefined ? (op.result instanceof Blob ? op.result : null) : blob; };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(new Error('No se pudo conservar la voz. Descárgala para guardarla.')); };
    };
  });
}

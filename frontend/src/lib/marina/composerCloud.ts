import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { validateComposerDocument, type ComposerCloud } from './composerSync';

let client: SupabaseClient | null = null;
export function composerCloudClient() {
  const url = process.env.NEXT_PUBLIC_COMPOSER_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_COMPOSER_SUPABASE_KEY;
  if (!url || !key) return null;
  return client ??= createClient(url, key, {
    auth: { storageKey: 'fh.composer.auth.v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) }) },
  });
}
export function supabaseComposerCloud(supabase: SupabaseClient): ComposerCloud {
  return {
    async read(userId) {
      const { data, error } = await supabase.from('fh_composer_v1').select('revision,payload').eq('user_id', userId).abortSignal(AbortSignal.timeout(15000)).maybeSingle();
      if (error) throw new Error('No se pudo leer tu copia privada. Se conserva el compositor en este dispositivo.');
      if (!data) return null;
      if (!Number.isSafeInteger(data.revision) || data.revision < 1) throw new Error('La versión privada no es válida. Tus datos locales se conservan.');
      return { revision: data.revision, payload: validateComposerDocument(data.payload) };
    },
    async compareAndSet(userId, revision, payload) {
      validateComposerDocument(payload);
      if (!revision) {
        const { error } = await supabase.from('fh_composer_v1').insert({ user_id: userId, revision: 1, payload }).abortSignal(AbortSignal.timeout(15000));
        if (error?.code === '23505') return false;
        if (error) throw new Error('No se pudo guardar tu copia privada. Tus cambios quedan en este dispositivo.');
        return true;
      }
      const { data, error } = await supabase.from('fh_composer_v1').update({ revision: revision + 1, payload }).eq('user_id', userId).eq('revision', revision).select('revision').abortSignal(AbortSignal.timeout(15000)).maybeSingle();
      if (error) throw new Error('No se pudieron subir los cambios. Se conservan aquí para reintentar.');
      return !!data;
    },
  };
}

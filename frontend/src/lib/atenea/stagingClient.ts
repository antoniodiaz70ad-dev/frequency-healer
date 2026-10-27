import { createClient } from '@supabase/supabase-js';

interface AccessSession { access_token: string; expires_at?: number }
export interface PilotAuth {
  login(email: string, password: string): Promise<AccessSession | null>;
  session(): Promise<AccessSession | null>;
  refresh(): Promise<AccessSession | null>;
  logout(): Promise<void>;
  stop(): void;
}

/** All tokens belong to the SDK's in-memory session. Never store credentials here. */
export class StagingAccess {
  private disposed = false;
  private signingIn = false;
  private abort = new AbortController();
  constructor(private auth: PilotAuth, private http: typeof fetch = (input, init) => fetch(input, init)) {}
  private afterAuth() {
    if (!this.disposed) return;
    this.auth.stop(); void this.auth.logout().catch(() => {});
    throw new Error('Acceso cerrado.');
  }
  async login(email: string, password: string) {
    if (this.disposed || this.signingIn) throw new Error('No se pudo autorizar esta cuenta de prueba.');
    this.signingIn = true;
    try {
      if (!await this.auth.login(email, password)) throw new Error();
      await this.check();
    } catch {
      try { await this.auth.logout(); } catch { /* no private provider error escapes */ }
      if (this.disposed) this.auth.stop(); // a late sign-in may have restarted SDK timers
      throw new Error('No se pudo autorizar esta cuenta de prueba.');
    } finally { this.signingIn = false; }
  }
  async token() {
    if (this.disposed) throw new Error('Acceso cerrado.');
    let session = await this.auth.session();
    this.afterAuth();
    if (session && (!session.expires_at || session.expires_at <= Date.now() / 1000 + 60)) session = await this.auth.refresh();
    this.afterAuth();
    if (!session?.access_token || !session.expires_at || session.expires_at <= Date.now() / 1000 + 30) throw new Error('Vuelve a iniciar sesión.');
    return session.access_token;
  }
  async check() {
    const token = await this.token();
    const response = await this.http('/api/atenea-voz/identity-check', {
      method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(10000)]),
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok || (await response.json()).authorized !== true || this.disposed) throw new Error('Acceso de prueba no autorizado.');
  }
  async logout() { await this.auth.logout(); }
  stop() {
    if (this.disposed) return;
    this.disposed = true; this.abort.abort(); this.auth.stop();
    void this.auth.logout().catch(() => {});
  }
}

export const pilotClientOptions = {
  auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'atenea-staging-memory' },
};

export function createStagingAccess(url: string, publishableKey: string) {
  const client = createClient(url, publishableKey, {
    ...pilotClientOptions,
    global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) }) },
  });
  const auth: PilotAuth = {
    async login(email, password) { const { data, error } = await client.auth.signInWithPassword({ email, password }); if (error) throw new Error('Login failed'); return data.session; },
    async session() { const { data, error } = await client.auth.getSession(); if (error) throw new Error('Session unavailable'); return data.session; },
    async refresh() { const { data, error } = await client.auth.refreshSession(); if (error) throw new Error('Refresh unavailable'); return data.session; },
    async logout() { const { error } = await client.auth.signOut({ scope: 'local' }); if (error) throw new Error('No se pudo confirmar el cierre de acceso.'); },
    stop() { client.auth.stopAutoRefresh(); },
  };
  return new StagingAccess(auth);
}

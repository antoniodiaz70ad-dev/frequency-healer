import { createClient } from '@supabase/supabase-js';
import { subjectId } from './stagingConfig';

export interface InvitationIdentity {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  is_anonymous?: boolean;
}
export interface InvitationAuth {
  verify(email: string, code: string): Promise<InvitationIdentity | null>;
  currentUser(): Promise<InvitationIdentity | null>;
  setPassword(password: string): Promise<InvitationIdentity | null>;
  logout(): Promise<void>;
  stop(): void;
}
function confirmed(user: InvitationIdentity | null, email: string): user is InvitationIdentity {
  return !!user && subjectId.test(user.id) && user.email?.toLowerCase() === email &&
    !!user.email_confirmed_at && user.is_anonymous === false;
}

/** No app tokens/cookies, invitation sending, registration, voice or credential persistence. */
export class StagingInvitation {
  private identity: { id: string; email: string } | null = null;
  private busy = false;
  private disposed = false;
  private saved = false;
  private expiresAt = 0;
  constructor(private auth: InvitationAuth, private now = () => Date.now()) {}
  private assertOpen() {
    if (!this.disposed && (!this.identity || this.expiresAt > this.now())) return;
    this.dispose();
    throw new Error('Alta cerrada.');
  }
  async verify(email: string, code: string) {
    const normalized = email.trim().toLowerCase();
    if (this.busy || this.disposed || this.identity || normalized.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || !/^\d{6,10}$/.test(code)) {
      throw new Error('No se pudo confirmar la invitación.');
    }
    this.busy = true;
    try {
      const user = await this.auth.verify(normalized, code);
      this.assertOpen();
      if (!confirmed(user, normalized)) throw new Error();
      this.identity = { id: user.id, email: normalized };
      this.expiresAt = this.now() + 10 * 60 * 1000;
    } catch {
      this.auth.stop();
      try { await this.auth.logout(); } catch { /* Keep provider details and credentials private. */ }
      throw new Error('No se pudo confirmar la invitación.');
    } finally { this.busy = false; }
  }
  async savePassword(password: string) {
    if (this.busy || this.disposed || this.saved || !this.identity || password.length < 12 || password.length > 128) {
      throw new Error('No se pudo confirmar el guardado de la contraseña.');
    }
    this.busy = true;
    try {
      this.assertOpen();
      // Revalidate remotely before the write; never authorize from editable metadata.
      const user = await this.auth.currentUser();
      this.assertOpen();
      if (!confirmed(user, this.identity.email) || user.id !== this.identity.id) throw new Error();
      const updated = await this.auth.setPassword(password);
      this.assertOpen();
      if (!confirmed(updated, this.identity.email) || updated.id !== this.identity.id) throw new Error();
      this.saved = true;
    } catch {
      // A timed-out write may have succeeded remotely: don't claim it was rolled back.
      throw new Error('No se pudo confirmar el guardado de la contraseña.');
    } finally { this.busy = false; }
  }
  async close() {
    this.disposed = true; this.identity = null; this.auth.stop();
    try { await this.auth.logout(); }
    catch { throw new Error('No se pudo confirmar el cierre del alta.'); }
  }
  dispose() { void this.close().catch(() => {}); }
}

export const invitationClientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'atenea-invitation-memory' },
};

/** Called only after an explicit form submission; each page uses its own in-memory SDK session. */
export function createStagingInvitation(url: string, publishableKey: string) {
  const client = createClient(url, publishableKey, {
    ...invitationClientOptions,
    global: { fetch: (input, init) => fetch(input, {
      ...init, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
    }) },
  });
  return new StagingInvitation({
    async verify(email, code) {
      const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'invite' });
      if (error || !data.session) throw new Error('Invitation unavailable');
      return data.user;
    },
    async currentUser() {
      const { data, error } = await client.auth.getUser();
      if (error) throw new Error('Identity unavailable');
      return data.user;
    },
    async setPassword(password) {
      const { data, error } = await client.auth.updateUser({ password });
      if (error) throw new Error('Password update unconfirmed');
      return data.user;
    },
    async logout() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw new Error('Logout unconfirmed');
    },
    stop() { client.auth.stopAutoRefresh(); },
  });
}

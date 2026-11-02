# ATENEA custom staging domain guard

## Purpose

Vercel's current project policy excludes custom domains from its SSO protection. A custom domain therefore needs an application-side gate before it can be assigned to any staging deployment. This guard is hard-coded to `staging.miatenea.app` and fails closed when configuration, Redis, or the session is unavailable.

## Access behavior

- The guard activates only for the exact hostname, `VERCEL_ENV=preview`, and branch `codex/atenea-staging-domain-guard`.
- It also requires the reviewed Supabase staging provider, the current subject allowlist, the staging app-session feature flag, and `ATENEA_VOICE_ORIGIN=https://staging.miatenea.app`.
- `/atenea-acceso`, `/atenea-acceso/activar`, the verified identity check, the opaque-session exchange/logout endpoint, and the token-protected cleanup route are the only public exceptions.
- Other page requests require a valid opaque `__Host-atenea-session` record in staging Redis. Anonymous pages redirect to `/atenea-acceso`; anonymous APIs return 401. A configuration or Redis failure returns 503. Responses are private/no-store.
- Login checks the Supabase user remotely, checks the UUID allowlist, exchanges the verified identity for an opaque HttpOnly/Secure/SameSite=Strict app cookie, and keeps provider tokens in memory. The cookie expires within one hour and is revocable through the server endpoint.

The app cookie is only the staging site's app access gate. It is not sufficient library authorization. A future library route must still resolve the verified issuer+subject to one owner and re-check current permission, source rights, revision, and deletion state server-side in one transaction.

## Domain assignment and environment

The domain account lists `miatenea.app` as verified, but the current Vercel connector cannot list or inspect project `frequency-healer`. Do not attach the domain until that project is accessible to the Vercel connector and the preview has passed HTTP checks.

When access is restored, attach `staging.miatenea.app` to the **Preview target and branch `codex/atenea-staging-domain-guard` only**. Configure the following variables only for that Preview branch; do not add them to Production:

- `ATENEA_STAGING_DOMAIN_ENABLED=true`
- `ATENEA_STAGING_DOMAIN=staging.miatenea.app`
- `ATENEA_STAGING_SESSION_ENABLED=true`
- `ATENEA_STAGING_ACCESS_ENABLED=true`
- `ATENEA_STAGING_AUTH_REVIEWED=true`
- `ATENEA_STAGING_IDENTITY_PROVIDER=supabase-staging`
- `ATENEA_STAGING_ALLOWED_SUBJECTS=<approved staging UUIDs>`
- `ATENEA_VOICE_ORIGIN=https://staging.miatenea.app`.

Keep voice creation and library flags OFF. Do not add an OAuth redirect until its exact callback route has been implemented and deployed on this protected hostname.

## Required deployment checks

After the branch-specific domain assignment, test over HTTPS on the exact hostname:

1. Anonymous page request redirects to `/atenea-acceso`; anonymous private API returns 401.
2. A valid staging account can log in and receives no readable token in browser storage; the app cookie is HttpOnly and Secure.
3. An expired or revoked app cookie returns to the login page and cannot call private APIs.
4. Logout revokes the server session; production hostname and `main` remain unaffected.
5. Repeat with two distinct authorized staging accounts before library access is enabled.

Current Supabase staging counts show two users, one confirmed account, and zero active Supabase sessions at audit time. This is inventory, not proof of a successful live login. The UI/HTTP checks and Dropbox OAuth callback remain NO-GO until deployment access is restored and the two-account test is performed.

# ATENEA: revocación y creación de voz concurrentes

Base comprobada del PR #36: `0fa20dcb49bd167d3c03f08ef3979e907acf4cbb`. Rama de corrección: `codex/atenea-auth0-session-fencing`, con autodespliegue desactivado en ambos vercel.json antes de publicarla. Los cinco gates siguen false.

## Corrección de la carrera

Antes, una petición podía autenticar, quedar suspendida y reservar después de que logout hubiese respondido 200. Revocar la cookie al final no cercaba esa operación.

Ahora la identidad de voz incluye una versión de sesión: el hash de la cookie opaca aleatoria, sin el valor de cookie. No basta con un bearer JWT; primero hay que intercambiarlo por acceso de aplicación en Redis. Esta es una restricción deliberada del backend, aunque el adaptador de transporte aún admita bearer para otros hosts.

- La reserva Lua comprueba la existencia, propietario y expiración de esa versión **en la misma operación** que bloquea al usuario, carga la cuota y registra el trabajo pendiente en el índice del reaper.
- Logout revoca **la sesión actual**, compartida por las pestañas que tengan esa cookie; no revoca todas las sesiones del sujeto. Un script Lua elimina el acceso y marca cancelada cualquier creación de esa versión antes de inspeccionar o cerrar la voz. Otras sesiones válidas del usuario no pierden su acceso.
- Si la reserva sucede primero, logout encuentra la operación pendiente y no confirma cierre. Si la revocación sucede primero, la reserva es rechazada aunque la autenticación HTTP hubiera finalizado antes.
- Al llegar el resultado del proveedor, bind vuelve a comprobar la versión. Siempre registra el ID recibido; si la versión fue revocada o expiró, adelanta el reaper y el handler intenta cerrar inmediatamente. Nunca devuelve 201 para ese resultado revocado. El fracaso de cierre mantiene el registro y el bloqueo, sin devolver confirmación.
- Las operaciones ambiguas sin ID también cuentan en `processed` del reaper. No se finge que han sido cerradas ni se quitan del índice. Los registros y bloqueos sin resolver ya no caducan por TTL; requieren confirmación o conciliación operativa verificable. Esto exige alertas y gestión de backlog antes de activar tráfico. Los registros cerrados conservan TTL de dos días.
- Cerrar por requestId exige la misma versión de sesión, además del propietario. Logout con gates de creación apagados continúa permitido.

Un 200 de logout solo acredita ausencia o cierre de la voz de la sesión examinada; no acredita logout de Auth0 (todavía no implementado), ni revocación global de usuario. Sin cookie válida no se afirma cierre remoto.

## Pruebas y límites

Regresiones deterministas con barreras, sin sleeps ni aumento de timeout:

1. Autenticación capturada; logout 200; reanudar petición: reserva rechazada, cero llamadas al proveedor.
2. Proveedor detenido después de reservar; logout 202; liberar resultado: 409, cierre intentado; comprobar tanto cierre confirmado como fallo conservando ID/bloqueo.
3. Prueba Redis real en `atenea-live-redis.test.ts`: las mismas intercalaciones HTTP/Lua, reserva revocada, seguimiento del pendiente y cierre tardío.

Los casos 1 y 2 usan almacén y proveedor controlados; no prueban Lua ni audio. El caso 3 requiere Redis real y se ejecuta en Quality de CI; localmente se omite porque no hay redis-cli/server y Docker devuelve EPERM. No atribuir al CI del SHA base resultados de esta corrección. El resultado del commit publicado se registra en su PR.

La autorización JWT ahora exige **scope y permissions** con `atenea:voice`: un usuario autenticado con scope solicitado pero sin permiso RBAC es rechazado. Se prueban firmas reales sintéticas, falta de permiso y rotación JWKS con coexistencia y retirada de claves públicas. Las claves se suministran estáticamente en configuración; no se descargan automáticamente. Cambiar JWKS no revoca cookies ya emitidas: duran hasta revocación o expiración (máximo una hora).

## Auth0 bloqueado, sin resultados inventados

No se pudo consultar ni instalar `@auth0/nextjs-auth0`: npm devolvió `connect EPERM` al proxy del entorno. `npm audit --json` también falló por EPERM en `/security/advisories/bulk`. No hay SDK instalado, versión resuelta, cambios de lockfile ni auditoría actual aprobada. GHSA-5vvp-h2v6-59j6 y el umbral 4.32.0 proporcionados por la revisión deben contrastarse con el SDK y los avisos vigentes cuando npm esté accesible; no se considera revisado ningún aviso posterior.

Pendiente de SDK real: cliente diferido, proxy/rutas permitidas, `enableAccessTokenEndpoint:false`, sessionStore Redis separado, callback OIDC, continuidad same-origin para SameSite Strict, autorización/canje verificado y logout Auth0. Tampoco se han ejecutado pruebas SDK de state/nonce/PKCE/replay, callbacks tardíos, dos pestañas o redirecciones externas. El plan está en [ATENEA_LOGIN_AUTH0.md](ATENEA_LOGIN_AUTH0.md); es un plan, no una implementación.

Sin tenant, aplicación, credenciales, Redis/scheduler de staging, API ni dispositivos físicos. Integración incompleta: **NO-GO**. No fusionar ni desplegar.

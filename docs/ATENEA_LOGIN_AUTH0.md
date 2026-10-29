# Login nuevo de ATENEA: Auth0, implementación pendiente

El propietario pidió crear un login nuevo al no existir un SSO previo. Se elige Auth0 Universal Login y el SDK oficial `@auth0/nextjs-auth0`: su API de acceso RS256 encaja con el verificador existente. No se implementará gestión propia de contraseñas ni intercambio OAuth manual.

**NO-GO:** este documento no instala el SDK, implementa las rutas ni crea un tenant. El intento de consultar npm fue rechazado por el entorno con `connect EPERM` al proxy; no existe una copia local del SDK. No se fija una versión ni se modifica el lockfile sin resolver y auditar el paquete real. El CI previo del PR #36 corresponde a la preparación de staging, no a este login.

## Implementación cuando esté disponible el SDK

1. Instalar una versión estable corregida del SDK, fijarla exactamente y auditar el lockfile completo. Revisar las interfaces y opciones reales de esa versión antes de programar los hooks.
2. Construir el cliente solo en servidor y de forma diferida. Sin configuración, no construir el SDK ni lanzar llamadas de red durante build o render. Requerir origen HTTPS canónico explícito; no inferirlo de Host o Forwarded.
3. Montar el SDK mediante `src/proxy.ts`, con rutas dedicadas `/auth/login`, `/auth/callback` y `/auth/logout`. Mantener estado, nonce, PKCE y validación de callback en el SDK. Limitar el retorno a `/atenea-voz/pruebas`; rechazar retornos arbitrarios. El login debe seguir cerrado si ATENEA_VOICE_ENABLED o ATENEA_STAGING_ENABLED están apagados.
4. Pedir audience de la API ATENEA y scope `openid atenea:voice`, con RBAC y claim `permissions` que incluya `atenea:voice`, sin solicitar refresh tokens hasta verificar su necesidad y política. No conceder `atenea:voice` a cualquiera que se registre: solo cuentas de prueba autorizadas. Deshabilitar registro público en el tenant de staging.
5. Tras callback validado por el SDK, verificar el access token con `accessTokenAuthenticator` y emitir la cookie opaca de Redis del adaptador existente. El token no pasa por JavaScript, URL, localStorage, analítica ni logs. No usar un ID token como credencial de la API. No basta con que la sesión de Auth0 exista.
6. Reutilizar las reglas de expiración, tasa y cambio de identidad del acceso ATENEA. Un cambio de usuario requiere cerrar la voz y revocar el acceso anterior. Una renovación requiere nueva validación del access token; no prolongar por mera presencia de la cookie Auth0.
7. Coordinar logout: apagar micrófono, solicitar cierre remoto y revocar Redis antes del logout de Auth0. Usar acción autenticada con validación de origen; no depender de una navegación GET para revocar ATENEA. Un fallo no puede convertirse en confirmación de cierre. El reaper debe seguir operando con flags de creación apagados.
8. Revisar cookies del SDK: Secure, HttpOnly, ámbito de staging y duración corta, sin secretos expuestos al cliente. Si el SDK guarda tokens cifrados en cookie, documentar esa diferencia con la cookie opaca ATENEA y evaluar almacenamiento de sesión en servidor antes de habilitar.

## Configuración externa pendiente, sin crear secretos ahora

| Elemento | Configuración prevista |
| --- | --- |
| Tenant | Auth0 separado para staging; no existe todavía |
| Aplicación | Regular Web Application; callback exacto `https://<staging>/auth/callback`, retorno de logout exacto al origen de staging; sin comodines |
| API | Identificador/audience ATENEA, RS256, access tokens de máximo una hora y permiso `atenea:voice` restringido a probadores |
| Variables del SDK | AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET y APP_BASE_URL; nombres finales a confirmar con la versión instalada |
| Verificador existente | ATENEA_AUTH_ISSUER igual al issuer real con su barra final, ATENEA_AUTH_AUDIENCE y JWKS público RSA; probar rotación |
| Enlace de login | ATENEA_LOGIN_PATH=/auth/login solo cuando la ruta funcione; no rellenar el enlace actual mientras sea inexistente |
| Recursos ATENEA | Redis persistente, scheduler autenticado, alertas, conciliación y presupuesto global siguen pendientes |

La creación de un tenant o una aplicación puede generar credenciales automáticamente. Por eso no se provisionan mientras siga vigente la instrucción de no crear claves. Esta limitación no impide preparar y probar el código con fixtures.

## Evidencia necesaria

- Sin configuración/flags: build y rutas cerradas, sin conexión al proveedor ni micrófono.
- SDK con proveedor de pruebas controlado: callback con state/nonce/PKCE inválidos, replay, cancelación y redirecciones externas rechazados; no simular estas garantías con un mock que siempre autentica.
- JWT sintéticos firmados: issuer/audience/scope/exp inválidos rechazados; cookie opaca solo tras verificación real; token nunca en respuesta o logs.
- Redis real: dos cuentas aisladas, cambio de identidad, rotación, expiración y revocación; ninguna nueva sesión tras logout.
- Navegador: callback vuelve al laboratorio sin activar audio; consentimiento por inicio, cancelación durante permisos tardíos y cierre de acceso concurrente con inicio.
- Tenant real: login/logout de dos probadores, denegación de cuentas no autorizadas, expiración y rotación JWKS. Requiere configuración externa posterior.
- API/dispositivos físicos: micrófono, silencios, interrupciones, pérdida de conexión y cierre remoto facturable. Siguen fuera de la evidencia de login simulado.

Después del código: ejecutar suite completa, builds ON/OFF, Redis real y logs completos en CI antes de actualizar el estado de implementación. Los cinco flags continúan false; no fusionar ni desplegar por un CI verde.

Documentación oficial: https://auth0.com/docs/quickstart/webapp/nextjs y https://github.com/auth0/nextjs-auth0.

## Requisitos adicionales de la revisión

Desactivar `enableAccessTokenEndpoint` y no habilitar endpoints automáticos no necesarios. Inventariar las rutas que monte la versión real del SDK; no asumir que solo existen login/callback/logout. Usar `sessionStore` en Redis con namespace independiente `fh:{atenea-auth0}:session:` para que el navegador no lleve tokens del proveedor, ni siquiera dentro de la cookie de sesión del SDK. No solicitar refresh tokens inicialmente.

La cookie ATENEA SameSite Strict puede faltar en el callback entre sitios. Completar el canje mediante un paso posterior same-origin vinculado a la transacción validada del SDK y a la sesión previa; proteger callbacks tardíos y cambio de cuenta en dos pestañas. No emitir acceso ATENEA automáticamente en el callback sin esa vinculación. Las interfaces exactas, transacciones y almacenamiento se deben implementar y probar con el SDK instalado, no mediante un sustituto inventado.

La corrección independiente de revocación/versionado está descrita en [ATENEA_SESSION_FENCING.md](ATENEA_SESSION_FENCING.md). No resuelve por sí sola la continuidad ni el logout de Auth0.

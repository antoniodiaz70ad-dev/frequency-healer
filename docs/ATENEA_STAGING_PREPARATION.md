# ATENEA — preparación de staging, sin activación

**NO-GO. Esta entrega prepara código y contratos; no crea proveedores, secretos, claves, Redis ni schedules, no despliega y no activa flags.**

Base: PR #34 (`14c8981`), con Next.js/ESLint Config Next 16.4.3 y Zod transitivo 4.6.7. Se revisaron los logs de [su CI](https://github.com/antoniodiaz70ad-dev/frequency-healer/actions/runs/40530974825): 306/306 en Quality con Redis real, 124/124 UI, builds/smoke ON/OFF aprobados, shell con pipefail. Su auditoría npm completa tiene cero avisos conocidos. El PR #33 y el puente Base 60 permanecen separados. El PR #35 se cerró como duplicado del parche #34, sin fusionarlo.

Rama de esta preparación: `codex/atenea-staging-prep`, PR dependiente de #34. Auto-deploy bloqueado en ambos `vercel.json`. El resultado final de CI del SHA publicado se enlaza en el PR de preparación.

## Contratos preparados

### Login y sesión de aplicación

El login del proveedor externo **no está registrado ni implementado por esta entrega**. Se prepara el adaptador para el SSO de staging que el propietario configure. No se construye un OAuth improvisado ni se pide pegar tokens o claves en la UI.

1. El host completa su login con un SDK de identidad apropiado y obtiene un access token RS256 de corta vida: issuer/audience configurados, scope `atenea:voice` y claim de permisos RBAC `permissions` con `atenea:voice`. Si usa Authorization Code, su SDK debe gestionar PKCE, state, nonce y callback. No usar un ID token sin audiencia/scope de API.
2. El host llama desde el origen canónico a `POST /api/atenea-voz/access` con `Authorization: Bearer <access-token>`. No mandar el token en URL, body, logs, analítica o localStorage. La aplicación valida firma, issuer, audience, scope, iat/exp y duración máxima antes de emitir sesión.
3. La respuesta fija `__Host-atenea-session`: valor opaco aleatorio, HttpOnly, Secure, SameSite=Strict, Path=/, sin Domain. Redis guarda solo el hash de ese valor con sujeto seudonimizado y expiración. No almacena el JWT. La TTL no supera la del token ni una hora; la emisión tiene un límite persistente de 10/minuto por usuario.
4. `GET /api/atenea-voz/access` devuelve solo si hay sesión y su expiración; no expone identidad, tokens o credenciales. El host renueva explícitamente mediante otro intercambio antes de expirar, con rotación de cookie. Cambiar a otro sujeto exige cerrar primero el acceso previo.
5. `DELETE /api/atenea-voz/access` intenta finalizar la voz activa por su propietario y revoca el acceso de aplicación. La cookie local se borra incluso si el servidor reporta un fallo. `202` significa cierre remoto sin confirmar; `503` puede incluir revocación sin confirmar. Nunca interpretar ambos como éxito remoto. El scheduler conserva la tarea pendiente.

La revocación de la cuenta/SSO externo y su logout requieren un hook del host, aún pendiente. La rotación JWKS es explícita por configuración: publicar temporalmente las claves públicas vieja y nueva, verificar ambas, retirar la antigua al expirar los tokens admitidos (máximo una hora más tolerancia); ante compromiso, retirarla inmediatamente. No hay descarga ni rotación automática. Cada construcción del verificador usa la configuración actual. Cambiar JWKS afecta nuevos JWT; sesiones opacas ya emitidas viven hasta su revocación/TTL. Una desactivación inmediata de usuario exige diseñar y probar revocación global por sujeto en staging; este adaptador no la promete. Un token que expire durante la sesión puede impedir el intercambio de renovación y debe probarse con el scheduler.

### Redis y cuotas

Se reutiliza Redis/Lua del backend: un usuario, una llamada simultánea, reservas conservadoras de 600 s y presupuesto diario UTC de 1800 s. La sesión de aplicación y su tasa de emisión se guardan en el mismo namespace con TTL; las reservas y bloqueos de voz sin resolver no caducan: requieren cierre confirmado o conciliación humana verificable; no hay fallback en memoria.

La prueba CI de Redis real se amplía a emisión, consulta, revocación y límite de sesiones de aplicación. Ese Redis de laboratorio **no es el Redis de staging**. Faltan instancia, acceso, credenciales de entorno, región, retención de metadatos, límites, alertas y prueba de caída/restauración reales.

### Scheduler de cierre

`GET` y `POST /api/atenea-voz/reap` admiten un scheduler externo con `Authorization: Bearer <ATENEA_REAPER_TOKEN>`. El token nunca se entrega al navegador. La validación y el timeout son idénticos para ambos métodos; GET existe para schedulers que usen ese método.

Configurar posteriormente una llamada cada minuto, con alertas por error HTTP, `confirmed < processed` persistente, backlog y sesiones sin ID. Se requiere token de al menos 32 caracteres. Mantener `ATENEA_REAPER_READY=false` hasta probar la ejecución real, su autenticación, caída y recuperación. Esta entrega **no añade crons a Vercel ni registra ningún schedule**.

Un TTL no confirma cierre facturable. Si una creación pierde la respuesta antes de recibir ID, se mantiene la reserva y se impiden nuevos intentos; falta conciliación/alerta y un procedimiento con el proveedor. No hay GO mientras ese caso o el presupuesto global del proyecto estén sin resolver.

### Consentimiento remoto y pantalla de prueba

`/atenea-voz/pruebas` es independiente del simulador y está tras `ATENEA_VOICE_ENABLED` **y** `ATENEA_STAGING_ENABLED`, ambos false por defecto. El laboratorio `/atenea-voz` continúa con mocks.

La pantalla nueva consulta acceso, exige consentimiento explícito de envío remoto para cada inicio y lo reinicia al terminar. El consentimiento local del simulador no sirve. El micrófono se pide solo al pulsar Iniciar con acceso válido, revisión/configuración real disponible y checkbox aceptado. Aceptar el checkbox nunca activa la API por sí solo.

El transporte usa cookie HttpOnly con fetch same-origin: no lee JWT desde JavaScript. La ruta de voz ya no acepta un bearer JWT como identidad independiente: el host debe completar primero el canje a sesión opaca revocable. Al salir, desconectarse o cancelar durante permisos, intenta apagar captura/reproducción y cerrar el transporte; un permiso tardío se descarta. El cierre de acceso revoca únicamente la sesión opaca actual (las pestañas que comparten esa cookie), no todas las sesiones del usuario. Redis coordina atómicamente revocación, reserva y cancelación de creaciones pendientes por versión de sesión. Bloquea nuevos inicios mientras revoca y permite reintentar un fallo de revocación.

Los captions siguen sin tratarse como órdenes finales o consentimiento. La prueba remota usa Terminar/Pausa en pantalla; reconocimiento robusto de `terminar` y barge-in acústico requieren la validación futura con proveedor. No se guarda audio/transcripción ni se comparte nada con Base 60. Revisar el aviso y la retención efectiva del proveedor antes de marcar `ATENEA_LIVE_REVIEWED=true`; `store:false` no equivale a cero retención operativa.

## Configuración pendiente: no rellenar valores reales en el repositorio

`frontend/.env.example` contiene nombres vacíos y gates false. Los valores reales se configurarán posteriormente en el entorno de pruebas autorizado. Ninguna variable nueva es NEXT_PUBLIC.

| Configuración | Qué falta verificar |
| --- | --- |
| `ATENEA_VOICE_ORIGIN` | Origen HTTPS canónico de staging, exacto y sin barra final; no Host/Forwarded de cliente |
| `ATENEA_LOGIN_PATH` | Ruta local del login del host (por ejemplo `/auth/login`), solo cuando ese host/SDK esté integrado; no redirección arbitraria |
| `ATENEA_AUTH_ISSUER`, `ATENEA_AUTH_AUDIENCE` | Proveedor de identidad y audiencia de API, scope `atenea:voice`, renovación y logout del host |
| `ATENEA_AUTH_JWKS` | JWKS público RSA, rotación y rechazo de tokens antiguos/inválidos; sin claves privadas |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Redis persistente HTTPS de staging, región, política de acceso y alertas; probar fallo sin gasto nuevo |
| `ATENEA_REAPER_TOKEN` | Secreto servidor del scheduler, autenticación y rotación. No se crea en este trabajo |
| `OPENAI_API_KEY` | Posteriormente, secreto solo servidor de proyecto de pruebas con acceso y presupuesto verificados. No se solicita/crea ahora |
| Presupuesto global/alertas del proveedor | Corte de gasto y conciliación de llamadas ambiguas. La cuota de segundos no es un límite monetario del proyecto |
| Privacidad y acceso a metadatos | Retención y borrado de IDs/hashes; política real del proveedor; acceso de dos usuarios aislados |
| Dispositivos y mediciones | Micrófono físico, 60 s de silencio, interrupción verbal, cierre facturable, latencia/coste; escritorio, iOS Safari/PWA y Android |

Gates: `ATENEA_VOICE_ENABLED=false`, `ATENEA_STAGING_ENABLED=false`, `ATENEA_LIVE_ENABLED=false`, `ATENEA_LIVE_REVIEWED=false`, `ATENEA_REAPER_READY=false`. No cambiar ninguno como consecuencia automática de un CI verde.

## Verificación y próximos pasos

- `node frontend/scripts/atenea-staging-check.mjs`: inventario offline y de solo lectura; imprime únicamente nombres/estado, nunca valores. Configurado no significa disponible/aprobado. La salida siempre conserva NO-GO y verificaciones externas pendientes.
- Tests de JWT/HTTP/cookie: expiración, scope/firma, cambio de sujeto, límites, revocación, cierre incierto y Redis no disponible. JWT sintéticos de laboratorio no son claves de OpenAI.
- Redis real en CI: reservas concurrentes, replay, presupuesto, cleanup, TTL y revocación de sesión de aplicación. Local sin Redis se omite explícitamente ese caso, sin presentarlo como aprobado.
- Navegador: suite completa existente y smoke de la nueva página en servidor aislado, con voz real forzada a false. Sin proveedor/identidad configurados, aceptar consentimiento debe mantener Iniciar deshabilitado, cero solicitudes de micrófono y cero escrituras de almacenamiento.
- El siguiente paso operativo requiere elegir/configurar el host de login y los recursos de staging; después probar autenticación/renovación con dos cuentas, scheduler y fallos inducidos. Solo con esos controles revisados se considerará configurar la clave y autorizar una prueba de audio real. Nada de esto se registra, despliega ni activa aquí.

La integración sigue **incompleta / NO-GO** hasta la evidencia operativa de esos pasos y aprobación humana posterior. Next.js actualizado y un CI verde no acreditan voz real ni autorizan producción.

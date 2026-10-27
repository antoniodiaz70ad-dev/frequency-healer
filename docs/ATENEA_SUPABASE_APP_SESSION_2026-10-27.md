# ATENEA — Supabase y sesión de aplicación

Fecha: 27 de octubre de 2026, America/Mexico_City.
Base: PR #37, `40612c69398283bb184dda1009fc7e51a0b32841`, dependiente de #36/#34/#33.
Rama: `codex/atenea-session-integration-20261027`.

**Integración en código; NO-GO operativo para voz real.** Sin merge, despliegue, claves de voz, flags externos activados ni cambios de producción. Auto-deploy de la rama bloqueado desde su primer commit remoto en ambos `vercel.json`.

## Resultado

El perfil de Supabase del #37 se conecta al contrato de cookie de aplicación del #36. No se interpreta su JWT como un access token RS256 con scope de API. El perfil explícito usa `auth.getUser` contra el proyecto fijo, cuenta confirmada/no anónima y lista de hasta cinco UUID autorizados por el servidor. Esa lista es la autorización de los pilotos; no `user_metadata`, un scope inventado ni el mero rol authenticated. Se conserva el adaptador RS256 para un host que lo utilice sin este perfil. Un perfil desconocido falla cerrado.

`/atenea-acceso` sigue siendo la comprobación aislada de identidad del #37. La pantalla `/atenea-voz/pruebas` incorpora ahora login y renovación sin navegar fuera de la sesión. El SDK se carga solo al pulsar Entrar: una pantalla sin configuración no inicializa Auth ni toca almacenamiento.

Flujo:

1. El SDK oficial de Supabase inicia sesión; access/refresh tokens quedan solo en memoria. Se vacía el formulario al enviarlo. No hay registro, invitaciones, recuperación de contraseña ni OAuth implementado a mano.
2. Se comprueba identidad y se intercambia el Bearer con `POST /api/atenea-voz/access`, credentials same-origin, no-store, sin redirecciones ni cuerpo con credenciales.
3. El servidor revalida la identidad y crea la cookie opaca `__Host-atenea-session`, HttpOnly, Secure, SameSite Strict, Path=/, sin Domain. Redis conserva el hash y la expiración, nunca el JWT; se reutilizan límites, rotación y control de cambio de propietario del #36. No existe fallback en memoria.
4. Renovar acceso obtiene un token válido del SDK y repite el intercambio con rotación de cookie. Antes de solicitar micrófono se exige una credencial que cubra 600 s y 60 s de margen de cierre; si el proveedor no puede emitirla, se rechaza antes de capturar audio.
5. Cerrar acceso cancela las peticiones pendientes y detiene micrófono/transporte antes de revocar la cookie. Se solicita también el logout del SDK. Un 202/503 o un fallo del proveedor se presentan como pendientes de confirmación, nunca como cierre remoto confirmado.

La sesión del proveedor no se restaura tras recargar. La UI exige volver a entrar aunque una cookie anterior aún exista. Un intercambio fallido no autoriza la UI ni se reintenta automáticamente. Tampoco revoca silenciosamente una cookie previa de otro propietario: el usuario debe cerrar explícitamente el acceso antes de cambiar de cuenta.

En pagehide/offline/desmontaje se intenta parar el transporte, cancelar el SDK y revocar la cookie con keepalive. Es **best effort**, no garantía de entrega al perder red o matar el navegador; Redis/TTL y el scheduler independiente siguen siendo imprescindibles. La renovación es explícita y previa al inicio, no una promesa de renovación en segundo plano bajo bloqueo del teléfono.

## Gates separados y cierre

- `ATENEA_STAGING_SESSION_ENABLED=false` por defecto. Cuando se configure y revise el perfil, este gate permite mostrar el login de pruebas con voz todavía OFF. No activa el modelo.
- La creación de voz sigue exigiendo los gates de laboratorio/staging/Live/revisión/reaper, además del gate de sesión y la configuración revisada de Supabase. Una cookie por sí sola no habilita voz.
- La configuración estática de identidad y Redis permanece disponible para DELETE al apagar gates de admisión; el verificador de nuevos tokens pasa a rechazar. No quitar URL, claves públicas, referencias prohibidas o Redis antes de cerrar las sesiones existentes.
- Un piloto retirado de la lista no puede crear voz usando su cookie vieja. La cookie conserva capacidad de cerrar su propia llamada. La consulta/rotación conserva el propietario anterior para impedir un cambio silencioso de cuenta.
- Se rechaza este perfil en producción de Vercel incluso si se marca el override local. Loopback explícito sirve para los tests de identidad; la configuración persistente de runtime exige HTTPS. Los tests de navegador simulan el intercambio y comprueban atributos reales de la cookie en Chromium sobre loopback.

## Estado externo verificado

Supabase `frequency-healer-atenea-staging`, referencia `rayebpxdfatsnkbderot`, organización `ohhtksdmibwipztfvanf`, región us-east-2, fue creado con autorización expresa de US$10/mes de base, más consumos aplicables. Su provisión se documentó en el #37. Base 60 y los demás proyectos no se reutilizan ni modifican.

En esta fase una consulta de solo lectura a `auth.users` devuelve **0 cuentas**. No se crearon usuarios ni se enviaron correos. No hay credenciales reales de prueba con las que acreditar login, renovación o revocación externa. No se cambia Auth, esquema, RLS, secretos, variables de Vercel ni ninguna configuración operativa de los proyectos.

La consulta actual a Vercel de nombres/ámbitos de variables (sin descifrarlas) no muestra configuración de identidad ATENEA, Redis ni scheduler en Frequency Healer; solo tres overrides de preview de otra rama del flujo de voz existente. No se cambió ninguna variable.

El Redis real utilizado por CI es un servicio efímero del runner. **No es Redis de staging.** Sin Redis/configuración real el endpoint devuelve 503 y no emite cookie, incluso si se habilita la pantalla solo en un proceso sintético local.

## Validación

La evidencia final local se guarda en `docs/evidence/atenea-session/`. Se normalizan únicamente espacios y líneas vacías finales de logs copiados. El PR enlaza y revisa el CI de su SHA publicado; no se sustituye por el verde del job ni por resultados de un commit anterior.

- Pruebas de dominio anteriores y ocho casos nuevos: configuración de cierre con gates OFF, intercambio del SDK, margen de expiración, cancelación tardía, cookie/renovación con JWT ES256 firmados de prueba, dos cuentas aisladas, rechazo del proveedor/almacén y cierre incierto tras apagar admisión.
- La prueba de contrato utiliza un doble de getUser que verifica firma con una clave ES256 de laboratorio. No equivale a una llamada de Supabase Auth. Redis real en CI comprueba por separado persistencia, TTL, concurrencia, cuotas y revocación del almacén existente.
- Navegador: SDK/proveedor y endpoint de intercambio interceptados para probar login, cookie HttpOnly/Secure no visible en document.cookie, renovación, logout, recarga, cero audio y cero almacenamiento de tokens. Otro caso llama al endpoint local real sin Redis: 503 sin Set-Cookie.
- Smoke del #36 conserva el requisito de cero micrófono y cero escrituras sin proveedor configurado. Detectó una inicialización prematura del SDK; la carga condicional la corrigió. La suite anterior a ese arreglo se interrumpió y no cuenta como resultado final.
- TypeScript, ESLint, build y smoke ON/OFF; todos los flags ON se limitan a procesos sintéticos de loopback. Live no se conecta.
- Entorno final local: Node 22.14.0 y Chromium alternativo 153.0.8010.0 instalado fuera del repositorio. No se afirma equivalencia exacta con el Chromium fijado 153.0.8010.12 de CI. No se añaden dependencias ni cambios de lockfile.

## Resultado local final

| Comprobación | Resultado |
| --- | --- |
| Dominio, Node 22.14.0 | 336 totales: 335 aprobadas, 0 fallos, 1 omisión explícita de Redis local |
| TypeScript / ESLint | Aprobados |
| UI completa, Chromium alternativo local | 129/129, 0 fallos y 0 omisiones |
| Builds y smoke ON/OFF | Aprobados |
| Gate OFF | 2 comprobaciones HTTP aprobadas; 2 casos visuales omitidos porque el laboratorio está apagado |
| Consentimiento sin configuración | Cero micrófono / cero escrituras: aprobado |
| Auditoría npm completa | 0 vulnerabilidades conocidas |

El CI debe confirmar los resultados de su SHA con Redis real y Chromium fijado. El PR incorpora el enlace y los contadores de sus logs completos; los datos sintéticos no acreditan el proveedor externo.

## Pendientes operativos

1. Crear por un canal administrativo seguro al menos dos cuentas de prueba confirmadas en este proyecto; definir quién está autorizado y configurar sus UUID solo en servidor. No insertar contraseñas en SQL ni enviarlas por chat. El plugin disponible no ofrece creación/configuración de usuarios Auth; no se construye un endpoint administrativo público para suplirlo.
2. Redis exclusivo de staging: instancia, URL/token servidor, región, acceso, retención y alertas. No se contratan recursos adicionales ni se reutiliza Redis de producción. Probar caída y recuperación, revocación, dos usuarios y ausencia de reserva/gasto al fallar.
3. Preview privado HTTPS con origen canónico, protección de acceso y variables limitadas a esa rama. Revisar los valores y mantener todos los gates de voz OFF. No hay preview desplegado de esta rama en esta entrega.
4. Probar con Supabase real login, contraseña incorrecta, expiración/refresh, account switch, logout, usuario retirado/desactivado, dos navegadores y revocación. getUser/signOut no garantizan invalidación inmediata de todos los JWT/cookies ya emitidos. La desactivación global y las sesiones de otras pestañas requieren política y evidencia antes de GO.
5. Scheduler/reaper real, secreto separado, alerta/backlog y cierre facturable; conciliación de creaciones sin ID. Un TTL no confirma que el proveedor haya dejado de cobrar.
6. Presupuesto global y corte/alertas monetarios, política efectiva de privacidad/retención y consentimiento remoto nuevo. La cuota de segundos no es un límite de dólares.
7. Solo después, clave de voz y validación física controlada: silencios, interrupciones, audio, cierre, iOS/Safari/PWA y Android. Astra/Pro y manos libres continúan pendientes.

No promover, fusionar ni activar por un CI verde. Supabase existe; la autenticación operativa y la voz real todavía no están acreditadas.

Referencias: [sesiones Supabase](https://supabase.com/docs/guides/auth/sessions), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser), SDK fijado 2.118.0 y documentación incluida de Next 16.4.3; contratos de #36/#37.

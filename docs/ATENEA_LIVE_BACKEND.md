# ATENEA — backend protegido y transporte GPT-Live

**NO-GO. Código preparado y probado en laboratorio; sin credenciales, activación, fusión ni despliegue.**
Continuación del [MVP simulado](ATENEA_VOZ_MVP.md) en el mismo PR draft #33. La UI sigue usando exclusivamente mocks; el transporte real no se conecta a esa UI para evitar reutilizar su consentimiento local o confundir captions con órdenes finales.

## Qué se implementa

- `POST /api/atenea-voz/session`: origen canónico, identidad firmada, consentimiento remoto versionado, validación y límite de cuerpo, reserva atómica persistente y negociación SDP server-only. Solo acepta `requestId`, `mode`, `consent`, `sdp`; ningún modelo, endpoint o herramienta del cliente.
- JWT de acceso RS256 con JWKS **público** configurado en servidor, issuer/audience exactos, firma, `iat`/`exp`, antigüedad máxima de una hora, `sub` y scope `atenea:voice`. Se persiste un hash por issuer/subject, nunca JWT/email/audio/transcript. No se crean cuentas ni tokens de acceso en esta entrega: falta conectar el proveedor de identidad de staging y su inicio de sesión.
- Redis/Upstash con scripts Lua atómicos: un usuario no puede abrir dos sesiones ni repetir una reserva; cada intento reserva 600 s y el presupuesto diario UTC es 1800 s. No hay fallback en memoria. El contador no se reembolsa al cerrar pronto ni ante fallo ambiguo, para impedir reintentos con gasto duplicado. Esto es una cuota conservadora de admisión, **no contabilidad exacta ni un límite monetario del proveedor**.
- Sesiones por propietario, respuesta de cierre idempotente, cierre remoto por sideband y bloqueo persistente hasta confirmación. Apagar los flags de creación no impide cerrar sesiones ya existentes.
- `POST /api/atenea-voz/reap`: limpieza de sesiones con deadline vencido, autenticada mediante un secreto de scheduler distinto. Conserva las no confirmadas para volver a intentar y retira referencias Redis caducadas. No se crea el scheduler ni se provisiona Redis en esta entrega.
- `LiveVoiceConnection`: micrófono/SDP/ICE/data channel, espera `session.started`, pausa local y remota, limpieza inmediata de captura/reproducción y espera acotada de confirmación. Si el canal falla, intenta cierre autenticado del servidor. No convierte silencio ni fragments de transcript en consentimiento u órdenes finales.
- Cancelación durante permisos (suite del MVP), autenticación, reserva, ICE o creación; si la creación termina tarde se intenta cerrar con la identidad/reserva original. Una instancia de transporte se usa una sola vez; no hay reconexión automática.

## Contrato oficial verificado

La revisión de documentación confirma `gpt-live-1`, JSON en `POST https://api.openai.com/v1/live/sessions`, respuesta `session.id`/`transport.sdp`, inicio por `session.started` y cierre por `session.close`/`session.closed`. La clave permanece en el servidor. Se fija `store: false`, voz `marin` y delegación `client`: no hay análisis hosted automático.

El data channel permite únicamente cerrar y mutear/desmutear entrada. No permite cambiar instrucciones/modelo, habilitar herramientas ni generar delegaciones facturables. El servidor abre el sideband autenticado para confirmar el cierre; no usa el endpoint SIP como si estuviera verificado para WebRTC.

Fuentes oficiales:

- [WebRTC con GPT-Live](https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=live).
- [Esquema de creación y permisos del cliente](https://developers.openai.com/api/reference/resources/live/methods/create).
- [Eventos, transcripts y cierre](https://developers.openai.com/api/docs/guides/live-conversations).
- [Sideband de servidor](https://developers.openai.com/api/docs/guides/voice-server-controls?voice-api=live).
- [Lua/EVAL de Upstash](https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval).

Los transcripts Live llegan como fragmentos sin evento de turno finalizado. Por ello el transporte no afirma haber reconocido `terminar`, ni autoriza guardar o análisis a partir de esos fragmentos. La detección verbal robusta sigue pendiente. La interrupción acústica y calidad de silencios deben probarse con el modelo; aquí solo se verifica el protocolo y el ciclo de recursos simulado.

## Flags y configuración futura (sin valores secretos)

Todos los flags están apagados si faltan o no son exactamente `true`. **No se cambia ninguno en producción o staging.**

| Variable servidor | Uso |
| --- | --- |
| `ATENEA_VOICE_ENABLED` | Acceso a laboratorio y creación; ausente => 404 |
| `ATENEA_LIVE_ENABLED` | Gate adicional de llamadas reales |
| `ATENEA_LIVE_REVIEWED` | Revisión humana de API, privacidad, identidad y costes |
| `ATENEA_REAPER_READY` | Declaración de que el scheduler de limpieza está configurado y probado |
| `ATENEA_VOICE_ORIGIN` | Origen HTTPS canónico exacto, sin barra final |
| `ATENEA_AUTH_ISSUER`, `ATENEA_AUTH_AUDIENCE`, `ATENEA_AUTH_JWKS` | Configuración del emisor y JWKS público (rotación explícita) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Almacén persistente, sin reintentos de escritura automáticos |
| `OPENAI_API_KEY` | Clave exclusiva de servidor; no se solicita ni configura todavía |
| `ATENEA_REAPER_TOKEN` | Secreto exclusivo del scheduler, mínimo 32 caracteres |

Los flags de readiness expresan configuración, no prueban acceso real. El scheduler externo debe invocar `POST /api/atenea-voz/reap` cada minuto y alertar si `confirmed < processed` persiste. No depende del navegador. Hay un máximo de 25 cierres por lote; se procesan en paralelo con timeout por socket. Deben medirse backlog/latencia y capacidad antes de habilitar tráfico.

## Límites y bloqueos antes de habilitar

1. **Proveedor real:** sin llamadas ni credenciales en estas pruebas. Validar disponibilidad, políticas de retención reales y restricciones de eventos con la cuenta de staging. `store:false` no equivale a prometer ausencia de retención operativa del proveedor.
2. **Creación ambigua:** un timeout puede dejar una sesión cuyo ID no llegó al servidor. Se bloquean nuevos intentos y se conserva la reserva; sin ID no es posible confirmar cierre mediante sideband. Hace falta un procedimiento de conciliación/alerta del proveedor y presupuesto del proyecto antes de activar. El TTL de metadatos de 48 h no acredita que una llamada remota haya terminado.
3. **Duración:** el navegador cierra a los 600 s y el scheduler actúa por deadline. Puede haber demora de scheduler o cierre, por lo que no se promete un máximo de gasto exacto. Probar caída de navegador, timeout de creación, caída Redis y scheduler, alarma y cierre remoto real.
4. **Identidad:** conectar el login de staging y entrega/renovación de tokens de acceso de corta vida sin localStorage ni logs. Si el token caduca antes del cierre, el scheduler debe finalizar la sesión; verificar este caso antes de habilitar.
5. **Experiencia:** integrar la UI real con consentimiento remoto nuevo, controlar reproducción bloqueada por navegador y decidir cómo detectar órdenes finales sobre fragments. No reutilizar el controlador simulado para producir respuestas estáticas junto al modelo real.
6. **Astra/Pro:** no habilitado. El delegado simulado sigue separado. Verificar el contrato actual de GPT-6 Astra y añadir límites persistentes, confirmaciones y presupuesto de análisis antes de conectarlo; el transporte Live no permite activarlo desde cliente.
7. **Dispositivos:** micrófono físico, iOS Safari/PWA, Android, pantalla bloqueada, llamadas entrantes, rutas de audio, interrupción verbal, 60 s de silencio y finalización facturable necesitan validación real. No se declaran cubiertos por fakes o viewport móvil.
8. **Puente:** PR #29 de Frequency Healer y #32 de Base 60 permanecen independientes. No cambian contratos, guardado, RLS o consentimiento del puente.

## Evidencia

- Unitarias: JWT firmados de prueba; límites HTTP, propiedad, idempotencia, cancelación, aislamiento de configuración del cliente y protocolo del proveedor.
- Transporte con fakes: orden de listeners, negociación, pausa, cancelación/creación tardía, caption sin consentimiento, pérdida de canal y confirmación/inconfirmación de cierre.
- Redis **real en CI**: servicio `redis:7-alpine`, scripts Lua ejecutados por clientes concurrentes, replay, presupuesto y limpieza de referencias caducadas. El test se omite localmente si `ATENEA_TEST_REDIS_PORT` no está configurado. No confundir el doble de almacén de las pruebas de servicio con esta prueba real.
- Build y E2E de laboratorio/flags ON/OFF en CI. Sin secretos de proveedores.

El PR enlaza los resultados del commit final. La integración permanece **incompleta / NO-GO** mientras falten los bloqueos anteriores, aunque el CI sea verde.

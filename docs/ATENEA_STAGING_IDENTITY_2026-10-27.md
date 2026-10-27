# ATENEA — comprobación aislada de identidad de staging

Actualización posterior de recursos y sesión: [ATENEA_SESSION_REVOCATION_2026-10-27.md](ATENEA_SESSION_REVOCATION_2026-10-27.md). El inventario de esta entrega refleja el momento anterior al aprovisionamiento; el probe sigue separado del acceso a voz.

27 de octubre de 2026. Base: PR #36, `0fa20dcb49bd167d3c03f08ef3979e907acf4cbb`, dependiente de #34 y #33. Rama: `codex/atenea-staging-access-20261027`.

**NO-GO para voz real.** Se prepara únicamente una comprobación de cuenta de prueba. No se crea infraestructura, no se contrata un proveedor, no se activan flags externos y no se fusiona ni despliega nada. El auto-deploy de esta rama está bloqueado en ambos `vercel.json`.

## Estado externo observado

- Base 60 utiliza Supabase Auth. Su proyecto existente es de producción y no tiene una rama de staging registrada; no se reutiliza ni se configura como fallback.
- En Frequency Healer no se observó configuración de identidad ATENEA, Redis o scheduler en Vercel. Se consultaron nombres y ámbitos de variables sin descifrar ni mostrar valores. El proyecto utiliza Node 24.x; CI utiliza 22.14.0.
- La organización de Supabase tiene plan Pro. La herramienta de costes cotizó un proyecto adicional en **US$10 mensuales de base**; consumo adicional puede aumentar ese importe. No se confirma ni contrata ese coste. Un proyecto separado o uno de staging existente y expresamente identificado debe acordarse antes de configurar la cuenta.

## Alcance y separación respecto de #36

`/atenea-acceso` y `POST /api/atenea-voz/identity-check` comprueban identidad sin audio, OpenAI, Redis, reserva de cuotas ni escritura de una cookie de aplicación. No reemplazan `/api/atenea-voz/access` del #36: ese contrato conserva su cookie HttpOnly, revocación, límites persistentes y cierre remoto. Tampoco reemplazan `/atenea-voz/pruebas` o el simulador.

El perfil `ATENEA_STAGING_IDENTITY_PROVIDER=supabase-staging` corresponde exclusivamente a esta comprobación. **No conecta los JWT de Supabase al verificador RS256/scope de voz del #36 y no concede una sesión de voz.** La adaptación revisada entre ambos contratos, renovación de cookie y logout coordinado sigue pendiente; no basta con apuntar el login a Supabase o cambiar issuer/JWKS.

Se fija `@supabase/supabase-js` 2.118.0 en el lockfile y se declara Node >=22, requisito del SDK. No se usa service_role, clave secreta, clave JWT heredada ni user_metadata para autorizar.

## Controles implementados

- OFF por defecto. Requiere proveedor, acceso y revisión explícitos; solo preview de Vercel, o loopback local declarado sin variables de Vercel. Producción se rechaza aunque se marque el override local.
- Proyecto canónico HTTPS de Supabase. Lista obligatoria de referencias de producción prohibidas; publicar únicamente la clave `sb_publishable_` validada. Sin hosts o redirecciones arbitrarios.
- Máximo cinco sujetos UUID autorizados en configuración del servidor. Cuenta no anónima con correo confirmado. No existe registro de cuentas, invitaciones o recuperación en esta pantalla.
- Los claims se decodifican solo para rechazar entradas: issuer fijo, audiencia/rol authenticated, session_id, iat/exp y vida máxima de una hora. La autenticación se exige después mediante `auth.getUser(token)` contra el proyecto fijo; decodificar un JWT no prueba su firma. La identidad devuelta debe coincidir con el sujeto permitido.
- SDK del navegador sin persistencia ni importación de tokens desde URL. Tokens solo en RAM, formulario vaciado al enviarlo, errores genéricos, sin credenciales en logs o analítica. Se renueva el token próximo a expirar y se cancelan las operaciones al salir. Recargar pierde el acceso local. El SDK puede hacer una prueba temporal de disponibilidad de localStorage (`lswt-*`), eliminada inmediatamente; no escribe allí credenciales ni sesiones.
- Probe con POST, origen exacto, rechazo cross-site, cuerpo vacío y respuestas no-store. Tiempos acotados, fetch sin redirecciones. El resultado tiene alcance `atenea:identity-check`, no acceso a voz.
- Logout de la pantalla solicita signOut local del SDK. No se promete revocación inmediata de todos los JWT: getUser/signOut y la desactivación de cuentas deben probarse con sesiones reales. La cookie de voz de #36 no se emite ni revoca desde esta pantalla.

## Defectos detectados durante la validación

El navegador reprodujo el fallo de llamar a `fetch` nativo como método de una instancia: el receptor incorrecto impedía el probe. Se usa una función envolvente para conservar la invocación nativa, tanto en el nuevo cliente como en el mismo patrón del transporte Live existente.

Las pruebas de transporte demuestran además que el cierre bearer reutilizaba el token inicial aunque el host pudiera renovarlo. Ahora pide un token actualizado con espera máxima de cinco segundos; si falla intenta el original y conserva la necesidad de confirmación del servidor. El micrófono se detiene inmediatamente. El modo de cookie de #36 sigue funcionando sin callback de token. No se presenta un cierre fallido como confirmado.

## Validación y límites

La evidencia se guarda en `docs/evidence/atenea-identity/`; en los logs copiados solo se normalizan espacios finales y líneas vacías al final. Los resultados finales se registran en el PR junto con el SHA de CI. El primer build/suite de la preparación previa a descubrir #36 no valida la versión final; se regeneró el build después de reconciliar esa rama.

Las pruebas de autenticación usan lookup inyectado y credenciales sintéticas. El navegador intercepta el proveedor y el probe: valida el ciclo SDK/UI, no una identidad externa ni una firma real. Una segunda prueba HTTP usa el probe local real para verificar rechazo sin identidad y de otro origen. Se comprueba ausencia de micrófono, llamadas de voz, cookies de esta pantalla y almacenamiento persistente; logout, nuevo login y recarga. Se revisa captura móvil 390 × 844.

El Chromium local alternativo es 153.0.8010.0; la descarga exacta de Playwright devolvió un ZIP truncado. El Chromium fijado 153.0.8010.12 y Redis real se validan separadamente por CI. Una omisión de Redis local no cuenta como prueba aprobada.

## Resultado local final

Node 22.14.0, Next 16.4.3. Servidores exclusivamente loopback, voz real OFF.

| Comprobación | Resultado |
| --- | --- |
| Instalación limpia `npm ci` | Aprobada desde el lockfile publicado |
| Dominio | 328 totales: 327 aprobadas, 0 fallos, 1 omisión explícita de Redis local |
| TypeScript y ESLint | Aprobados |
| Auditoría npm completa | 0 vulnerabilidades conocidas, incluidas dependencias de desarrollo |
| Build + HTTP smoke, laboratorio ON/OFF | Aprobados en ambos estados |
| Suite de navegador final | 127/127 aprobadas, 0 fallos, 0 omisiones; Chromium alternativo local |
| Gates OFF | 2 HTTP aprobadas, 0 fallos; 2 casos visuales omitidos porque el laboratorio está apagado |
| Consentimiento de staging sin configuración | Aprobado: el checkbox no habilita Iniciar, cero micrófono/almacenamiento |
| Recepción nativa de fetch | `Illegal invocation` reproducida; envolvente devuelve HTTP 200 con datos sintéticos |

La suite completa se ejecutó sobre el build regenerado con el #36 conservado. El CI del nuevo commit debe confirmar sus propios contadores con Chromium fijado y Redis real; se enlaza y revisa en la descripción del PR. No confundir estos datos con un login externo o audio físico.

## Requisitos pendientes antes de una prueba real

1. Aprobar/identificar un proyecto de identidad exclusivamente de staging y su región; configurar protección del preview, cuentas de prueba y lista de producción prohibida. Verificar login, expiración, renovación, logout, revocación y aislamiento con dos cuentas reales. No enviar contraseñas ni claves por chat.
2. Diseñar y probar la adaptación del SDK al contrato de sesión de aplicación del #36, con rotación de cookie y logout/cierre coordinados. Un probe autorizado no acredita esta integración.
3. Provisionar Redis de staging, comprobar cuotas persistentes concurrentes, aislamiento, límites de login, indisponibilidad y recuperación. Redis de CI no satisface este requisito.
4. Configurar y probar scheduler real, secreto separado, caída/recuperación, backlog/alertas y cierre remoto. Resolver creaciones ambiguas sin ID. El TTL no prueba cierre facturable.
5. Establecer presupuesto global, alertas y corte de gasto del proyecto de proveedor, además de las reservas de segundos por usuario. No se solicita ni configura una clave de voz en esta entrega.
6. Revisar aviso/retención/borrado de metadatos, consentimiento remoto nuevo por sesión, política efectiva del proveedor y responsabilidades de acceso. `store:false` no promete retención cero.
7. Validar micrófono físico, WebRTC, pausa/interrupción verbal, 60 segundos de silencio, cierre facturable y coste/latencia en escritorio, iOS Safari/PWA y Android. Astra/Pro y manos libres siguen pendientes.

Mantener `ATENEA_STAGING_ACCESS_ENABLED`, `ATENEA_STAGING_AUTH_REVIEWED`, `ATENEA_VOICE_ENABLED`, `ATENEA_STAGING_ENABLED`, `ATENEA_LIVE_ENABLED`, `ATENEA_LIVE_REVIEWED` y `ATENEA_REAPER_READY` apagados fuera de procesos sintéticos de pruebas. Un CI verde no concede GO.

Fuentes: SDK/versionado y documentación oficial de Supabase Auth (`signInWithPassword`, `getUser`, renovación, signOut y sesiones); [precios oficiales](https://supabase.com/pricing); código y runbook del [PR #36](https://github.com/antoniodiaz70ad-dev/frequency-healer/pull/36). Sin cambios de esquema, RLS ni datos de producción.

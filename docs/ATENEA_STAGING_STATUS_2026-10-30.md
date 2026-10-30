# ATENEA: estado de staging al 30 de octubre de 2026

## Acceso disponible; voz todavía cerrada

La línea válida es el PR #40 con Supabase. El preview protegido sirve el commit `ee9c73787e4d797dda1ef618b38addcba2c73182` en `https://frequency-healer-git-codex-atenea-invitations-50c52f-leviathan1.vercel.app`. El PR #41 de Auth0 permanece separado, en draft y NO-GO; no se ha fusionado ni desplegado.

Las dos invitaciones autorizadas fueron entregadas. Una cuenta ya confirmó su correo, estableció su contraseña e inició sesión; la otra sigue pendiente de aceptación. No se necesita repetir el alta de la cuenta confirmada. Las direcciones, UUID y credenciales no se incluyen en este documento.

Supabase staging tiene SMTP configurado, registro público deshabilitado, confirmación de correo obligatoria y origen canónico HTTPS. La allowlist de usuarios y `ATENEA_STAGING_SESSION_ENABLED` están configurados en el Preview de esta rama. Redis dedicado está conectado; el runtime exige su configuración explícita. La clave del proveedor de voz fue autorizada para reutilización únicamente en este Preview.

`ATENEA_VOICE_ENABLED`, `ATENEA_STAGING_ENABLED`, `ATENEA_LIVE_ENABLED`, `ATENEA_LIVE_REVIEWED` y `ATENEA_REAPER_READY` continúan en `false`. `VOICE_AI_ENABLED` y `ATENEA_LOCAL_STAGING` también permanecen apagados. No se modifica producción ni se habilita audio.

## Programador preparado, aún no instalado

[El script de preparación](../ops/atenea/staging-reaper.sql) está limitado al proyecto Supabase aislado `rayebpxdfatsnkbderot`. Las extensiones `pg_cron` 1.6.4, `pg_net` 0.20.4 y `supabase_vault` 0.3.1 ya están instaladas. La operación de migración no devolvió confirmación; la consulta posterior verificó que **no existe** `atenea_ops.reaper_runs` y que hay **cero** jobs `atenea-preview-reaper`. El script no se presenta como aplicado ni probado en PostgreSQL.

La preparación propuesta crea un esquema privado con RLS, dos funciones sin acceso para los roles de aplicación y un job cada minuto que queda **desactivado en la misma operación**. No genera credenciales ni hace solicitudes de red. El job lee futuras credenciales desde Vault, nunca desde código, comandos cron o parámetros de URL. Solo conserva fecha, estado HTTP y contadores; los errores, respuestas completas y cabeceras no se copian al historial de ATENEA.

Se comprobó que `anon` y `authenticated` actualmente pueden leer `net.http_request_queue`. Esa cola contiene temporalmente las cabeceras HTTP: el script revoca ese acceso antes de permitir futuras solicitudes autenticadas. Vault no está accesible para esos roles. La revocación sigue pendiente porque la migración no se aplicó.

El endpoint tiene dos controles distintos: la protección de despliegue Vercel y el bearer propio `ATENEA_REAPER_TOKEN`. El rechazo de cualquiera de ellos debe impedir la tarea. Un HTTP 200 con `processed = confirmed = 0` solo demuestra que no había trabajo procesado en esa llamada; no acredita cierre remoto facturable. Un resultado parcial o fallido no confirma el cierre.

## Decisión de acceso pendiente

La revisión automática rechazó generar una credencial de automatización de Vercel por la restricción anterior de no crear bypass ni enlaces compartibles. No se creó esa credencial ni se desactivó la protección del proyecto.

La alternativa preparada requiere autorización explícita para **una credencial de automatización del proyecto Vercel**. Se usaría únicamente desde el programador, guardada en Supabase Vault, para llamar al endpoint de limpieza. Sin embargo, el permiso real de esa credencial puede atravesar la protección de otros despliegues del mismo proyecto: no está restringido técnicamente a este endpoint ni a esta rama. Su finalidad declarada no reduce ese alcance.

Antes de activar la tarea se requiere aplicar y verificar la migración, comprobar permisos de tablas y funciones, configurar ambas credenciales sin exponerlas, probar el rechazo sin autenticación y comprobar llamadas del programador con las banderas de creación apagadas. La tarea debe poder continuar cuando esas banderas se apaguen. Si se cambia el destino de despliegue, revisar de nuevo origen, protección y credenciales.

## Validación y trabajo pendiente

El [CI 40971449914](https://github.com/antoniodiaz70ad-dev/frequency-healer/actions/runs/40971449914) terminó correctamente sobre `ee9c73787e4d797dda1ef618b38addcba2c73182`. No se atribuyen a este SHA los contadores del CI anterior de `537ee3e`. El SQL nuevo requiere validación específica posterior; un CI verde de la aplicación no lo valida ni autoriza habilitar voz.

Antes de habilitar audio siguen pendientes la autenticación y ejecución real del programador, cierre confirmado del proveedor, aislamiento de cuentas, logout concurrente y pruebas de navegador/dispositivos. Además, el almacén Live de PR #40 conserva reservas con TTL y solo encola las reservas al asociar un identificador del proveedor. Deben revisarse reservas sin identificador, pérdida de metadatos y equidad de reintentos antes de considerar garantizada la conciliación. La existencia de cambios en PR #41 no acredita que estén incorporados aquí.

El presupuesto del proveedor es una alerta, no un límite de gasto ejecutado por la aplicación. La programación de limpieza por sí sola no resuelve el presupuesto global, las alertas operativas ni la conciliación completa. El auto-deploy de esta rama sigue bloqueado; este cambio no implica merge, publicación o promoción.

Los avisos de seguridad previos de Supabase permanecen: [pg_net instalado en public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) y [protección de contraseñas filtradas deshabilitada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No se modificaron esas opciones durante esta preparación.

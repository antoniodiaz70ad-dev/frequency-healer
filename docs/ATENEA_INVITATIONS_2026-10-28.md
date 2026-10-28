# ATENEA — aceptación de invitaciones de staging

## Estado y alcance

**NO-GO operativo.** Rama `codex/atenea-invitations-20261028`, basada en el PR #39 (`6e7ef002f076a868ca59995a90c5888a6b6c35c3`). El auto-deploy de la rama está bloqueado en ambos `vercel.json`. No se modifica producción ni se habilita voz.

El 28 de octubre de 2026 se confirmó mediante Vercel el registro de `miatenea.app` en el equipo Leviathan, DNS de Vercel y contacto del titular verificado. Renovación automática desactivada; vencimiento el 28 de octubre de 2027. Registro no equivale a sitio publicado ni remitente de correo verificado. No se publican datos del titular.

El proyecto Supabase canónico es `rayebpxdfatsnkbderot`. El registro público quedó desactivado; la confirmación de email continúa obligatoria y las cuentas anónimas están deshabilitadas. No se han enviado las dos invitaciones autorizadas ni se han creado usuarios. SMTP personalizado y el destino de alta real siguen pendientes; Site URL todavía apunta a localhost.

## Comportamiento

- Nueva ruta `/atenea-acceso/activar`, OFF por defecto. Requiere `ATENEA_STAGING_INVITATION_ENABLED=true`, acceso/revisión de staging, proveedor explícito, origen canónico y clave publicable. Solo preview o loopback declarado; producción se rechaza.
- El alta puede preparar credenciales antes de que exista la allowlist de UUID. No concede acceso a ATENEA: los endpoints de identidad, sesión y voz conservan su allowlist y sus controles existentes. No se emite cookie de aplicación ni se llama a esos endpoints.
- SDK oficial ya fijado en el lockfile, importado y construido únicamente tras enviar el formulario. El correo y código se envían con `verifyOtp({ type: 'invite' })`, sin consumir tokens de URL ni aceptar redirecciones.
- El SDK confirma la invitación; el cliente exige usuario no anónimo, correo confirmado e identidad coincidente. Antes de `updateUser({ password })` se consulta de nuevo `getUser()` y se comprueba la misma cuenta. La contraseña nunca se almacena ni verifica por código propio de la aplicación.
- Sesión de alta separada, solo RAM, sin auto-refresh ni importación desde URL. El paso de contraseña vence localmente diez minutos después de verificar el código. No hay service_role, credenciales SMTP, envío de invitaciones ni registro público en el cliente.
- Campos de código y contraseña vaciados al enviar. Errores del proveedor no se propagan a pantalla ni logs. Requests sin cookies, cache ni redirecciones; timeout de diez segundos.
- Doble envío bloqueado. Cerrar durante la verificación o consulta de usuario impide iniciar una escritura posterior y limpia respuestas tardías. Una escritura de contraseña que ya salió puede completarse después de salir: no se promete cancelación o rollback remoto.
- Después de guardar se solicita `signOut({ scope: 'local' })` de la sesión de alta, independiente del login normal. Un fallo de cierre se muestra como pendiente y permite reintento sin volver a guardar la contraseña. No se promete invalidación instantánea de todos los JWT del proveedor.

## Correo y puesta en marcha posterior

1. Crear/configurar el remitente transaccional. Se propuso Resend Free; su conexión SMTP exige dominio verificado y una credencial del proveedor. No se ha creado cuenta, generado clave ni cambiado DNS de correo. Las credenciales se introducen directamente en el servicio, nunca en PRs, logs o chat.
2. Verificar un subdominio de correo como `auth.miatenea.app` con los registros exactos que entregue Resend. Conservar los demás registros DNS. Desactivar tracking de aperturas y enlaces para estos correos. No ampliar acceso administrativo de Supabase para eludir las restricciones de su remitente integrado.
3. Preparar un preview protegido y probar su protección antes de usarlo como Site URL. La configuración observada de Vercel es `all_except_custom_domains`: **asignar un dominio personalizado no garantiza esa protección**. El dominio registrado puede servir para correo aunque la web de prueba use la URL protegida de Vercel. No se ha asignado el dominio a producción ni a un preview.
4. Configurar Site URL como origen HTTPS exacto, sin ruta ni barra final, y publicar esta pantalla únicamente tras autorización de despliegue. Mantener apagados los cinco flags de voz y `ATENEA_STAGING_SESSION_ENABLED` mientras se prueba solo el alta.
5. Instalar [la plantilla de invitación](atenea-invite-template.html), que muestra `{{ .Token }}` y enlaza a `{{ .SiteURL }}/atenea-acceso/activar` **sin credenciales en URL**. No usar la plantilla predeterminada de ConfirmationURL con este cliente. El código de invitación, su expiración y su uso único los valida Supabase.
6. Solo cuando URL, protección, SMTP y plantilla funcionen, enviar las dos invitaciones ya autorizadas por el propietario. Obtener sus UUID reales y configurar `ATENEA_STAGING_ALLOWED_SUBJECTS` en el ámbito de staging. No incluir direcciones personales en el repositorio.
7. Cada probador introduce su código y elige su contraseña. Verificar en el proveedor la confirmación del correo, login, expiración, rechazo de códigos inválidos/reutilizados y aislamiento. Aceptar la invitación no prueba acceso opaco Redis ni voz.

Las invitaciones y contraseñas se gestionan con el SDK/proveedor. No se agregan rutas de administración, contraseñas de ejemplo, recuperación simulada ni cuentas auto-confirmadas. Ante una invitación ya consumida cuyo alta no se completó, se requiere asistencia del administrador y un flujo de recuperación revisado; no se promete que reenviar la misma invitación funcione.

## Validación y límites

Pruebas de lógica: configuración OFF/producción/hosts/claves, separación de allowlist, verificación requerida, cuentas no confirmadas/anónimas/distintas, comprobación remota antes de escribir, caducidad local, cancelación con respuestas tardías, doble envío, errores privados, escritura incierta y cierre con reintento. Se ejecuta también la suite completa con Redis real.

Pruebas UI: SDK real con transporte interceptado de manera explícita para verificar las operaciones `verify`/`user`/`logout`, éxito, rechazo, cancelación tardía, fallo de logout, recarga y flag OFF. Cero micrófono, llamadas a voz, cookies y almacenamiento persistente de credenciales. **Este proveedor controlado no demuestra firma, entrega de correo, expiración ni replay reales de Supabase.** Esas pruebas permanecen pendientes con las dos cuentas externas.

El Chromium local previo ya no está disponible en el entorno. No se presenta esa ejecución local como aprobada; CI debe ejecutar la suite con el Chromium fijado. Los resultados definitivos se registran en el PR con el SHA correspondiente.

Referencias: [Supabase OTP](https://supabase.com/docs/reference/javascript/auth-verifyotp), [updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser), [plantillas](https://supabase.com/docs/guides/auth/auth-email-templates), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Resend y Supabase](https://resend.com/docs/send-with-supabase-smtp). Interfaces comprobadas en el SDK instalado; changelog revisado, sin cambio de dependencias.

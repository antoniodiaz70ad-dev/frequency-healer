# ATENEA — revocación concurrente y preparación de identidad

27 de octubre de 2026. Base: PR #37, `40612c69398283bb184dda1009fc7e51a0b32841`. Rama: `codex/atenea-session-revocation-20261027`. Draft dependiente de #37; auto-deploy bloqueado en ambos `vercel.json`.

**NO-GO para voz real.** Este cambio corrige el contrato de sesión de aplicación antes de conectar un proveedor de login. La pantalla Supabase de #37 sigue siendo una comprobación aislada de identidad. No convierte el rol `authenticated` de Supabase en permiso `atenea:voice`, no cambia el verificador RS256 y no emite una cookie de voz desde ese probe.

## Problema y comportamiento corregido

Una petición de voz podía autenticar la cookie, quedar esperando su cuerpo HTTP, completar un logout y después reservar cuota e iniciar una llamada. Revocar al terminar el cierre remoto dejaba además una ventana para nuevas reservas. La rotación separaba la emisión de la nueva cookie del borrado de la anterior, por lo que podía sobrevivir al logout concurrente.

- La creación usa exclusivamente la cookie opaca de aplicación. Los access tokens se aceptan en el intercambio autenticado de `/access`; un bearer directo no autoriza `/session`.
- Cada cadena de cookies tiene un identificador aleatorio de acceso en Redis. La rotación valida y reemplaza atómicamente la cookie dentro de la misma cadena. Las cookies anteriores solo conservan un identificador para cerrar esa cadena; no autentican nuevas peticiones.
- El logout elimina primero la autorización de la cadena y luego consulta la voz activa. La reserva comprueba esa autorización, la cookie, su propietario y su expiración en el mismo script Lua que reserva cuota y registra la creación. Redis ordena ambas operaciones: si gana logout no hay reserva; si gana la reserva, el cierre ve la operación pendiente.
- Antes y después de la llamada al proveedor se vuelve a comprobar el acceso. Una creación admitida que termina después del logout se cierra y no entrega su SDP cuando el acceso ya está revocado. Un fallo de esa comprobación también intenta el cierre. Si no se confirma, el registro persiste para el reaper.
- La cancelación antes de llamar al proveedor libera la marca de llamada activa, manteniendo el débito conservador de cuota.
- Un hash del JWT ya intercambiado identifica su cadena durante un máximo de una hora. El mismo JWT puede rotar una cadena vigente con su cookie; no puede abrir otra cadena ni reabrir una revocada. No se guarda el JWT.
- `200` de logout confirma revocación y cierre remoto observado. `202` confirma revocación pero no cierre remoto. Si Redis falla antes de revocar, se devuelve `503` sin borrar la cookie HttpOnly, para permitir reintento autenticado. La UI detiene el micrófono y bloquea nuevos inicios antes de esa solicitud.

Un logout no cancela atómicamente una operación externa ya admitida. Mientras el proveedor no haya entregado el ID de una creación pendiente, se devuelve `202`, nunca confirmación. Una respuesta perdida sin ID, el gasto global y la conciliación externa siguen siendo bloqueos de voz real.

## Retención y compatibilidad

Las claves comparten `{atenea-live}` para que los scripts operen en un mismo slot Redis. La autorización vigente no supera la expiración del JWT ni una hora. Los hashes de cookies anteriores y del JWT se retienen hasta una hora para rechazar replay y resolver logout concurrente; la retención no concede autenticación. No se almacenan contraseñas, audio, transcripciones ni JWT en Redis.

Las cookies con el formato interno anterior se rechazan. El entorno todavía no tenía sesiones reales y mantiene los gates apagados. El scheduler sigue cerrando registros de voz aunque se desactiven los flags de creación.

Esta revocación corresponde a la cadena de cookies de aplicación. No sustituye el logout del proveedor, la revocación global de una cuenta, ni impide que una autenticación externa nueva y autorizada abra una sesión nueva. Esos contratos, incluida la renovación con un token nuevo sin cookie previa, deben resolverse en la integración de login. Supabase `signOut` por sí solo no convierte todos los JWT emitidos en inválidos inmediatamente.

## Recursos observados y configuración pendiente

- El PR #37 referencia `frequency-healer-atenea-staging`, proyecto `rayebpxdfatsnkbderot`, región `us-east-2`, activo. Es el proyecto canónico para preparar el acceso. La comprobación de solo lectura no encontró tablas públicas, usuarios Auth, sesiones Auth ni buckets.
- También existe `atenea-staging`, proyecto `uxsagtoewrkveihwwkrw`, creado desde esta conversación. Está vacío y duplicado. El intento de pausa fue rechazado por Supabase porque el proyecto está en Pro. No se degrada la organización ni se elimina el proyecto sin resolver expresamente esa acción irreversible.
- La configuración de preview se limita a esta rama: URL y clave publicable moderna existentes del proyecto canónico, referencia de producción Base 60 prohibida y gates OFF. El origen HTTPS y la lista de sujetos se mantienen pendientes; no se inventan IDs de probadores ni se exponen claves en el repositorio.
- Faltan cuentas autorizadas, registro público deshabilitado y ajustes Auth comprobados, origen de preview protegido, adaptación del proveedor al contrato de sesión, Redis de staging, scheduler, alertas y presupuesto global. No se configura una clave de voz.

## Evidencia

Las nuevas pruebas ejecutan las rutas reales, JWT sintéticos firmados y scripts sobre Redis real de loopback. El proveedor de voz es controlado para detener la creación exactamente durante las carreras; no se llama a una API facturable.

Se cubren cuerpo HTTP pendiente durante logout, resultado tardío del proveedor, cierre sin confirmar seguido de reaper con creación OFF, renovación antes y durante logout, rechazo de autoridad obsoleta, replay del JWT usado, aislamiento entre cuentas, expiración, bearer directo y caída de la comprobación posterior a crear. Esto no acredita un login Supabase real ni dispositivos físicos.

El CI guarda los logs completos de calidad y builds ON/OFF tanto en éxito como en fallo e incluye auditoría de todas las dependencias. El resultado local y el SHA de CI se registran en la descripción del PR. Un CI verde no autoriza fusionar, desplegar o activar flags.

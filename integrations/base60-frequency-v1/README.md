# Frequency Healer ↔ Base60: contrato v1 y encargo de implementación

Actualizado: 2026-10-25. Estado: **implementación en borrador, desactivada por defecto**. Ya existen paneles de intercambio, API y migración con RLS. No está activado en producción ni validado con autenticación real en staging. Consulta [IMPLEMENTATION.md](IMPLEMENTATION.md) para el estado actual; las secciones de encargo siguientes conservan el diseño inicial.

## Resultado solicitado

Desde Mi Tiempo, abrir Respiración y atención en Frequency Healer. Después de guardar la sesión local, seleccionar los datos que se quieren compartir. Revisar el resumen en Base60 y confirmar su guardado en el diario. Más tarde, registrar qué ocurrió con la acción elegida. La integración no prescribe frecuencias según astronomía ni interpreta cambios subjetivos como mediciones fisiológicas.

## Base verificada

- Frequency Healer: main `43261ef6090113c100a2328ab27c83b1dc40c47b`; Bentov #25 fue fusionado en GitHub. El módulo guarda sesiones en localStorage, carece de identidad propia para este intercambio y no implementa el puente.
- Base60: `885624a61cb61baec02032a3a6e29138b55c55a0`, rama `codex/platform-functional-review`, PR #31. Mi Tiempo y el diario actual están en esta cadena de revisión; no partir de main suponiendo que contiene esas pantallas.
- `components/LunarPersonalJournal.tsx` inserta en `lunar_personal_journal` con sesión Supabase. No posee campos de procedencia/idempotencia ni un modelo de seguimiento de acciones externas. No esconder metadatos en notes ni reutilizar energía/ánimo como tensión/claridad: son escalas diferentes.
- El esquema completo de las tablas lunares no está reproducido en las migraciones versionadas inspeccionadas. Inspeccionar y reproducir en staging antes de elegir claves y relaciones; no inferir autorización a partir del componente cliente.
- PR #31 documenta permisos de base pendientes de validar. No probar este puente contra registros reales ni aplicar cambios a producción.

## Decisiones de la primera versión

1. **Identidad:** Base60 conserva la identidad autenticada. Frequency Healer sigue funcionando localmente, sin nueva cuenta ni tokens de Supabase. El servidor determina user_id a partir de la sesión verificada; nunca desde el cuerpo enviado por el navegador.
2. **Transporte:** ventana de práctica abierta explícitamente desde Base60 y mensajes postMessage con origen exacto, referencia de ventana y canal aleatorio. El mensaje solo prepara una vista previa; la API de Base60 recibe la confirmación desde su propio origen. No es SSO ni una API pública servidor-a-servidor.
3. **Persistencia:** nuevo registro estructurado de práctica externa, visible en el diario actual. Summary original inmutable; seguimiento separado y versionado. Clave única `(user_id, source, source_session_id)` y transacción para importación/consumo de flujo. Una pausa no desaparece del resumen.
4. **Consentimiento:** las cuatro selecciones de contenido empiezan desmarcadas: observación, interpretación, acción y escalas. Mostrar también los metadatos mínimos obligatorios antes de compartir. Una segunda confirmación en Base60 guarda en la cuenta/perfil mostrados. Cancelar cualquiera de las dos pantallas no importa nada.
5. **Primera práctica:** solo Bentov v1.1, sin modificar 14 días, 7/7, 600 segundos, pauta 5+5 o el modo natural. No transportar datos astronómicos, perfil natal, grabaciones, historial completo ni contexto Gene Keys en esta versión.

## Recorrido y protocolo de navegador

1. Base60 muestra «Practicar respiración y atención» y la cuenta/perfil de destino. Requiere selección explícita si hay varios perfiles. La API verifica que el perfil pertenece al usuario.
2. `POST /api/integrations/frequency-healer/flows` crea un flujo de 60 minutos ligado al usuario, perfil y al par de orígenes configurados. Devuelve `{flowId, channel, expiresAt, practiceUrl}`. Ambos identificadores son UUID v4 generados con CSPRNG; channel sirve para correlación, no para autorizar escrituras.
3. El botón abre una ventana de espera sincrónicamente durante el gesto del usuario y la navega cuando la API responde; cerrarla ante errores. Si el navegador bloquea la apertura, mostrar «Abrir práctica» con un segundo gesto. Mantener referencias de las dos ventanas. Sin iframe como atajo.
4. El enlace lleva solo `flowId`, `channel` y un origen Base60 previamente permitido en el fragmento. Nunca textos, identidad, escalas, tokens de acceso ni returnUrl arbitraria. Frequency Healer valida el origen contra su configuración exacta; no confía en el fragmento para ampliar la lista. No hay wildcard de previews ni `targetOrigin='*'`.
5. Handshake sin contenido personal `fh.ready` / `base60.ready`, versión 1, flowId y channel. Base60 solo responde a la ventana que abrió; FH solo acepta a su opener y al origen configurado. El mensaje de respuesta comunica expiresAt. Rechazar entradas inesperadas y remover listeners al cerrar/cancelar.
6. La práctica se inicia únicamente por el usuario, sin audio automático. Al acabar, se guarda localmente de forma explícita. En la pantalla de compartir se elige una sesión guardada y se presenta el resumen exacto.
7. Tras confirmar, FH emite `{type:'fh.summary', version:1, flowId, channel, summary}` al origen exacto de Base60. El receptor aplica `acceptSummaryEvent`, muestra el contenido escapado y aún no escribe en base.
8. «Guardar en mi diario» envía a la API same-origin. Confirmar sesión/usuario vigentes y ownership del flujo de nuevo. El perfil queda fijado en el flujo; cambiar de perfil requiere otro flujo. Cambiar de cuenta durante la práctica invalida el destino anterior.
9. Solo tras persistencia confirmada, Base60 devuelve `{type:'base60.saved',version:1,flowId,channel,sessionId,entryId}`. FH valida origen, ventana, canal y sesión antes de mostrar «Guardado en Base60». No borrar el original local.
10. Si falla la red, se conserva el registro local. Reintentar usa el mismo sessionId. Si el flujo venció, abrir uno nuevo para compartir la sesión guardada, sin repetir la respiración. Al recargar cualquiera de las ventanas se pierde el canal en memoria: reconectar explícitamente; no autoenviar ni fingir un ACK.

COOP, protección de Vercel o navegación entre aplicaciones pueden cortar opener. Probar este escenario: cancelar el canal y ofrecer reconectar; no debilitar cabeceras de seguridad o autenticación para hacerlo funcionar. Soporte móvil con estas ventanas es una prueba de aceptación pendiente, no una garantía de este contrato.

## API propuesta: solo Base60, autenticada y same-origin

Prefijo `/api/integrations/frequency-healer`. No implementar CORS abierto. Toda mutación exige sesión verificada, Origin exacto, JSON y protección CSRF acorde con la aplicación. No basar autorización en `getSession()` sin verificación. Respuestas privadas `Cache-Control: no-store`; no registrar bodies, notas, cookies ni channel en logs/telemetría. Rate limit por usuario. Flag de servidor apagado por defecto devuelve 404 antes de acceder a datos.

| Operación | Entrada | Resultado |
|---|---|---|
| POST `/flows` | `{profileId}` | 201 flujo ligado a usuario/perfil; 404 si perfil no es propio |
| POST `/sessions` | `{flowId,channel,summary,consent:{confirmed:true,revision:1}}` | 201 inserción; 200 reintento idéntico; 409 mismo ID con otro contenido |
| GET `/sessions?profileId=…&cursor=…` | Filtro propio y cursor validado | 200 lista paginada de resúmenes propios con seguimiento |
| GET `/sessions/:entryId` | Identificador | 200 registro propio; 404 inexistente/ajeno |
| PATCH `/sessions/:entryId/followup` | `{expectedRevision,status,observation,nextAction}` | 200 revisión siguiente; 409 si cambió desde la lectura |
| DELETE `/sessions/:entryId` | Confirmación explícita en UI | 204 elimina copia en Base60 y seguimiento; no borra FH |

Errores JSON con código estable y mensaje sin datos privados: 400 cuerpo/sintaxis; 401 sesión ausente; 403 Origin/CSRF inválido; 404 recurso no visible; 409 conflicto; 410 flujo vencido; 413 cuerpo >32 KiB; 422 campos/fechas inválidos; 429 límite; 503 almacenamiento no disponible. El límite del cuerpo se aplica al stream antes de parsear, no solo a Content-Length. `contract.mjs` limita adicionalmente el resumen ya parseado; no reemplaza esa defensa HTTP.

## Idempotencia, seguimiento y datos

- `contract.mjs` define los campos exactos del resumen y permite construirlo desde Bentov mediante `selectSummary`. No usar spread del registro local. Ceros se preservan; respuestas omitidas son null. Campos no seleccionados deben ser null. Rechazar propiedades desconocidas.
- Fechas UTC ISO con milisegundos. Tiempo activo entero 0–600000; completada exige 600000; fin no anterior a inicio y duración real no menor que activa. Guardar también recepción y zona IANA de contexto en Base60, calculadas/validadas allí. Nunca derivar el día local usando solo ISO.slice(0,10).
- La procedencia declara «registro personal importado»; no certifica que la práctica ocurrió. No hay sensores ni evidencia fisiológica firmada.
- Antes de insertar: ownership del flujo y perfil, TTL y consentimiento. La selección y el contenido mostrado se conservan como recibo de consentimiento con hora del servidor; no son una firma del usuario.
- La restricción única debe resolver doble clic/concurrencia en DB, no con un SELECT seguido de INSERT sin protección. Bajo conflicto, recuperar la fila propia y comparar contenido canónico validado (`classifyReplay`). Devolver el mismo entryId solo para contenido idéntico; no sobrescribir el original.
- Consumir flujo y crear registro en la misma transacción. Un flujo consumido por otra sesión no se reutiliza. Para respuesta perdida, la repetición idéntica de la sesión ya asociada al flujo devuelve el mismo registro, incluso si el reloj acaba de vencer; no permite una nueva inserción caducada.
- Seguimiento inicial pending, revision 0. UI: «La hice», «Sigue pendiente», «Quiero cambiarla» y «Qué ocurrió». Cambiar acción guarda nextAction sin reescribir la original. PATCH comprueba expectedRevision atómicamente. Historial y comparación de escalas no cambian con el seguimiento.
- Revocar conexión impide transferencias nuevas; no borra importaciones previas sin instrucción. Eliminar una copia no promete borrado de la otra aplicación. Exportación de Base60 debe incluir procedencia, selección y seguimiento. Reimportar explícitamente una sesión eliminada puede crear una nueva copia; no se restaura automáticamente.
- Tablas con RLS por propietario, UPDATE con USING y WITH CHECK, permisos mínimos. Base60 usa el cliente autenticado y las políticas existentes correctamente verificadas; no exponer service_role. Si hace falta función transaccional, preferir SECURITY INVOKER con constraints y ownership, no usar SECURITY DEFINER como atajo.

## Encargo por repositorio

**Base60 (rama desde PR #31, no main):**
- [ ] Inspeccionar esquema en staging, preparar migración sin aplicarla a producción; tablas de flows/prácticas externas/seguimiento y constraints, RLS y permisos mínimos.
- [ ] Implementar endpoints anteriores y casos de sesión ausente, usuario B, perfil ajeno, expiración y concurrencia real.
- [ ] Botón en Mi Tiempo, receptor/vista previa de consentimiento, importaciones integradas en diario existente y seguimiento editable con revisión.
- [ ] Estado vacío, permiso caducado, reconexión y exportación/borrado comprensibles.

**Frequency Healer (rama desde main verificado):**
- [ ] Integrar contrato con adaptador tipado y configuración de orígenes exactos; handshake y envío solo con confirmación.
- [ ] Panel posterior al guardado y selección de una sesión guardada para reintentar; no exportar sesión incompleta como completed.
- [ ] Corregir en el flujo Bentov el péndulo que continúa durante práctica; detener/desmontar al iniciar, especialmente modo natural. Reiniciar formularios entre sesiones para no compartir respuestas antiguas.
- [ ] Almacenar solo acuse mínimo si se necesita; nunca tokens/identidad Base60. Manejar cuota y canal perdido sin borrar registro.
- [ ] Mantener audio, cimática, Sintonizar mi día y protocolo Bentov independientes.

## Pruebas y condición de aceptación

Ejecutar `node --test integrations/base60-frequency-v1/contract.test.mjs` desde la raíz de cualquiera de los repositorios. No necesita instalar dependencias. Las copias del directorio deben ser idénticas hasta adoptar un paquete compartido versionado.

Estas pruebas comprueban contrato/selección, 0/null, rechazo de campos/fechas/estados, límite UTF-8, procedencia del mensaje y comparación de reintentos. **No prueban persistencia, autenticación, unicidad en DB, navegador, endpoints ni la integración entre aplicaciones.**

Aceptación posterior obligatoria:
- [ ] Dos cuentas sintéticas aisladas: B nunca lee, modifica ni importa flujo de A; perfil ajeno rechazado; cambio de cuenta durante práctica rechazado.
- [ ] Recorrido real: Mi Tiempo → práctica → selección FH → confirmación Base60 → diario → seguimiento → recarga persistida.
- [ ] Doble clic y dos requests concurrentes crean una fila; reenvío idéntico devuelve mismo ID; cambios de contenido dan 409.
- [ ] Desmarcar escalas/textos evita su transmisión. 0 y null sobreviven ida/vuelta y exportación.
- [ ] Sin confirmación no hay importación. Error/timeout nunca muestra «Guardado» antes del ACK confirmado.
- [ ] Cierre, refresh, TTL, ventana bloqueada, COOP, móvil Safari/Chrome y origen falso manejados explícitamente.
- [ ] Filtrado por perfil propio, edición obsoleta, borrado y exportación; conservación de registro FH.
- [ ] Flags OFF, lint, TypeScript, tests y build de ambas aplicaciones; CI falla realmente ante tests fallidos (verificar pipefail si se usa tee).

No conectar un preview a datos reales para simular estas pruebas. Sin staging confirmado, reportar la validación pendiente. Conservar ambos PR en borrador y no activar flags ni promover a producción automáticamente.

## Referencias contrastadas

- [MDN: postMessage y validación de origen/ventana](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage).
- [Supabase: clientes SSR y verificación de identidad](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
- [Supabase changelog](https://supabase.com/changelog), consultado 2026-10-24. Se revisaron avisos recientes; no se cambia SDK ni configuración de Auth en esta entrega.

El modelo aquí es una decisión de diseño para el primer circuito, no una afirmación de que ya existía una API compartida ni una integración funcionando.

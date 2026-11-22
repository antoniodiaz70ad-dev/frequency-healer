# ATENEA — Documento de continuidad y entrega a Codex

**Fecha de consolidación:** 2026-11-01  
**Fuente de trabajo:** Issue #32 · Frequency Healer  
**Estado:** NO-GO para voz real y producción  
**Prioridad actual:** entregar y utilizar **MVP ATENEA Voz en staging privado**. ATENEA Core y la integración completa entre plataformas son fases posteriores.  
**Regla de seguridad:** no publicar secretos ni desbloquear sesiones pagadas hasta probar autenticación, cierre remoto, cuotas y limpieza automática.

> Este documento conserva decisiones, arquitectura, resultados de auditoría y backlog. No constituye prueba de que se haya implementado o desplegado alguna función adicional.

## 1. Propósito de ATENEA

ATENEA será un asistente de inteligencia personal y estratégica que ayude, **primero por voz**, a:
- reconocer pensamientos, impulsos y patrones automáticos sin asumir que puede leer o diagnosticar estados mentales;
- practicar **recuerdo de sí** y atención dividida (Gurdjieff y Ouspensky);
- recuperar claridad antes de tomar una decisión;
- distinguir hecho, interpretación, emoción autodeclarada, impulso, alternativas, riesgos y acción elegida;
- registrar voluntariamente una reflexión en el diario y, posteriormente, recuperar contexto autorizado desde distintas plataformas.

La voz debe ser una interfaz de **baja fricción**: frases cortas, una pregunta por turno, interrupciones naturales, silencios de 30–60 segundos y cierre verbal, sin leer ni cambiar de pantalla. No confundir atención consciente con inducción de trance, disociación o estados cerebrales extraordinarios.

## 2. Referentes intelectuales y criterios de evidencia

- **Gurdjieff:** atención, mecanicidad, muchos «yoes», identificación, voluntad deliberada, recuerdo de sí.
- **P. D. Ouspensky:** el observador/observado, experiencia de presencia, atención simultánea y percepción subjetiva del tiempo.
- **Itzhak Bentov:** apoyo conceptual para experimentar con cuerpo, respiración natural y ritmos; sus modelos cosmológicos son hipótesis no validadas científicamente.
- En producto, las observaciones son **autoinformes**, no mediciones científicas directas de conciencia, emociones, estados neurológicos o alteraciones físicas del tiempo.
- No usar nombres esotéricos como si fueran diagnósticos. ATENEA debe apoyar la agencia del usuario, jamás decidir sin autorización.

## 3. Funciones del MVP de voz

### Modo Observador (objetivo: sesión completa de diez minutos)
- Inicio explícito con permiso de micrófono.
- Guía breve de atención al cuerpo y al entorno, **con ojos abiertos si es necesario**.
- Práctica de «estoy aquí, observando» sin exigir respuestas continuas.
- Silencios reales de al menos 60 segundos sin pérdida de sesión ni intervención automática.
- Comandos: «más silencio», «repite», «continúa», «pausa» y «terminar».
- No inducir a cerrar ojos ni realizar ejercicios absorbentes mientras se conduce o usa maquinaria.

### Modo Decisión Consciente
- Activar por «ATENEA, necesito decidir» durante sesión voluntaria.
- Separar la situación en: hechos comprobados, interpretación, emoción declarada, impulso, datos faltantes, alternativas, riesgos, reversibilidad y siguiente paso.
- Ofrecer **una pregunta por turno**, sin explicar demasiado mientras el usuario practica.
- Una decisión financiera, jurídica, médica o irreversible requiere cautela y validación externa apropiada.
- Modo análisis profundo «profundiza» solo por orden explícita y sujeto a presupuesto; no interrumpir observación para analizar de oficio.

### Modo Diario Hablado
- Relato por voz; resumen leído para aprobación.
- Opciones: `no guardar`, `solo métricas`, `guardar resumen revisado`.
- Nada de audio ni transcripción integral almacenados por defecto; exportación y eliminación posteriores.
- El silencio **no equivale a consentimiento**.

## 4. Arquitectura técnica acordada

- UI del MVP: Frequency Healer / ruta aislada `/atenea-voz`, con flags cerrados inicialmente.
- Voz bidireccional: **GPT-Live-1** mediante integración WebRTC segura y credenciales del servidor; verificar modelo/API y capacidad de cuenta antes de habilitar.
- Análisis delegado: **GPT-6 Astra** para respuesta habitual; modo Pro solo a solicitud expresa. Confirmar identificadores y parámetros de API durante implementación.
- Almacenamiento autorizado: Supabase staging, sesiones revocables mediante Redis, políticas RLS donde apliquen.
- `OPENAI_API_KEY` **nunca** al navegador, GitHub, issue, archivo o chat.
- Evitar escuchar permanentemente la palabra clave; el usuario activa la sesión manualmente.
- Frecuencia Healer PR #29 y Base 60 PR #32 preparan **puente de resúmenes**, pero permanecen separados del cierre del MVP.

### ATENEA Core — futuro, no bloqueo de MVP
Extraer un servicio independiente de voz, identidad, permisos, memoria contextual y herramientas. Cada plataforma conserva almacenamiento y permisos de dominio; ATENEA solo accede a información solicitada y autorizada. Evitar un repositorio indiscriminado que mezcle información privada, empresarial, financiera y experimental.

## 5. Aplicación por plataforma

| Plataforma | ATENEA puede aportar | Condición |
|---|---|---|
| Frequency Healer | Modo Observador; prácticas guiadas y sesiones de atención | Voz y privacidad validadas |
| Base 60 | Diario, experiencia del tiempo, seguimiento de decisiones y autoobservación | Consentimiento explícito, API versionada, RLS |
| Segundo Cerebro | Recuperación de fuentes, conocimientos, vínculos entre ideas y decisiones | Conector autorizado; procedencia |
| Aletheia Guard | Apoyo a investigación de expedientes y lectura de riesgo | Controles específicos, privacidad, verificación y revisión humana |
| ATLAS y Leviathan | Análisis estratégico y operacional con trazabilidad de evidencias | Datos segregados, roles, prohibición de automatizar decisiones irreversibles |
| TokenForge y otros sistemas | Análisis documental, operativo y de procesos bajo permisos | Integración incremental, sin declarar funcionalidad inexistente |

## 6. Estado observado en GitHub y Vercel

- Issue principal [Frequency Healer #32](https://github.com/antoniodiaz70ad-dev/frequency-healer/issues/32) y diseño [PR #31](https://github.com/antoniodiaz70ad-dev/frequency-healer/pull/31).
- [PR #33](https://github.com/antoniodiaz70ad-dev/frequency-healer/pull/33): MVP simulado y backend de voz preparado, **draft / NO-GO**.
- [PR #36](https://github.com/antoniodiaz70ad-dev/frequency-healer/pull/36), [#37](https://github.com/antoniodiaz70ad-dev/frequency-healer/pull/37), [#38](https://github.com/antoniodiaz70ad-dev/frequency-healer/pull/38), [#39](https://github.com/antoniodiaz70ad-dev/frequency-healer/pull/39), [#40](https://github.com/antoniodiaz70ad-dev/frequency-healer/pull/40): configuración/seguridad/acceso/sesiones/invitaciones de staging, **draft**, con dependencias entre ramas.
- [PR #41](https://github.com/antoniodiaz70ad-dev/frequency-healer/pull/41): mejora adicional de *session fencing* y revocación. Su rama diverge de #40; **no se fusionan sin consolidación explícita**.
- PR #42 (CI) y #43 (actualización de seguridad Next.js) constaron como **merged** en `main`; despliegue de producción `READY` por seguridad, pero **no implica que ATENEA Voz real esté habilitada**.
- Preview de rama `codex/atenea-invitations-20261028`: último despliegue `READY` observado SHA `ee9c73787e4d` y HEAD de PR #40 `39d22dfe84`: **diferencia de versión**; preparar Preview nuevo del árbol reconciliado, no confiar en despliegue anterior.
- Modelos de voz y clave: existe una variable de `OPENAI_API_KEY` marcada sensible en Preview de esa rama; **no se probó conexión ni permisos**.
- Los flags `ATENEA_VOICE_ENABLED`, `ATENEA_STAGING_ENABLED`, `ATENEA_LIVE_ENABLED`, `ATENEA_LIVE_REVIEWED` y `ATENEA_REAPER_READY` se verificaron `false` en Preview. No activarlos antes del GO.
- Frequency Healer [PR #29](https://github.com/antoniodiaz70ad-dev/frequency-healer/pull/29) y Base 60 [PR #32](https://github.com/antoniodiaz70ad-dev/base60-platform/pull/32) siguen en borrador.

## 7. Supabase staging y bloqueo exacto

- Proyecto Supabase `frequency-healer-atenea-staging`, ref `rayebpxdfatsnkbderot`, activo en la auditoría.
- Extensiones `http`, `pg_cron`, `pg_net` presentes.
- Funciones `atenea_ops.run_reaper_direct`, `enqueue_reaper`, `collect_reaper_results` y tabla `atenea_ops.reaper_runs` presentes.
- Cron `atenea-preview-reaper` creado **pero `active=false`**.
- Vault: `atenea_preview_vercel_automation_token` presente; **`atenea_preview_reaper_token` ausente** en la última comprobación (2026-11-01).
- El usuario autorizó generar y sincronizar una **credencial exclusiva de staging**. La variable sensible `ATENEA_REAPER_TOKEN` fue actualizada **solo** para el Preview de `codex/atenea-invitations-20261028`.
- La operación para registrar la misma credencial en Supabase Vault fue **bloqueada por controles de seguridad**. En consecuencia, **la rotación está incompleta**.
- **No revelar ni recuperar en este documento el valor de ninguna clave.** No activar cron ni voz cobrable con los secretos fuera de sincronía.
- Para evitar manejar valores a través de herramientas no permitidas: titular/administrador debe generar un **nuevo** secreto mediante gestor de contraseñas y guardarlo usando las UI oficiales en los dos lados (`vault: atenea_preview_reaper_token`; Vercel branch-preview: `ATENEA_REAPER_TOKEN`). No reutilizar una credencial cuyo valor no pueda comprobarse, no copiar a issues, comentarios, chats o logs.
- Después de confirmar ambos lados, probar **funcionalidad**, no comparar material secreto visible.

## 8. Backlog para Codex, en orden estricto

### P0 — Control de versiones y cierre de autenticación
1. Leer este documento e Issue #32 antes de escribir código. Auditoría de PR #33–41; no empezar módulos nuevos.
2. Consolidar las funcionalidades **correctas** de las ramas #40 y #41 sobre `main` ya actualizado en CI/seguridad. Mantener integración de acceso `supabase-staging`; no mezclar de manera implícita un login Auth0 no configurado.
3. Crear **una rama y un PR draft de integración**; no fusionar a `main` ni disparar production deploy. Mantener todos los flags OFF.
4. Tests de revocación, rotación de sesión, doble inicio, creación tardía de voz, cierre ambiguo y reaper.
5. Confirmar condiciones de autenticación, invitaciones, origin allowlist y CSRF.

### P0 — Reaper y secretos (operación controlada)
1. **No usar secretos recuperados, expuestos o pasados por este Issue.**
2. La sincronización de la nueva clave en Supabase Vault y Vercel requiere **acción segura del titular**, dado bloqueo de herramienta; no intentar eludir controles.
3. Verificar URL fija de endpoint de reaper y alineación con el nuevo Preview; la SQL actual puede apuntar a URL anterior.
4. Probar llamada autenticada de reaper con cero sesiones o sesión sintética, sin efectos sobre terceros.
5. Solo después de comprobar cierre, scheduler, logs sanitizados y reversión, pedir **GO explícito** para habilitar el cron en staging.

### P1 — Voz real privada
1. Desplegar un Preview del commit exacto en rama de integración, proteger acceso y comprobar configuración sin exponer valores.
2. Probar autenticación real de cuenta autorizada y `OPENAI_API_KEY` con llamada mínima facturable bajo presupuesto.
3. Verificar WebRTC, latencia e interrupción hablada; sesión de 10 minutos con silencio de 60 s; cierre por voz; cancelación por logout, corte de red, cambio de pestaña, error de proveedor y límites de cuota.
4. Confirmar que se libera el micrófono y no quedan sesiones remotas cobrables. No afirmar «terminada» cuando el proveedor no lo confirma.
5. Test de 3 modos Observador/Decisión/Diario, privacidad, confirmación de resumen y «no guardar». Safari iOS, Chrome Android y escritorio, anotando restricciones de pantalla bloqueada.
6. Reportar link Preview probado, SHA, coste real aproximado, checks con evidencia, riesgos residuales y **GO/NO-GO**. No publicar producción sin autorización.

### P2 — Integración Base 60
- Reconciliar contratos PR Frequency #29 / Base 60 #32, API versionada, auth, RLS y consentimiento granular.
- Guardar únicamente métricas o resumen revisado, no audio/transcripción por defecto.
- Pruebas de identidad cruzada, duplicados, borrado, exportación y carga de historial.
- No atribuir causalidad a tránsitos o frecuencias sin prueba.

### P3 — ATENEA Core
- Diseñar un servicio multicliente con conectores autorizados, permisos, memoria auditable y procedencia por dato.
- Incorporar Segundo Cerebro, Aletheia Guard, ATLAS/Leviathan y otras apps **solo después** del MVP de voz probado.

## 9. Criterios de aceptación / NO-GO

- Sin micrófono encendido antes de inicio voluntario; **terminar** detiene captura y conexión local de inmediato.
- Cierre remoto confirmado o error explícito + reaper activo y probado; no pérdida silenciosa de seguimiento.
- No hay acceso sin autenticación; cuotas persistentes, seguridad de origen, secretos en backend y logs sin contenido privado.
- Sin respuestas automáticas que rompan silencios de práctica.
- Modo Pro nunca se activa sin consentimiento explícito.
- En la sesión puede usarse voz sin cambiar de pantalla; si el sistema operativo impide continuar con pantalla bloqueada, se declara el límite.
- No se guardan contenidos privados ni se comparten entre plataformas sin consentimiento.
- Build, typecheck, lint, unit/integration, WebRTC E2E y smoke ON/OFF pasan sobre el mismo SHA.
- Producción se mantiene sin cambios hasta nuevo GO expreso.

## 10. Próximo mensaje operativo esperado de Codex

> «He reconciliado los PR #40/#41 sobre la rama segura, generado PR de integración draft y ejecutado las pruebas locales/CI. El secreto reaper Vault sigue pendiente de configuración por el titular; no activé cron ni LIVE. Aquí está el SHA, el enlace Preview, el resultado de cada prueba y cualquier bloqueo restante».

**En caso de bloqueo humano, pedir solo una acción concreta; no solicitar repetir toda la historia.**

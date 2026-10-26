# ATENEA Voz v1 — Especificación implementable (borrador)
**Fecha:** 2026-10-26  
**Proyecto:** Frequency Healer + Base 60  
**Estado:** Diseño y plan de ejecución, **NO IMPLEMENTADO / NO DESPLEGADO**  
**Rama de trabajo:** `codex/atenea-voz-architecture-v1`

## 0. Objetivo y límites

Crear un modo **Voice First, Screen Optional** para entrenar el *recuerdo de sí* (Gurdjieff/Ouspensky), acompañar una pausa consciente y ayudar a estructurar decisiones **sin necesidad de leer ni cambiar de pantallas**. El objetivo es la atención consciente, **no inducir trance, disociación ni estados clínicos**. El usuario mantiene siempre el control de su decisión.

No identificar pensamientos, emociones o conciencia a partir de señales de voz sin validación; lo declarado por la persona es un **autoinforme**. Las hipótesis de Bentov son inspiración pedagógica, nunca efectos físicos demostrados. No se requieren frecuencias acústicas específicas.

**No tocar producción** ni alterar el flujo actual `/voz`, `/respiracion-atencion` ni el módulo Bentov. Construir ruta y servicios nuevos detrás de *feature flag* desactivado por defecto.

## 1. Auditoría rápida de las bases existentes

- Frequency Healer: Next.js en `frontend`, ruta `frontend/src/app/voz/page.tsx`, `VoiceJourney` y `VoiceOrchestrator`. Voz actual basada en captura y dictado (Web Speech API o proveedor), no en una sesión full-duplex. Existe consentimiento de privacidad `PrivacyGate` y controles de ciclo de audio.
- Puente a Base 60 en progreso: Frequency Healer PR #29 (`codex/base60-frequency-contract-v1`) comparte resúmenes seleccionados; Base 60 PR #32 (`codex/base60-frequency-contract-v1`) los recibe y guarda bajo autenticación. Ambos **draft**. **No duplicar, sobreescribir ni saltar** la verificación de origen, consentimiento y RLS.
- Base 60 usa Next.js y Supabase auth / Postgres / RLS; comprobar el estado efectivo de ramas, migraciones y CI al integrar.
- Esta rama se crea desde `main` **independiente** del puente; abrir PR draft. Integrar únicamente después de revisar compatibilidad con #29/#32.

## 2. Motores y política de enrutamiento

| Uso | Modelo API | Configuración |
| --- | --- | --- |
| Voz bidireccional durante sesión | `gpt-live-1` | Live API, WebRTC, `es-MX`, voz estable, interrupciones y silencios |
| Análisis normal de decisión, bajo demanda | `gpt-6-astra` | Responses, `reasoning: {mode:"standard", effort:"low"}` inicialmente |
| Revisión profunda iniciada por el usuario | `gpt-6-astra` | Responses, `reasoning: {mode:"pro", effort:"high"}` evaluado en tests; nunca automático |
| Modo contemplativo | GPT-Live sin consultas analíticas salvo solicitud explícita | Silencios planificados, sin preguntas constantes |

No confundir ChatGPT Pro con crédito/API. Todo acceso a modelos está sujeto a disponibilidad en la cuenta y facturación independiente; permitir degradación segura cuando falten credenciales. El usuario **nunca** configura claves en el cliente.

Documentación de proveedor: https://developers.openai.com/api/docs/guides/live y https://developers.openai.com/api/docs/guides/reasoning

## 3. Experiencia de voz

### Modos de sesión
1. **Observador (10 minutos):** entrada, atención al cuerpo y entorno, recuerdo de sí, silencios auténticos, cierre y reflexión opcional. Nunca inferir que el usuario entró a un estado superior. Se permite "más silencio", "menos voz", "repite", "terminar".
2. **Decisión consciente (1–3 minutos):** escuchar el contexto; distinguir `hechos / interpretación / emoción_autodeclarada / impulso / alternativas / riesgos / acción_elegida`; una pregunta por turno; no decidir ni ejecutar acciones externas.
3. **Diario hablado (2–5 minutos):** relato libre, resumen verbal, consentimiento de guardado. No guardar por defecto audios ni transcripciones completas.

### Comandos manos libres
`ATENEA, modo observador`; `ATENEA, necesito decidir`; `más silencio`; `continúa`; `repite`; `pausa`; `terminar`; `no guardar`; `guarda solo el resumen`; `profundiza`; `vuelve al modo observador`.

Los comandos funcionan **solamente dentro de una sesión iniciada voluntariamente**, sin escucha permanente por palabra clave. No afirmar compatibilidad con pantalla bloqueada hasta probar iOS/Android y PWA. La voz debe tolerar al menos 30–60 segundos de silencio planificado sin forzar una respuesta. No convertir automáticamente silencio en consentimiento.

### Guion base del facilitador
- Español natural de México; frases breves y pausadas; **una pregunta a la vez**.
- No interrumpir durante un silencio de práctica; no diagnosticar emociones, ni decir "estás en theta", "tu conciencia ha subido", "tu cerebro cambió de frecuencia".
- Antes de decisión irreversible o de alto riesgo, mostrar los límites de la información y recomendar revisión profesional apropiada. No realizar operaciones, transferencias, contratos ni comunicaciones sin autorización explícita.
- Si el usuario está conduciendo, no proponer cerrar ojos ni introspección que desvíe la atención del camino. Instruir uso estacionario para ejercicios contemplativos.
- Comando `terminar` siempre tiene prioridad, detiene micrófono/audio en cliente y provoca cierre remoto; `silencio` no equivale a cancelar.

## 4. Implementación por componentes (propuesta)

### Frequency Healer
- Ruta nueva: `frontend/src/app/atenea-voz/page.tsx`, solo visible bajo `ATENEA_VOICE_ENABLED=true` verificado en servidor. No reutilizar directamente el estado de `/voz` si provoca efectos laterales.
- Componente cliente `AteneaVoiceSession` con máquinas de estado `idle -> requesting_permission -> connecting -> active -> paused -> ending -> ended/error`, bloqueo contra doble inicio y limpieza de audio tracks, RTCPeerConnection y event channel.
- Endpoint server-only `POST /api/atenea-voz/session` para validar feature flag, origen, autorización de acceso y cuotas; usar clave `OPENAI_API_KEY` solo en servidor. Implementar sesión GPT-Live siguiendo **exactamente** el quickstart oficial de WebRTC y la API Live (creación de sesión, intercambio SDP y credenciales). No aceptar URLs externas ni modelos arbitrarios de cliente.
- Canal de datos para estado de conexión, turnos y control de silencios; no inferir que hubo una orden hasta recibir evento de voz válido. Interrupciones (barge-in) y reconexión sin duplicación de sesión.
- El servidor controla la delegación de `gpt-6-astra` en `standard/low`; `pro/high` solo tras el comando explícito `profundiza` y confirmación, con presupuestos por usuario.
- El flujo de observación debe continuar incluso si el análisis delegado tarda: no hablar para rellenar cada espera.
- Aislar temporizadores de práctica del ciclo de vida de sesión; limpiar recursos al salir de la ruta, colgar o desconectarse. Distinguir elapsed clock, pausa y cierre.

### Base 60
- No conectar directamente GPT-Live a Supabase desde navegador.
- Reutilizar contratos versionados y resumen elegido por el usuario de PR #29/#32. **Adaptar** el esquema cuando lo requiera el nuevo protocolo; mantener contrato v1 intacto o versionar v2, no cambiar campos silenciosamente.
- Guardar opcionalmente: `session_id, protocol, started_at_utc, duration_sec, selected_mode, decision_context?, observed_impulse?, selected_action?, user_reflection?, consent_scope, created_at`. No guardar audio bruto. Tiempos UTC para persistencia, zona horaria configurada solo para mostrar.
- Consentimiento granular antes de compartir: `no guardar`, `solo métricas`, `resumen aprobado`; permitir eliminar/exportar.
- RLS por usuario y pruebas negativas de sesión ajena. Ningún `service_role` al navegador.
- No mezclar interpretaciones astrológicas o Gene Keys con hechos observados como si fueran causalidad.

## 5. Privacidad y seguridad

- **Micrófono apagado por defecto**; solicitar permiso después del gesto de inicio.
- Aviso audible/visible de sesión activa; posibilidad de terminar con voz o botón.
- Voz/diario contienen información sensible: no conservar audio/transcripción literal por defecto; no enviarlos a analítica de terceros.
- Autenticación para sesiones facturables; no exponer endpoint abierto anónimo que permita generar gasto ilimitado. Rate limiting **persistente** (no confiar solo en Map en memoria de serverless), cuotas de minutos/usuario/día y de delegaciones Pro.
- Protección de origen, CSRF, validación de entradas, limites de tamaño, logs sin contenido privado.
- Claves exclusivamente en env vars de servidor, nunca `NEXT_PUBLIC_*`; no poner claves en PR ni conversación.
- Revisar retención real del proveedor y documentación de privacidad antes de habilitar; documentar claramente los límites.
- Desactivación de emergencia por flag y fallback seguro a sesión de silencio/guía local si la API falla.

## 6. Orden de entrega para Codex

**Fase A: auditoría y diseño (este PR):** confirmar stack, rutas, políticas existentes y contrato de puente. No modificar rutas existentes.

**Fase B: MVP de audio aislado:** nueva ruta y backend protegido con `gpt-live-1`; permisos, pantalla mínimo visual, iniciar/detener, WebRTC, interrupciones, silencios, cleanup; sin conexión Base 60 todavía.

**Fase C: delegado de decisiones:** `gpt-6-astra` estándar, `pro` solamente por orden explícita; tests con casos financieros, legales y emocionales; lógica para hechos vs interpretaciones. No ejecutar transacciones externas.

**Fase D: diario y puente:** integrar PR #29/#32 cuando sus contratos y tests estén aprobados; consentimiento verbal + confirmación válida antes de guardar; borrado y exportación.

**Fase E: validación multiplataforma:** iOS Safari/PWA, Android Chrome, escritorio, bloqueo de pantalla, interrupciones por llamada, reconexión y regresión de audio.

## 7. Criterios de aceptación — NO-GO por defecto

1. `ATENEA_VOICE_ENABLED` ausente o false => sin acceso a ruta ni endpoint; la producción actual sigue funcionando igual.
2. Iniciar conversación desde una única pantalla; dejar 60 segundos de silencio sin respuestas automáticas ni pérdida inesperada de estado.
3. La interrupción verbal detiene inmediatamente la salida de voz; `terminar` cierra WebRTC, micrófono y sesión facturable.
4. Estado del audio visible y accesible, errores recuperables y alternativa sin IA.
5. El modelo no afirma detectar emociones o estados de conciencia; solo reformula lo que el usuario comunica.
6. La consulta Pro no se dispara automáticamente; queda sometida a comando y límite de coste.
7. Sin guardado de audio/transcript por defecto; solo se persiste contenido consentido y revisado.
8. Ningún secreto aparece en JS cliente ni en logs. Endpoint de sesiones exige autorización y cuota persistente.
9. Suite de tests unitarios, integración, E2E móvil/desktop, seguridad y CI correctos; auditar PR #29/#32 antes de unir.
10. Mantener producción intacta; no fusionar ni desplegar a producción sin revisión humana.

## 8. Indicadores de calidad
- Inicio efectivo de sesión; interrupción verbal; error de cierre; micrófono activo tras terminar = 0.
- Latencia conversación (p50/p95), degradación ante red inestable, costes/minuto y por delegación.
- Porcentaje de prácticas completadas sin tocar pantalla.
- Utilidad autodeclarada: ¿ayudó a reconocer un impulso? ¿permitió distinguir hecho e interpretación? ¿ayudó a elegir una acción?
- No hay métrica de "nivel de conciencia"; autoinformes y resultados conductuales son aproximaciones observacionales.

## 9. Referencias GitHub
- Frequency Healer: https://github.com/antoniodiaz70ad-dev/frequency-healer/pull/29
- Base 60: https://github.com/antoniodiaz70ad-dev/base60-platform/pull/32
- GPT-Live guía oficial: https://developers.openai.com/api/docs/guides/live
- Modelos y modos: https://developers.openai.com/api/docs/models/gpt-live-1 y https://developers.openai.com/api/docs/guides/reasoning

**Pendiente / no demostrado:** validación de claves y acceso a API; voz activa con pantalla bloqueada; consumo real; calidad de silencios bajo WebRTC; compatibilidad con PR de puente; despliegue. No declarar implementados estos puntos sin pruebas.

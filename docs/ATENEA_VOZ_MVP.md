# ATENEA Voz — MVP simulado (Issue #32)

Estado: **NO-GO para producción; sin API real ni despliegue**.

Implementación independiente desde `main`, rama `codex/atenea-voz-mvp`.
Referencia de diseño: [PR #31](https://github.com/antoniodiaz70ad-dev/frequency-healer/pull/31),
`docs/ATENEA_VOZ_V1_SPEC.md` en la rama `codex/atenea-voz-architecture-v1`.
La [decisión del propietario](https://github.com/antoniodiaz70ad-dev/frequency-healer/issues/32#issuecomment-6409721143)
autoriza adaptadores y mocks sin claves por ahora.

## Alcance implementado

- `/atenea-voz`, controlada por `ATENEA_VOICE_ENABLED` del servidor. Ausente o distinto de `true`: 404. No se agrega navegación al producto actual.
- Observador, Decisión consciente y Diario hablado en una pantalla. Guiones breves, sin diagnóstico ni afirmaciones metafísicas; la persona decide.
- Controlador independiente con estados de permiso, conexión, actividad, pausa, cierre y error. Previene doble inicio, descarta eventos tardíos, aborta análisis y cierra tracks al terminar, perder red, perder hardware o salir de la página.
- Micrófono apagado por defecto; permiso solo tras gesto y aceptación. En simulación, sus tracks prueban permisos/ciclo de vida. No hay MediaRecorder, Web Speech, grabación ni envío de audio. El simulador tampoco reproduce voz: no se presenta como conversación real.
- Eventos de voz normalizados a través de `VoiceAdapter`. Las órdenes se aplican únicamente a eventos finales dentro de una sesión. Barge-in invoca `interrupt()` antes del siguiente turno. `terminar` tiene prioridad y no necesita confirmación.
- Silencio sin temporizadores de respuesta; límite local de diez minutos para cierre. Pausa silencia tracks: para continuar se usa botón o evento simulado, sin prometer escucha verbal durante pausa.
- `AnalysisAdapter` separa análisis normal del profundo. El segundo necesita `profundiza` y `confirmar profundizar`. El mock limita a tres análisis y uno profundo por sesión; estos límites **no sustituyen cuotas persistentes de servidor**. No produce resultados atribuidos a un modelo real.
- Sin persistencia automática, audio, historial de transcripciones, logs privados ni analítica. El último turno solo vive en memoria hasta cierre/cambio de modo. Descarga local manual de modo o resumen escrito y revisado, con consentimiento granular revocable. No se genera un resumen de transcripción ni se comparte con Base 60.
- Endpoint `POST /api/atenea-voz/session` cerrado: 404 con flag apagado, 403 sin origen válido, 503 sin bindings auditados. No hace llamadas al proveedor ni devuelve tokens. `AccessBindings` define autenticación y reserva atómica persistente para la integración posterior; todavía no tiene implementación de producción.

## Auditoría de regresión y puente

Se revisaron `/voz`, `PrivacyGate`, `VoiceCaptureController`, `NativeSpeechController` y `VoiceOrchestrator`. El flujo existente utiliza su propio consentimiento, captura/dictado y orquestación. Se conservan sin modificaciones; ATENEA no reutiliza su estado ni su almacenamiento. La privacidad del laboratorio explica específicamente la simulación y no hereda un consentimiento remoto previo.

PR #29 de Frequency Healer y PR #32 de Base 60 siguen separados. No se cambian sus contratos, migraciones o RLS. El archivo descargable usa `atenea-local-summary-v1`, **no** el contrato del puente, y no debe enviarse a su endpoint. Auditar ambos drafts, origen/autenticación, consentimiento, exportación/borrado y pruebas negativas de usuario ajeno antes de crear un adaptador del puente.

## Verificación reproducible

Desde `frontend`:

```sh
npm ci
npm test
npm run typecheck
npm run lint
NEXT_PUBLIC_VOICE_JOURNEY_ENABLED=true NEXT_PUBLIC_HARMONIC_LAB_ENABLED=true npm run build
ATENEA_VOICE_ENABLED=true FH_UI_BROWSER_PATH=/usr/bin/chromium FH_UI_ARTIFACTS_DIR=artifacts/ui node --test ui/atenea-flow.test.mjs
ATENEA_VOICE_ENABLED=false node --test ui/atenea-flow.test.mjs
```

La suite de dominio cubre consentimiento, permisos tardíos/denegados, doble inicio, silencio de 60 s, interrupción, órdenes parciales, cierre, desconexión, pérdida de hardware, recuperación explícita, límite temporal, análisis tardío y presupuesto/confirmación Pro. La suite de navegador usa Chromium con dispositivo de audio **falso**, escritorio y viewport móvil: permisos, tracks vivos/silenciados/finalizados, cero escrituras automáticas y gates HTTP. Viewport móvil no equivale a Safari/iOS o Android físico.

CI `Resonance Lab Regression` ejecuta tests, TypeScript, ESLint, builds y flags ON/OFF; adjunta capturas ATENEA como artifacts. `vercel.json` en raíz y `frontend` desactiva auto-deploy para esta rama específica. No se altera la política de despliegue de otras ramas. Revisar y retirar esa excepción únicamente cuando corresponda.

## Pendientes antes de staging con API real

1. Verificar nombres, disponibilidad y parámetros actuales del proveedor. `gpt-live-1` y `gpt-6-astra` son candidatos del diseño, **no contratos confirmados**. Implementar WebRTC/SDP, eventos, barge-in real, silencio y cierre remoto según documentación oficial vigente. No introducir endpoints inventados ni aceptar modelos/URLs arbitrarios del cliente.
2. Implementar autenticación de servidor y reservas de cuota atómicas persistentes por usuario/día (voz, minutos, análisis y Pro), sesiones concurrentes, idempotencia, expiración y contabilidad real. El endpoint no se habilitará solo por añadir una clave.
3. Configurar `ATENEA_VOICE_ORIGIN` con el origen canónico exacto de staging (sin barra final); no se confía en Host/Forwarded del cliente ni en el host interno de Next. Validar CSRF, tamaños de entrada/SDP, límites de duración/tokens, timeout y cierre remoto, cancelación, errores sin datos privados y protección contra solicitudes anónimas. Pro requiere confirmación verificable del usuario y cuota de coste de servidor.
4. Configurar `OPENAI_API_KEY` exclusivamente en secretos de servidor del entorno de pruebas, tras la decisión posterior del propietario. Sin `NEXT_PUBLIC_*`, claves en repo, logs, conversación o artifacts. No se solicita ni crea ninguna clave en este trabajo.
5. Revisar aviso de retención y políticas del proveedor antes del consentimiento para envío remoto. El aviso actual solo autoriza la simulación local y no basta para audio remoto.
6. Probar micrófono físico, silencio real de 30–60 s, interrupción verbal y `terminar` con cierre local **y remoto**, WebRTC bajo red inestable, latencia p50/p95 y coste real. Verificar que no quede una sesión facturable abierta.
7. Probar Safari/iOS, PWA y Android Chrome físicos: permisos, llamadas entrantes, cambio de salida, bloqueo de pantalla, navegación y reconexión sin sesiones duplicadas. No se promete pantalla bloqueada.
8. Revisar los contratos y RLS del puente antes de integrar guardado/compartir. Obtener aprobación humana para cualquier despliegue y producción.

No se cierra el Issue #32 como completo: esta entrega cubre el MVP simulado autorizado, no los criterios GO de voz real.

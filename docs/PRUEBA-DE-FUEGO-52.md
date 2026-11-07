# Prueba de Fuego · Issue #52

## Alcance e integración

Implementación experimental en el frontend Next.js de **Resonance Lab**, el runtime disponible en este repositorio. No se encontró aquí una aplicación independiente de ATENEA. Esta entrega no acredita integración ni activación en otra aplicación de ATENEA.

Ruta: `/prueba-de-fuego`. Flag de compilación `NEXT_PUBLIC_PRUEBA_DE_FUEGO_ENABLED=true`, **apagado por defecto**. Con cualquier otro valor, la ruta devuelve 404 y el menú no muestra la entrada. La matriz de CI activa el flag solo en su compilación de pruebas ON; esto no cambia la configuración de producción.

La persona elige cualquier ejercicio mental mediante un nombre libre. El protocolo no depende de un contenido específico ni requiere televisión. Incluye anclaje (1 min), atención simultánea (2), identificación de impulsos (2) y metaconciencia (2). Una pantalla o estímulo externo es opcional; no se reproduce contenido externo.

`FirePractice` admite `exerciseName` para que otro ejercicio lo integre de forma explícita. El componente también comprueba el flag. Un integrador puede ofrecer esta práctica desde un ejercicio sin modificar su motor, esquema o temporizador: no montar dos sesiones activas simultáneamente. No se añadieron superposiciones automáticas a Bentov, Base 60, Contemplación #51 ni al MVP de voz #32. Para otro runtime, portar `lib/fire` y proporcionar una interfaz propia con las mismas guardas y contrato de datos.

## Sesiones y privacidad

- Tiempo activo monotónico con `performance.now()`, limitado a siete minutos. Pausar excluye el tiempo en pausa; reanudar conserva fase y tiempo. Ocultar la página pausa la práctica. Terminar antes registra estado detenido y únicamente fases ya completadas.
- Silencio por defecto. Voz opcional mediante SpeechSynthesis del navegador: una instrucción por fase, silencios largos, cancelación al pausar, terminar o navegar. Reanudar repite la instrucción actual. No se solicita micrófono ni cámara. Las instrucciones de voz son fijas y no incluyen el ejercicio ni las notas; el proveedor de voz puede ser remoto según navegador/sistema.
- Caminadora: aceptación previa de condiciones, marcha normal hacia adelante, ojos abiertos, velocidad segura, vigilancia de banda y prioridad locomotora. Sin preguntas o interacciones requeridas durante los intervalos. Antes de mostrar el formulario final se confirma que la persona se detuvo y salió de la banda. El control de seguridad físico de la caminadora sigue siendo prioritario ante inestabilidad.
- Sesión en memoria hasta guardado explícito. Recargar o cerrar pierde lo no guardado; no se inventa una sesión completa ni se recuperan tiempos de ausencia.
- Guardado exige consentimiento explícito en cada carga de la página. Una única clave independiente `rl:prueba-de-fuego:v1` contiene programa y sesiones. No se guardan grabaciones ni métricas instrumentales.
- Registro: fechas/horas, día local, ejercicio, modalidad, duración activa real, fases completadas, estado, programa, distracciones autoinformadas opcionales, latencia subjetiva, recuperación/presencia/identificación opcionales 0–10 y nota opcional. Cero y ausencia son distintos. Validación previa a escritura, preservación de datos corruptos, guardado idempotente por ID.
- Programa opcional de 14 días a partir del día local de inicio; no impone una sesión diaria ni rellena días omitidos. Comparativa de medias de autorreportes de días 1–7 y 8–14, con N por variable, solo sesiones completas y sin imputar datos. Puede haber varias sesiones por día y mezcla de ejercicios/modalidades; la interfaz lo advierte. No es evidencia causal o clínica.
- Exportación JSON dedicada desde el módulo (incluye datos corruptos tal como están para recuperación). No se modificó el formato del exportador unificado previo. Eliminación confirmada solo de esta clave, sin afectar otras prácticas. localStorage no proporciona aislamiento por cuenta ni cifrado propio: este alcance es local, sin sincronización. No añadir sincronización hasta implementar autenticación, consentimiento y verificar RLS/aislamiento por usuario en el servicio elegido.

## Validación y puerta de lanzamiento

Pruebas automatizadas añadidas: límites 1/2/2/2, pausas/reanudación, límite de duración, calendario, consentimiento, idempotencia, cero/ausencia, corrupción, validación y comparativas. UI: viewport móvil, sesión completa con reloj controlado, pausa/reanudación, voz opcional, pausa al ocultar, navegación, guardado/reload/exportación/eliminación y caminadora.

Comandos reproducibles desde `frontend/`:

```sh
npm ci
npm test
npm run typecheck
npm run lint
# OFF (sin variables NEXT_PUBLIC_* heredadas)
npm run build
node scripts/ci-smoke.mjs disabled
# ON local/CI, sin publicar
NEXT_PUBLIC_VOICE_JOURNEY_ENABLED=true NEXT_PUBLIC_HARMONIC_LAB_ENABLED=true NEXT_PUBLIC_PRUEBA_DE_FUEGO_ENABLED=true npm run build
node scripts/ci-smoke.mjs enabled
FH_UI_BROWSER_PATH=/usr/bin/chromium npm run test:ui
```

El entorno local suministra Node 24.22.1; el repositorio y CI especifican Node 22. CI debe confirmar el entorno objetivo. Las pruebas de voz interceptan SpeechSynthesis para verificar despacho y cancelación: no equivalen a una prueba acústica. Un viewport móvil de Chromium no sustituye Safari/iOS, dispositivos físicos ni uso real en caminadora.

Evidencia local del 7 de noviembre de 2026: `npm test` pasó en sus 38 archivos compilados; los siete casos nuevos también se ejecutaron directamente mediante `node .test-build/tests/fire.test.js`. TypeScript, ESLint y ambas compilaciones ON/OFF pasaron. El smoke OFF verificó 404 y ausencia del enlace; `ci-smoke.mjs enabled` pasó con las rutas y APIs existentes. La suite completa de navegador pasó **125/125** casos, incluidos Bentov, voz, laboratorios y los cuatro flujos nuevos. Después de los últimos ajustes de presentación y aislamiento de cancelación de voz se repitieron compilación, análisis estático y los cuatro flujos de Prueba de Fuego. Captura móvil sintética: `frontend/artifacts/fire/mobile.png` (artefacto local, excluido de Git). Estas comprobaciones son locales, no evidencia de staging.

**NO-GO para producción** hasta revisión humana, evidencia de staging y decisión explícita. Pendientes: reproducción y cancelación de voz en dispositivos objetivo, teclado y lector de pantalla, caminadora real bajo condiciones seguras y revisión de privacidad. No se publicó, fusionó ni habilitó producción desde esta entrega. La rama y el PR borrador son el canal de revisión.

# Frequency Healer — informe de implementación

19 de septiembre de 2026. Extensión aditiva en PR borrador; **sin merge ni despliegue a producción**.

## Entrega y trazabilidad

- PR borrador, sin revisores: https://github.com/antoniodiaz70ad-dev/frequency-healer/pull/5
- Preview con ambas funciones activadas: https://frequency-healer-2v03pzbai-leviathan1.vercel.app/voz
- Laboratorio en Preview: https://frequency-healer-2v03pzbai-leviathan1.vercel.app/laboratorio-armonico
- Estado Vercel: **READY**, entorno Preview. Mantiene protección de acceso: sin sesión Vercel, las rutas responden 302 hacia autenticación. No se debilitó esa protección.
- Inspector: https://vercel.com/leviathan1/frequency-healer/BweKFJaEzuzXYS6QGrkJ93Z7fNxG
- Preview local activa: http://127.0.0.1:4319/voz
- Rama: `codex/voice-journey-grant`.
- Base remota: `3fc370a6748a6ba3c9b6d4e3ff30d26204babd38`.
- HEAD final de implementación y fuente exacta de la Preview: `be45689f3cede1d86c57d12193928386246bbe3d`. El commit posterior de cierre incorpora este informe; su SHA se obtiene con `git rev-parse HEAD` y consta en el PR.
- Worktree: `/Users/ensenada/Movies/frequency-healer-voice`.
- Checkout original intacto: `/Users/ensenada/Movies/frequency-healer`, rama `feature/command-cards`, HEAD `560847872a266accb017ab69c1698832312bccbd`.
- `main` se volvió a consultar y permanece en el SHA base.

| Commit | Fase / resultado |
|---|---|
| `01c69b8` | Inventario, AGENTS, contratos y verificación base |
| `c1e35ae` | Matemáticas, schedule y motor armónico aislado |
| `f015920` | Máquina de estados, parser local, propuesta, confirmación, texto y laboratorio |
| `6966ecc` | Captura por gesto, transcripción intercambiable, privacidad y adaptadores de servidor |
| `4f88fb1` | Ducking, marcadores y comandos cerrados con confirmación de parada |
| `e1b3d0f` | Persistencia independiente y descriptivos N=1 |
| `3efca57` | Flags, navegación, cleanup mínimo del generador y regresión |
| `be45689` | Corrección de origen detrás de Next y lectura/escritura coherente de almacenamiento |

Se leyó `frontend/AGENTS.md` y la documentación de Next **16.2.0 instalada** (componentes servidor/cliente, rutas API, `notFound` y variables de entorno). No se encontró un laboratorio previo ni `FREQUENCY_HEALER_GENERADOR_ARMONICO_CODEX.md` en el repositorio o las carpetas revisadas. Se implementó como fundamento separado el contrato armónico incluido en el documento suministrado.

## Comportamiento implementado

- Recorrido completo por texto: privacidad, intención editable, objetivo/estados/duración/intensidad, configuración editable, propuesta con tonos/relaciones exactas, confirmación, reproducción, marcadores, reflexión opcional, guardar o terminar sin guardar.
- Base predeterminada de Voice Journey: **144 Hz**. Laboratorio manual: **220 Hz**. Cada ruta muestra explícitamente su base; no hay sustitución ni ajuste automático de octava.
- Quinta, cuarta, terceras y cascada 13/12, con límites 40–2000 Hz, incrementos 1–8, máximo 9 voces simultáneas, seno, ganancia `0.25 × volumen/100`, normalización `1/N`, rampas de 30 ms y schedule con `AudioContext.currentTime`.
- Motor separado; `audioEngine.ts` y `AudioVisualizer.tsx` permanecen byte a byte sin cambios. El generador heredado solo añade cancelación de timers y parada al desmontar.
- Captura solo por gesto: mantener presionado o alternativa accesible de dos pulsaciones. Límite 60 s para intención, 30 s para marcador/reflexión, 3 MB. Tracks detenidos al soltar/cancelar/error; no se guarda audio.
- Ducking a 25% en 150 ms; restauración en 300 ms, sin alterar preferencia de volumen. Una cancelación invalida trabajo pendiente. No se reanuda al volver de pestaña oculta.
- Marcadores con offset monotónico, fecha civil y snapshot de tonos. Transcripción editable antes de aplicar. Comandos limitados a volumen, marcador y parada confirmada; no reconfiguran frecuencias durante reproducción.
- N=1 separado por versión/regla, familia, relación, modo, objetivo, banda de duración y detalles de arquitectura. Solo sesiones completas con pares válidos: menos de 5 no muestra patrones; 5–9 señal preliminar; 10+ patrón observado. Media, mediana, n y fechas, sin lenguaje causal.

## Datos y privacidad

Contratos versionados en `frontend/src/lib/voice/types.ts`: `ParsedIntentionV1`, `VoiceSessionProposalV1` (incluye `ruleId`), `SessionMarkerV1`, `VoiceSessionRecordV1`, `SelfRatingV1`. Validación runtime de intención, propuesta, escalas y registros anidados. Campos externos desconocidos no se convierten en acciones.

Claves nuevas exclusivamente:

- `fh:voice-consent-v1`: versión de procesamiento y fecha. La identidad de los endpoints configurados participa en la versión; un cambio exige nueva aceptación.
- `fh:voice-settings-v1`: preferencia `keepOriginal`, false por defecto.
- `fh:voice-sessions-v1`: máximo 100 sesiones, sin expulsión silenciosa.

Se conserva la intención estructurada que el usuario revisó. El texto original separado solo se persiste si activa la opción correspondiente. Notas/reflexión únicamente tras Guardar. El audio nunca forma parte del registro. Los contadores técnicos solo viven en memoria, sin contenido personal ni envío de analytics.

JSON inválido no se sobrescribe. Quota/permisos: sesión disponible en memoria con aviso y exportación. Escrituras serializadas con Web Locks y lectura-validación-comprobación-escritura; evento `storage` actualiza otras pestañas. Sin Web Locks se rechaza la escritura compartida y se ofrece exportar desde memoria. Borrado de una sesión o historial con confirmación en UI. Nunca se llama a `localStorage.clear()`.

Las claves OBE, próxima sesión y presets armónicos existentes no se modifican. El almacenamiento es por origen: Preview, localhost y producción no comparten registros ni se migran automáticamente.

## Proveedores y activación

**No se configuró ni se inventó una credencial.** Transcripción remota y asistente remoto no se probaron contra un proveedor real. Sin ellos, todo el recorrido funciona por texto; una grabación termina, se descarta y ofrece escribir el contenido. Web Speech no se usa en esta versión.

Adaptadores opcionales de servidor (no son integraciones preconfiguradas con un proveedor concreto):

- `VOICE_TRANSCRIPTION_URL` + `VOICE_TRANSCRIPTION_TOKEN`: HTTPS, recibe multipart `file`, `language`, `max_duration_seconds`; devuelve JSON `{ "text": "…" }`. El adaptador de proveedor debe comprobar también la duración decodificada real: el límite del navegador y la metadata de cliente no certifican la duración de un archivo hostil.
- `VOICE_AI_ENABLED=true`, `VOICE_INTENT_URL` + `VOICE_INTENT_TOKEN`: recibe JSON `{instruction, transcript}` y devuelve exclusivamente `ParsedIntentionV1`. La app valida la salida y genera tonos con reglas locales; el modelo no proporciona frecuencias ni ejecuta herramientas.
- `VOICE_PROCESSING_VERSION` (opcional): aumentar ante cambios materiales de política, proveedor o retención, además de la renovación automática al cambiar endpoints.

Las rutas API comprueban flag, origen, tamaño de cuerpo por streaming, MIME, longitud del texto, tiempo de espera de 20 s y cancelación. Rate limit: 10 solicitudes/minuto por IP en la instancia, sin logs de contenido. Para escalar el servicio remoto, sustituir el límite en memoria por un límite compartido y aprobar las políticas del proveedor; esta versión no promete un límite global entre instancias serverless ni garantiza la retención de un proveedor externo.

Variables públicas, incorporadas al **build**:

```dotenv
NEXT_PUBLIC_HARMONIC_LAB_ENABLED=true
NEXT_PUBLIC_VOICE_JOURNEY_ENABLED=true
VOICE_AI_ENABLED=false
```

Por defecto las flags públicas están apagadas. La Preview entregada las activa solo para ese despliegue. No se cambiaron variables del proyecto en producción. Con false y rebuild se eliminan enlaces, la ruta servidor devuelve `notFound()` y no monta la UI ni sus listeners.

Para reproducir localmente (Node 22.14 usado aquí; Vercel usa Node 24 según configuración existente):

```sh
cd /Users/ensenada/Movies/frequency-healer-voice/frontend
npm ci
npm run lint
npm run typecheck
npm test
NEXT_PUBLIC_VOICE_JOURNEY_ENABLED=true NEXT_PUBLIC_HARMONIC_LAB_ENABLED=true npm run build
npm run start -- --port 4319 --hostname 127.0.0.1
```

Para probar la variante desactivada, recompilar con ambas variables públicas en false. `frontend/.env.example` contiene únicamente nombres, defaults y campos vacíos. No se agregaron dependencias de aplicación ni se alteraron Next, React, lockfile o backend. Tests usan TypeScript y `node:test` ya disponibles. La CLI oficial de Vercel se ejecutó temporalmente para desplegar Preview.

## Verificación y resultados

| Prueba | Resultado / alcance |
|---|---|
| Base: lint y TypeScript | Pasan antes de modificar |
| Build base | Falla inicialmente por bloqueo de red al descargar Geist; pasa con red habilitada. Código base no modificado para resolverlo |
| Lint final | Pasa, sin errores ni warnings |
| TypeScript final | Pasa |
| `npm test` | **28/28 pasan**, 0 fallos |
| Build flags ON | Pasa local y en Vercel Preview |
| Build flags OFF | Pasa; comprobado antes de la corrección final del control de origen, que solo afecta rutas API activadas |
| HTTP OFF | `/voz` y laboratorio 404; enlaces ausentes; seis rutas heredadas 200; API 404 |
| HTTP ON final | Ocho rutas 200; origen ajeno 403; proveedor no configurado 503 |
| Matemáticas | Intervalos exactos, cascadas a 1e-9, conteos, retorno sin pico duplicado, rechazo sin clamp y normalización |
| Audio simulado | Resume pendiente/cancelado/rechazado, nodos futuros detenidos, callback A/B aislado, ducking y no restauración tras Stop, finalización y desconexión |
| Captura simulada | Sin permiso al construir, un stream, tracks cerrados al soltar/cancelar/error, permiso tardío invalidado, APIs ausentes, MIME/tamaño/duración |
| Intención/estados | ES/EN, defaults visibles, ambigüedad, JSON inválido, campos de inyección descartados, consentimiento experimental, tabla de transiciones y tokens de generación |
| Persistencia/N=1 | Lectura/borrado/100 sesiones/corrupción/quota/concurrencia; claves protegidas comparadas byte a byte; audio descartado; medias/medianas/pares y umbrales |
| Motor heredado simulado | Tono, afinación 432, binaural L/R, salida bobinas, acordes, ruido rosa y destroy |
| Desktop real, navegador integrado | Texto→propuesta→confirmar→estado de audio activo→bajar volumen→marcador→Stop→reflexión→guardar→recargar: pasa |
| Laboratorio real | Tonos calculados visibles, cascada bloqueada sin consentimiento, inicio y navegación a generador: pasa a nivel UI |
| Generador real | Preset 432, inicio/parada y visualización de presets/acordes: pasa a nivel UI |
| Protocolo real | Inicio y pausa pasan; reanudación/parada posterior **no confirmadas**, herramienta de navegador dejó de responder |
| Vista móvil | 360×800: captura visual y ancho DOM sin desbordamiento horizontal |
| Archivos protegidos | `git diff` vacío para motor, visualizador, catálogo, protocolos, presets, diario, backend y lockfile |
| Secretos | 0 coincidencias de patrones de secretos en archivos cambiados; llaves solo mediante variables server-only |

**No probado audiblemente:** no hubo confirmación humana de salida por altavoz/auriculares, calidad acústica, dB SPL ni ducking oído. Estado de reproducción real y pruebas de grafo simulado no se presentan como medición acústica.

**Pendientes explícitos:** micrófono físico y transcripción real; captura/ducking en Android real, cambio de app y pantalla bloqueada; recorrido completo en React Strict Mode mediante navegador; regresión manual completa de favoritos, binaural y diario; finalización real de una sesión de 5–60 min. El navegador dejó de responder en dos llamadas de control y no permitió continuar esos ensayos. Acordes reales no se iniciaron porque el aviso existente pide declaraciones personales de salud y auriculares que no corresponde afirmar por el usuario; sí se probó su motor mediante mocks. La prueba local guardó un registro claramente etiquetado como técnico en el origen localhost.

## Fallos encontrados y límites

- **Preexistente:** el generador no limpiaba audio/timers al salir. Corregido de forma mínima en su ruta, sin reescribir el motor.
- **Preexistente:** `stopProtocol()` deja pendiente su Promise al limpiar el timer. No se modificó esa API; el nuevo flujo no usa `playProtocol()`.
- **Preexistente / entorno:** descarga de Google Fonts requiere red. La autenticación embebida del remoto Git era rechazada; se usó la sesión vigente de GitHub CLI sin cambiar ni imprimir credenciales. El conector GitHub no permitía crear PR, por lo que se creó con esa CLI.
- **Introducido y corregido antes de entrega:** la comparación de origen contra `Request.url` rechazaba localhost detrás de Next. Se comparó con Host y se añadieron pruebas de frontera; HTTP ON final pasa.
- Las comprobaciones manuales pendientes impiden afirmar que todos los criterios de aceptación de hardware están cerrados. Esta entrega sigue como **borrador**.
- Diccionario ES/EN para objetivos, estados y motivos preparado; la interfaz v1 permanece en español y no ofrece un selector global de inglés.

## Reversión

1. Desactivar las dos flags públicas y reconstruir únicamente el entorno deseado. No borra registros.
2. Para revertir código, trabajar en una rama de revisión y usar `git revert --no-commit 3fc370a6748a6ba3c9b6d4e3ff30d26204babd38..HEAD`; revisar el diff y crear un commit. Incluye el commit de este informe si se ejecuta desde la rama entregada. No requiere reset, clean, force-push ni borrar almacenamiento.
3. Alternativamente revertir por fases desde el commit más reciente. No dejar UI que importe módulos revertidos; usar flags apagadas al probar una reversión parcial.
4. Preview es independiente de producción. No promoverla ni hacer merge hasta cerrar las pruebas pendientes y autorizarlo.

## Archivos y razones

- `src/lib/harmonic/`: fórmulas, límites, schedule y grafo aislado.
- `src/lib/voice/`: contratos, validación, parser, reglas, estados, orquestación, comandos, captura, proveedores, seguridad HTTP, flags, consentimiento, persistencia y N=1.
- `src/components/voice/`: UI separada, formularios accesibles, propuesta, grabación, privacidad, historial y laboratorio.
- Nuevas rutas `/voz`, `/laboratorio-armonico`, `/api/voice/interpret`, `/api/voice/transcribe`; wrappers servidor y flags.
- Dashboard/Sidebar: accesos condicionales; generador: cleanup descrito arriba.
- Tests, script HTTP, scripts npm y configuración de tests/lint: verificación sin dependencias nuevas. Documentación y `.env.example`: operación y reversión.

<details><summary>Inventario completo de archivos de implementación (49)</summary>

```text
docs/VOICE_BASELINE.md
frontend/.env.example
frontend/.gitignore
frontend/eslint.config.mjs
frontend/package.json
frontend/scripts/http-smoke.mjs
frontend/src/app/api/voice/interpret/route.ts
frontend/src/app/api/voice/transcribe/route.ts
frontend/src/app/generador/page.tsx
frontend/src/app/laboratorio-armonico/page.tsx
frontend/src/app/page.tsx
frontend/src/app/voz/page.tsx
frontend/src/components/Sidebar.tsx
frontend/src/components/voice/Fields.tsx
frontend/src/components/voice/HarmonicLab.tsx
frontend/src/components/voice/PrivacyGate.tsx
frontend/src/components/voice/SessionPlan.tsx
frontend/src/components/voice/VoiceCapture.tsx
frontend/src/components/voice/VoiceHistory.tsx
frontend/src/components/voice/VoiceJourney.tsx
frontend/src/components/voice/voice.module.css
frontend/src/lib/harmonic/engine.ts
frontend/src/lib/harmonic/math.ts
frontend/src/lib/voice/analytics.ts
frontend/src/lib/voice/capture.ts
frontend/src/lib/voice/commands.ts
frontend/src/lib/voice/feature.ts
frontend/src/lib/voice/i18n.ts
frontend/src/lib/voice/intentParser.ts
frontend/src/lib/voice/orchestrator.ts
frontend/src/lib/voice/privacy.ts
frontend/src/lib/voice/rules.ts
frontend/src/lib/voice/server.ts
frontend/src/lib/voice/serverBoundary.ts
frontend/src/lib/voice/stateMachine.ts
frontend/src/lib/voice/storage.ts
frontend/src/lib/voice/transcription.ts
frontend/src/lib/voice/types.ts
frontend/src/lib/voice/validation.ts
frontend/tests/audio.test.ts
frontend/tests/capture.test.ts
frontend/tests/commands.test.ts
frontend/tests/harmonic.test.ts
frontend/tests/legacy.test.ts
frontend/tests/server-boundary.test.ts
frontend/tests/storage.test.ts
frontend/tests/voice.test.ts
frontend/tsconfig.json
frontend/tsconfig.test.json
```

</details>

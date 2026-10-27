# PR #33 — auditoría de regresión y preparación de voz real

Actualización posterior: esta rama aplica Next.js 16.4.3 y retira los avisos conocidos de dependencias descritos abajo. Véase [actualización de seguridad del 27 de octubre](ATENEA_NEXT_SECURITY_2026-10-27.md). El resto del dictamen operativo NO-GO permanece; el texto original conserva la evidencia de la versión auditada.

Fecha de revisión: 26 de octubre de 2026 (America/Mexico_City).
Base: `02859cd79992e319e1764334560a22baa3845074`.
Head recibido: `1ad2d3d0d336652f1f4ae4730018a7a51538eacd`.

Durante la revisión apareció `34321e9c8dd36f708870e67ae54f91d2786f0af7`: ya corrige shell/rutas, restringe creación sin token del scheduler y cambia la prueba guiada a teclado/movimiento reducido. Se integró como padre, preservando todos esos cambios. Su [CI](https://github.com/antoniodiaz70ad-dev/frequency-healer/actions/runs/40436726083) declara correctamente el fallo de Cimática (120/121); la variante con teclado tampoco lo había resuelto. Esta auditoría añade el arreglo de fuga, su regresión, la corrección de Bentov y la evidencia. No atribuirle cambios que ya estaban hechos.

**NO-GO. No fusionar, promover, desplegar ni conectar proveedores.**
La UI sigue siendo un simulador. El backend y transporte Live incorporados después de la primera entrega existen, pero no demuestran una experiencia real segura.

## El CI verde no demostraba una suite aprobada

Se leyeron los logs completos, no solo el estado de los jobs:

| Ejecución | Resultado real UI | Estado del job |
| --- | --- | --- |
| [main, antes de ATENEA](https://github.com/antoniodiaz70ad-dev/frequency-healer/actions/runs/40116942199/job/120940065629) | 118 pruebas: 116 aprobadas, 2 fallidas | success |
| [head recibido del PR #33](https://github.com/antoniodiaz70ad-dev/frequency-healer/actions/runs/40435664441/job/121963613585) | 121 pruebas: 118 aprobadas, 3 fallidas | success |

Ambos jobs usaban comandos con `| tee` y shell implícito. `bash -e` devuelve el estado de `tee`; `false | tee archivo` sale con 0. Con `bash --noprofile --norc -eo pipefail` sale con 1. Se fija `shell: bash` explícitamente en ambos jobs: GitHub Actions incorpora `-eo pipefail` para ese shell. No se ocultan ni omiten pruebas para conseguir verde.

El job Quality del head recibido sí contiene **306 aprobadas, 0 fallidas, 0 omitidas**, incluida la integración Redis real. El defecto del shell obliga a comprobar también los logs de cualquier otro resultado histórico.

## Clasificación de los cuatro fallos reportados

| Fallo | Evidencia / atribución | Intervención |
| --- | --- | --- |
| Navegación durante audio | Reproducido en los logs del head y de main. Sidebar enlaza `/inicio`; el test esperaba `/`. Preexistente, confianza alta. | Corregir solo la expectativa a `/inicio`; conservar las comprobaciones de cierre de audio y ausencia de guardado. |
| Navegación de sesión guiada sin guardar | Mismo error y evidencia anterior. Preexistente, confianza alta. | Misma corrección; ambos tests pasan localmente después. |
| Cimática, `Saltar paso` | Reproducido en head y en un worktree limpio de main, con ATENEA y Live apagados. CI recibido también falla; main histórico pasó ese caso. Preexistente y sensible a ejecución, confianza alta. | Corregir fuga RAF y recálculo repetido de la curva modal. Después pasan ambos recorridos dirigidos y la suite completa local (124/124), sin aumentar timeouts. Falta confirmar Chromium exacto de CI. |
| Bentov | Pasa en CI actual y en pruebas dirigidas, pero se reprodujo en la suite local completa: timeout esperando `10:00`. El primer frame ya cambia el texto a `09:59` porque se redondean hacia abajo los segundos restantes. Código y expectativa ya estaban en main; confianza alta. | Corregir únicamente la prueba para aceptar el inicio del conteo (`10:00` o `09:5x`), manteniendo comprobaciones de práctica activa, controles y ausencia de audio. No modificar el módulo ni aumentar timeouts. |

### Defecto comprobado de Cimática

`CymaticsCanvas` podía iniciar otra cadena de `requestAnimationFrame` al recibir `ResizeObserver`, conservando la anterior. El cleanup cancelaba solo el último ID. La instrumentación delegó en las APIs nativas del navegador: observó 4 frames pendientes después de navegar fuera del laboratorio; durante la sesión guiada los pendientes crecieron hasta 60. La prueba nueva de desmontaje falla contra main sin el arreglo.

El arreglo mantiene una sola solicitud pendiente por canvas, cancela la anterior antes de cada render y marca el efecto inactivo al desmontarlo. No cambia física, frecuencias, audio, consentimiento o almacenamiento. La prueba nueva exige que queden cero callbacks pendientes después de navegar a `/inicio`. Falla antes y pasa después del arreglo. La medición independiente pasa de 4 callbacks residuales a 0 después de salir; el build final se regeneró desde un directorio de salida vacío para evitar reutilizar un bundle previo.

La fuga no explicaba todo el timeout. Un perfil CPU posterior localizó más de 30 segundos de muestras en `besselJ` y `computeModalField` durante el recorrido fallido. `ResponseChart` recalculaba los 101 campos de su curva en cada render del reloj o barrido, incluso sin cambiar la física ni el rango modal. Se memoriza la misma curva por configuración física y extremos de rango: no se reduce resolución, no se aproxima la fórmula y el marcador sigue cambiando. La clave excluye solo metadatos, vista y frecuencias actuales que `computeResponseCurve` no utiliza. Una regresión comprueba que mover el marcador conserva la curva y cambiar amortiguamiento la invalida.

Se conserva como prueba adicional el recorrido animado original con puntero, además del caso de teclado/movimiento reducido recibido en `34321e9`. Ambos pasan en la repetición dirigida (2/2). Al llegar al final, la prueba de teclado reveló una expectativa nueva incorrecta: exigía `AudioContext.state === closed`, pero `stopWithFade` conserva el contexto compartido y detiene/desconecta sus nodos. La aserción comprueba ahora osciladores terminados y desconectados, conforme al contrato existente; no se modifica el motor de audio.

## Diferencias entre local y CI

| Condición | CI | Esta revisión local |
| --- | --- | --- |
| Sistema | Ubuntu 24.04 | Ubuntu 24.04.3 |
| Node | 22.14.0 | Verificaciones finales con 22.14.0; primera pasada de dominio/build con 24.22.1 |
| Dependencias | `npm ci`, lockfile | `npm ci`, mismo lockfile, sin modificaciones |
| Navegador | Playwright Core 1.63.0, Chromium v1243 / Chrome for Testing 153.0.8010.12 | Descarga exacta falló por archivo truncado. Chromium headless 153.0.8010.0 empaquetado por `@sparticuz/chromium` 153.0.0, instalado fuera del repositorio. No es equivalencia exacta con CI. |
| Ejecución UI | Serial, `--test-concurrency=1`, build de producción local | Mismo comando, servidor exclusivamente loopback; no se accede a producción |
| Redis | Redis 7 real y `redis-cli` | Sin Redis configurado: una prueba se omite explícitamente |
| Flags | Matriz de laboratorio ON/OFF, voz real ausente/apagada | ON solo en proceso de pruebas sintético; Live y readiness forzados a false. Sin cambios de configuración externa |

Los resultados locales posteriores y la ejecución de CI corregida deben evaluarse por separado. El Chromium alternativo no acredita la combinación exacta del runner ni dispositivos físicos. La comparación anterior de 117/121 no identifica por sí sola un problema exclusivo del navegador local.

## Validación local de los cambios

- Dominio con Node 22.14.0: 306 pruebas, 305 aprobadas, 0 fallidas, 1 omisión explícita de Redis real. No confundirlo con el resultado CI de 306/306.
- Build limpio, TypeScript y ESLint completados correctamente. El build limpio utiliza Node 22.14.0.
- **Suite UI final completa: 124/124 aprobadas, 0 fallos, 0 cancelaciones, 0 omisiones** (194.3 s), incluyendo los dos recorridos guiados, Bentov, navegación, desmontaje, invalidación de curva y ATENEA simulado. Evidencia: `evidence/pr33-audit/ui-final.txt`. No equivale a voz real ni al Chromium exacto de CI.
- Dos regresiones de navegación corregidas: 2/2. Bentov y cancelación de frames pasan. La primera corrección de fuga dejaba el timeout de `Saltar paso` visible (2/3); después de corregir el recálculo redundante, pasan las dos variantes guiadas (2/2).
- Instrumentación nativa independiente: 4 callbacks después del desmontaje antes del arreglo, 0 después.
- Gates OFF: HTTP aprobado, dos escenarios visuales omitidos porque no corresponden con el laboratorio apagado.
- Una primera ejecución completa posterior reprodujo Bentov y evidenció que se estaba sirviendo un bundle anterior al arreglo del canvas. Se conservó esa salida de build fuera del repositorio y se regeneró desde cero antes de aceptar la prueba de limpieza. No se presenta aquella ejecución como verificación exitosa.
- Falta la suite UI completa del nuevo SHA con Chromium exacto de CI. El shell corregido debe impedir el verde si algún caso vuelve a fallar. **NO-GO permanece aunque el CI pase**, por los bloqueos operativos de voz real.

Validación siguiente: CI con Chromium fijado del nuevo SHA. La suite local y la invalidación de curva ante cambios físicos ya pasan. Estos resultados no autorizan voz real ni demuestran dispositivos físicos.

## Dependencias de una prueba real segura

| Área | Código existente revisado | Bloqueo verificable antes de habilitar |
| --- | --- | --- |
| Autenticación | JWT RS256, issuer/audience/scope/exp/iat y sujeto seudonimizado; rechazo anónimo; validación de origen | Conectar proveedor de identidad/login de staging, renovar tokens sin almacenamiento inseguro, probar expiración durante sesión y rotación de JWKS. No existe evidencia operativa de ese login. |
| Cuotas | Redis/Lua atómico, una sesión por usuario, reserva 600 s, 1800 s/día UTC, replay y propiedad | Provisionar y probar Redis real de staging y sus fallos; las reservas no son un límite monetario global ni contabilidad real. No habilitar Astra/Pro. |
| Cierre | Sideband espera `session.closed`; DELETE por propietario y watchdog autenticado | Provisionar scheduler externo, probar caída de navegador/Redis/scheduler, alertas y backlog. Una creación sin ID deja un caso ambiguo que requiere conciliación con proveedor; un TTL no prueba cierre facturable. |
| Privacidad | Clave solo servidor, `store:false`, sin persistencia automática de audio/transcript; consentimiento remoto versionado separado | UI todavía usa mocks y consentimiento local. Integrar consentimiento remoto nuevo, revisar aviso de retención real y controles de borrado/acceso. `store:false` regula almacenamiento de sesión, no demuestra ausencia de toda retención del proveedor. |
| Costes | Cuota conservadora de segundos, sin retry automático ni delegación hosted | Presupuesto global de proyecto, alertas y procedimiento de corte; medir coste real, sesiones ambiguas y cierre facturable. No se calculó un precio sin volumen/uso y contrato de cuenta. |
| Experiencia | Transporte WebRTC separado y probado con fakes | Integración de UI, órdenes finales verificables, `terminar`, interrupción acústica, 60 s de silencio, latencia y reproducción bloqueada. Probar iOS/PWA y Android físicos. Viewport móvil y micrófono falso no bastan. |
| Framework | Next.js 16.4.0 | El build y `npm audit --omit=dev --json` reportan vulnerabilidades, con severidad crítica y actualización disponible a 16.4.3. Evaluar actualización y regresión aparte; no se cambió el framework en esta auditoría. |

Referencias de contrato revisadas: [creación Live](https://developers.openai.com/api/reference/resources/live/methods/create), `liveRuntime.ts`, `liveAuth.ts`, `liveStore.ts`, `liveService.ts`, `liveReaper.ts`, `liveProvider.ts` y `liveConnection.ts`. Que el contrato esté documentado no demuestra disponibilidad ni políticas efectivas de la cuenta de staging.

## Criterios para reconsiderar NO-GO

1. CI del nuevo SHA con shell estricto: Quality sin fallos/omisiones de Redis real; builds y smoke ON/OFF; suite UI completa sin fallos ni cancelaciones, incluyendo la nueva regresión de animación. Comprobar además la interacción con puntero y animación de la variante original: la variante guiada con teclado/movimiento reducido no acredita por sí sola ese recorrido.
2. Comprobar explícitamente gates apagados, cero llamadas al proveedor en pruebas sintéticas y aislamiento del puente Base 60 y de `/voz`.
3. Resolver y verificar cada bloqueo operativo de la tabla; documentar coste y cierre remoto real con fallos inducidos.
4. Revisión humana posterior para credenciales, prueba real y despliegue. Este trabajo no concede GO ni modifica flags externos.

La excepción de auto-deploy de `codex/atenea-voz-mvp` permanece en ambos `vercel.json`. No se tocaron main, producción, secretos, configuración de identidad, Redis remoto ni scheduler.

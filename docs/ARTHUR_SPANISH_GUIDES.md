# Arthur: guías en español

Se conserva exactamente el perfil de la muestra aprobada por Antonio. No se sustituye por otra voz llamada Arthur.

## Procedencia y cobertura

- Proveedor de generación: Higgsfield, `text2speech_v2`, variante `elevenlabs`.
- Perfil aprobado: `30fc8796-ceb6-4a66-b3a7-4a145ef7f346`, tipo `preset`.
- Muestra aprobada: trabajo `00e41c0b-1331-49e0-81fa-5448555a265a`.
- Nueve grabaciones terminadas; siete pendientes por el límite diario del período de gracia del proveedor. El 27 de noviembre de 2026 se autorizaron doce generaciones con créditos existentes; el proveedor aceptó cinco y bloqueó la siguiente. Consumo confirmado: 2.4 créditos (989.49 → 987.09). No se reintentaron por otra vía para evadirlo.
- La cuenta propia de ElevenLabs contiene varias voces con ese nombre. No se verificó una equivalencia entre sus identificadores y el perfil aprobado; no se usaron para sustituirlo.

| Archivo | Trabajo de generación | Estado |
| --- | --- | --- |
| `crystals-prepare.mp3` | `61974af7-8612-4d35-9937-7aa32396b343` | Disponible |
| `crystals-define.mp3` | `0714a447-2e76-45e3-bbfd-59161f80fa59` | Disponible |
| `crystals-program.mp3` | 04cc16f6-bc72-4d74-bb72-66725ab61f9a | Disponible |
| `crystals-stabilize.mp3` | 1412974a-0d2d-4d16-8768-8b5f00302277 | Disponible |
| `crystals-close.mp3` | `843a7cdf-aa70-4706-829c-3adc0db3cd23` | Disponible |
| `marina-zero.mp3` | `c876bdcf-f37e-45ee-923f-04e5f1bf677c` | Disponible |
| `marina-emotion.mp3` | 3a4dfd4d-5620-42ab-ba43-353a5d8317ff | Disponible |
| `marina-blueprint.mp3` | 76213fbd-ccea-47ee-8368-7662f873db01 | Disponible |
| `marina-intensify.mp3` | 881e1608-28ba-4de5-a3a2-f756a9051ee5 | Disponible |

Cobertura actual: Cristales 5/5; Marina de 24 minutos 4/6; Marina de 12 minutos 0/5. Pendientes: marina-hold, marina-release, marina-neutral, marina-choose, marina-integrate, marina-express y marina-settle. El manifiesto contiene los 16 textos y usa `src: null` para cada grabación pendiente. La interfaz declara la cobertura de cada recorrido y conserva sus instrucciones escritas.

## Reproducción

- Activa «Leer instrucciones con voz» y selecciona «Arthur · español · ElevenLabs» antes de comenzar. La voz del dispositivo se conserva como alternativa explícita.
- Los MP3 públicos están en `frontend/public/audio/arthur-es-v1/`. No hay solicitudes al proveedor durante una sesión, credenciales de ElevenLabs en el navegador ni texto personal enviado para síntesis.
- Cada guía se descarga y decodifica antes de iniciar. Se reutiliza la caché del navegador y una caché de audio por contexto.
- Los clips se programan con `AudioBufferSourceNode` en el mismo reloj nativo de los tonos. Pausar detiene todas las fuentes; reanudar conserva el desplazamiento del clip y la fase. El volumen de la voz es independiente y puede ajustarse durante la práctica.
- Un fallo de descarga muestra un error y no activa automáticamente una voz distinta.
- «Mis coils» impide narración tanto en la interfaz como en el motor, para enviar únicamente los tonos.
- Una grabación personal de Marina tiene prioridad en su fase frente a la guía de Arthur.

## Añadir las grabaciones pendientes

Generar cada texto exacto del manifiesto con el mismo perfil aprobado cuando el proveedor vuelva a permitirlo. Confirmar idioma, contenido y voz; guardar el MP3 con su clave y cambiar únicamente su `src` de `null` a la ruta correspondiente. Registrar el trabajo aquí y ejecutar las verificaciones. No asumir equivalencia porque otra voz tenga el mismo nombre.

## Verificación y límites

Pruebas unitarias cubren textos, límites de fase, volumen, caché, cancelación, fallos y supresión en coils. La regresión de navegador decodifica los MP3 reales y verifica programación, pausa y reanudación sin llamadas pagadas. No se ha comprobado físicamente la reproducción con pantalla bloqueada en iPhone o Android para esta nueva narración; requiere una prueba en cada dispositivo.

## Verificación del 27 de noviembre

Los cinco trabajos nuevos terminaron en estado completed con motor elevenlabs, voice_type preset y voice_id 30fc8796-ceb6-4a66-b3a7-4a145ef7f346. Se conservaron los textos exactos del manifiesto. Archivos MP3 mono de 44.1 kHz, entre 9.48 y 13.64 segundos, verificados con ffprobe. Esta procedencia confirma perfil y parámetros, no una equivalencia acústica bit a bit con la muestra. No se compraron planes ni se sustituyeron voces. El bloqueo diario se respetó sin reintentos ni vías alternativas.

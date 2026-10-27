# Evidencia de backend y transporte Live

- `backend-local.txt`: 12 escenarios de autenticación, HTTP, concurrencia con doble de almacén, cuota, cancelación y cierre por sideband simulado.
- `transport-local.txt`: 9 escenarios WebRTC con peer/canal/audio/fetch simulados, incluyendo negociación tardía, pérdida de canal y reproducción bloqueada.
- `session-local.txt`: 17 escenarios del controlador simulado: permiso tardío, 60 s de silencio, interrupción, cierre, consentimiento y recuperación.

No se llamó a OpenAI ni se utilizaron claves reales. Los JWT de prueba se firman con material efímero generado por la suite; no son credenciales del servicio.

El test de Redis real se ejecuta en GitHub Actions con un contenedor aislado. Los resultados del build y Redis se enlazan en el PR del commit final; el sandbox local no permite Docker ni el puerto que abre Turbopack. No se presenta ese bloqueo local como un build exitoso.

Estos resultados no acreditan voz acústica, interrupción verbal, cierre facturable, login del usuario o acceso efectivo a los proveedores. El estado y los bloqueos están en [ATENEA_LIVE_BACKEND.md](../../ATENEA_LIVE_BACKEND.md).

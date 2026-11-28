# Sesiones descargables · primera entrega

Práctica rápida, compositor, Marina (guiada y libre) y Cristales ofrecen **Escuchar sin conexión · descargar sesión**. Preparar descarga no reproduce audio, inicia una práctica ni guarda registros. Genera localmente un WAV estéreo PCM de 16 bits y una ficha JSON con un mismo identificador, configuración, versión de render, duración, niveles, etapas, formato y grabaciones incluidas.

El resultado representa la configuración completa desde cero con los volúmenes del momento de preparar; no reconstruye ajustes manuales de una práctica previa. La ficha es informativa: no se importa como un diario. Para restaurar recetas editables sigue existiendo exportar/importar registros. No incorpora sincronización ni una PWA sin conexión.

## Uso

1. Elige duración, sonido y voz. Activa Arthur explícitamente si lo deseas.
2. Abre la sección de descarga y revisa duración, tamaño y cobertura de Arthur.
3. Pulsa Preparar descarga con la página abierta. Cancelar descarta el trabajo; puedes reintentar.
4. Pulsa Guardar audio WAV y, opcionalmente, Guardar ficha de configuración. La preparación por sí sola no conserva el archivo fuera de la pestaña.
5. Abre el WAV guardado en Archivos/Descargas con el reproductor del teléfono. Comprueba modo avión, pantalla bloqueada, pausa/reanudación, auriculares e interrupciones en dispositivos físicos.

Los enlaces conservan el resultado preparado aunque cambies ajustes después; indican que corresponden al momento de preparar. Se liberan al preparar otro resultado o salir del componente. No hay reproducción automática ni carga de intenciones a un proveedor.

## Fidelidad y límites

- Conserva capas, frecuencia por canal, pulsación sinusoidal, profundidad y niveles relativos del compositor; usa su normalización existente. Conserva etapas y fundidos de Marina y la secuencia de retirada de tonos y silencio de Cristales.
- Arthur utiliza exclusivamente los MP3 ya publicados de `arthur-es-v1`, decodificados a 44.1 kHz e insertados con sus offsets y fundidos existentes. No se solicita síntesis ni se sustituye su voz. PCM y cuantización no implican identidad binaria con el motor Web Audio.
- Cristales: 5/5 fases. Marina 24: 4/6. Marina 12: 0/5. Las fases sin MP3 conservan su duración sin narración. Si falla un MP3 solicitado se aborta, sin entregar audio parcial.
- Coils omite narración, como el reproductor. La voz del dispositivo y la grabación personal no se exportan. Si se solicita voz del dispositivo se exige cambiar a Arthur o desactivarla. Marina 12 con frase grabada bloquea la descarga para no omitirla silenciosamente.
- Mezcla con un divisor fijo `max(1, cotaTonos + picoVoz * volumenVoz)` para reservar margen frente a saturación; se registra en la ficha. No modifica las frecuencias ni normaliza cada fase por separado.
- Sin voz y con frecuencias bajo Nyquist se usa 22.05 kHz; con Arthur o frecuencias más altas, 44.1 kHz. Frecuencias incompatibles se rechazan, nunca se reducen por aliasing.
- Límite de 256 MiB por WAV, sin truncamiento automático. Ejemplos: Foco 5 min ~26.5 MB; Marina 24 con Arthur ~254 MB. Preparación requiere memoria y espacio suficientes. Tamaño visible antes de preparar.
- Web Worker sintetiza PCM en bloques de un segundo con transferencia y confirmación por bloque; evita reservar un AudioBuffer flotante de toda la sesión y permite cancelar. Sólo se decodifican las guías cortas.

## Verificación

Pruebas de adaptadores, tiempos de guía, silencio, WAV, estéreo 220/235 Hz, continuidad entre bloques, pulso, niveles, formato y límites. Pruebas de navegador con Worker real, cancelación/reintento, ausencia de audio activo/escrituras, lectura del WAV con red desconectada, decodificación de Arthur y fallo de descarga sin resultado parcial.

La comprobación automatizada del archivo no sustituye probar descarga y reproducción con pantalla bloqueada en iPhone y Samsung físicos.

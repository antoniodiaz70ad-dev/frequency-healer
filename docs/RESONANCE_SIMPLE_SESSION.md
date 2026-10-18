# Primera simplificación de Resonance Lab

Propósito: explorar la voz, observar una simulación sonora y conservar una comparación comprensible.

Esta entrega concentra el bloque de voz en tres pasos: capturar A, explorar/capturar B y comparar/guardar. Los controles de referencia, vista y dispositivo quedan en un desplegable. Las comparaciones vocales se guardan independientemente de la galería de figuras, con ambas lecturas originales, factores y configuraciones validadas. Se recuperan sin iniciar audio ni micrófono. El almacenamiento es local al navegador/origen; no migra de preview a producción. JSON continúa disponible como respaldo.

Si una voz multiplicada sale del rango modal, se ofrece un factor compatible que requiere pulsación explícita; no se altera el tono medido ni se ajusta a una resonancia automáticamente. La comparación advierte cuando los factores A/B son distintos.

Alcance: primer incremento sobre el PR #23. No cambia navegación global, motores de audio, ecuaciones físicas, ni protocolos OBE. No es un despliegue de producción. La unificación de toda la plataforma queda pendiente.

Validación: TypeScript, ESLint y 272 pruebas de lógica aprobadas, incluidas persistencia de comparaciones y protección de datos existentes frente a registros corruptos. La comprobación visual del nuevo preview y las pruebas de dispositivo real quedan pendientes.

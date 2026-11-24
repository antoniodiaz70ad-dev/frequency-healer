# Geometría e intención en el laboratorio existente

Entrada: `/laboratorio-cimatico?area=geometria`. El acceso predeterminado conserva Placas y membranas; ambas áreas comparten la navegación del Laboratorio Cimático. Cambiar de área desmonta la anterior y detiene su audio, micrófono y animaciones.

## Qué se incorpora

- Fuentes por afirmación con autor, localizador, tipo de aporte y alcance. Se incluyen Russell, el artículo aeronáutico de Howard de 2023, su patente, estudios de emoción y respiración y la demostración física de Chladni.
- Flor de la Vida de 7, 19 o 37 círculos; Lissajous con razones exactas y fase; ciclo visual inspirado en Russell; ensamblaje propio de seis pentágonos regulares con apertura, giro y copias.
- El ensamblaje pentangular es exploratorio. No reproduce el CAD original de Lynchpin ni calcula un campo físico o sus resonancias. El visor de Russell es una interpretación, identificada como tal. Las propiedades físicas de placas y membranas siguen en su área.
- Base editable de 40 a 1000 Hz; unísono, cuarta, quinta, sexta mayor y octava justas. Dos tonos mezclados en ambos canales, sin convertir su diferencia en una frecuencia emitida. Reutiliza el motor nativo del compositor y su mezcla acotada; escucha previa de 60 segundos con cambio de frecuencia explícito durante reproducción.
- Recorrido propio de cuatro tramos configurables entre 1 y 15 minutos cada uno. Sonido opcional, apagado inicialmente; al activarlo acompaña el recorrido completo. Pausa y reanudación conservan el tiempo. No usa narración ni cambia la tarea pendiente de Arthur.
- Diario con agrado, activación y claridad antes/después, intención, pensamiento, observación, decisión, acción y seguimiento con fecha. Guarda configuración, tiempo real, estado y cambios de volumen.

## Persistencia

El diario amplía el área de registro del laboratorio con la clave versionada `fh:cymatics-intention-v1`; no migra ni escribe las claves de los otros diarios. Solo guarda por acción explícita. Importación y exportación JSON; las importaciones combinan identificadores iguales solo con contenido idéntico. Un conflicto invalida la operación completa. Se conserva el original ante corrupción, cuota o límites. Escrituras bajo Web Locks, lectura actualizada dentro del bloqueo. Sin soporte de bloqueo, se conserva el borrador exportable.

Límites: 300 registros; 100 seguimientos por registro; 4000 caracteres por campo; 5 MB para el diario; valores y claves estrictamente validados. No hay sincronización automática entre dispositivos; se explica en la pantalla. Exportar permite conservar también el contenido original si está dañado.

## Reproducción y visualización

No hay audio al abrir la página o cargar datos. El audio requiere una acción explícita. El recorrido sonoro usa el reloj de AudioContext y finaliza de forma nativa a su duración; el silencioso usa un reloj monotónico pausado. Se reutilizan los controles multimedia e indicación de sesión de reproducción existentes. La prueba física de pantalla bloqueada requiere el teléfono.

La animación está apagada inicialmente y respeta `prefers-reduced-motion`. Solo anima Russell y el marcador Lissajous. Usa una base visual `f₀/256`, identificada como escala reducida; la razón se conserva. Se cancelan los fotogramas al ocultar o desmontar la vista. Los cambios de parámetros repintan la figura incluso con movimiento reducido.

## Validación prevista

Pruebas de razones y límites, regularidad de pentágonos, retícula hexagonal y cobertura de fuentes; fronteras de fase; datos emocionales y tiempos inválidos; persistencia explícita, cuotas, corrupción, concurrencia e importación atómica. Regresión nativa de navegador para audio real, cambio de intervalo, repintado, navegación, práctica silenciosa, pausa y reanudación, diario, seguimiento, recarga y portabilidad. Se mantiene la regresión completa del laboratorio anterior.

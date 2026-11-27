# Guardar y repetir — segunda entrega

La práctica rápida conserva versiones inmutables de receta con nombre y volumen inicial. Cargar no inicia audio. Cada práctica se registra por separado con ID propio, configuración original, referencia de versión cuando corresponde, fechas, tiempo, estado, cambios manuales de volumen y observación opcional. No se guarda automáticamente al escuchar una muestra, detener o navegar.

Al terminar o detener aparece un borrador que debe guardarse o descartarse explícitamente antes de iniciar otra práctica. El borrador no sobrevive al cierre o navegación. Las versiones y registros guardados sí permanecen en este navegador. Cargar/repetir comienza desde cero y usa la configuración inicial; los cambios manuales posteriores de volumen se registran pero no se automatizan al repetir.

Un documento local `fh.practice.records.v1` conserva estas versiones y prácticas juntas, validando referencias antes de escribir. No migra ni sobrescribe diarios de Marina, compositor, Cristales u otros módulos. Mis registros incorpora enlaces y conteos de estas dos nuevas colecciones con los mismos lectores de solo lectura.

Exportación/importación portable explícita: el archivo contiene estas prácticas rápidas y sus versiones, no todos los datos de la aplicación. Importar fusiona sin duplicar; cualquier conflicto de ID y contenido aborta la escritura completa. Los datos inválidos originales permanecen exportables. No se implementa sincronización, descarga de audio ni recuperación automática tras cerrar navegador.

Validación: pruebas de integridad, referencias, volúmenes, conflictos, importación idempotente e inmutabilidad. Regresión de interfaz para cargar tras recargar sin audio y guardar una práctica detenida con su configuración exacta. Pruebas físicas de teléfono pendientes.

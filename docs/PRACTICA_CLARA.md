# Práctica clara — primera entrega

En Practicar: Concentrarme (Foco 15 existente) y Calmarme (Punto Cero 7.8 existente), duración editable y preescucha de los primeros 15 segundos. Conserva capas y frecuencias. La muestra usa el mismo motor con un límite explícito; no modifica la receta ni escribe diarios. Comenzar tras una muestra vuelve a cero. Pausar conserva el punto de la práctica; cambiar receta o navegar cancela reproducción y arranques pendientes.

Arthur: muestra del MP3 aprobado de Marina, con controles nativos. La práctica guiada conserva sus controles actuales y declara 1/6 fases narradas. En Marina de 12 minutos se muestra Arthur pendiente y no se puede activar su narración vacía; la voz del dispositivo requiere elección explícita. No se generan audios.

Esta entrega no implementa guardado rápido, continuidad tras cerrar navegador ni sincronización. Los módulos y diarios existentes siguen disponibles. No hay afirmaciones terapéuticas. Las pruebas físicas de iPhone/Samsung con pantalla bloqueada siguen pendientes.

Verificaciones: prueba del motor para límite de 15 segundos, mezcla exacta y receta inmutable; regresiones de interfaz para auto-fin de muestra, comenzar desde cero, pausa/reanudación, cambio y desmontaje sin registros, y selección de Arthur sin clips. El navegador local de automatización no está instalado correctamente; las nuevas regresiones completas se ejecutan en CI. Se revisó manualmente la vista previa y controles principales en navegador remoto.

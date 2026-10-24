# SPEC-BENTOV-RESP-002 — Módulo interactivo Bentov v1.1

Fecha del encargo actualizado: 2026-10-23.
Repositorio: antoniodiaz70ad-dev/frequency-healer.
Rama autorizada: codex/bentov-respiration-lab-v1.
PR de entrega: #25, siempre en borrador.

## Encargo vigente y precedencia

Implementar el primer lanzamiento completo descrito abajo: aprendizaje interactivo, práctica de diez minutos, programa de catorce días, autoinformes, registro local, informe y exportación compatible. Esta versión sustituye SPEC-BENTOV-RESP-001.md y el encargo antiguo limitado a PR-1. No detenerse al terminar solo el temporizador: el resultado debe permitir el recorrido comenzar → practicar → registrar → revisar.

Cambios expresos frente al documento del 21 de octubre:
- Guía 5 s inhalar + 5 s exhalar, sin retenciones; fases 120 + 360 + 120 s.
- Tensión y claridad 0–10; conservar cero y tratar omisiones como null.
- Silencio durante la comparación inicial. Audio, sensores, HRV y conexión estructurada con Base60 quedan fuera de este lanzamiento.
- Programa 14 días con 7 sesiones pautadas y 7 naturales asignadas de antemano.
- Semanas 3–4 opcionales para una entrega posterior; no bloquear el primer lanzamiento por ellas.
- Entregar implementación y pruebas en este PR. No modificar main, hacer merge, activar auto-merge, tocar secretos, migrar datos remotos ni desplegar a producción.

## Interacción educativa acordada con el usuario

Además de la guía respiratoria, incluir un péndulo educativo accesible, opcional y separado del cronómetro de práctica:
1. Controles de frecuencia y amplitud, reproducción/pausa y restablecer.
2. Visualizar un movimiento armónico idealizado con x = A cos(2πft + fase) y v = -2πfA sen(2πft + fase). Mostrar unidades y velocidad finita; en los extremos v = 0 y al cruzar el centro la rapidez es máxima.
3. Etiqueta breve “Simulación armónica”. No representar la frecuencia y amplitud como independientes en un péndulo gravitatorio exacto de longitud fija.
4. Los controles educativos no alteran la pauta respiratoria 5+5 ni se presentan como mediciones corporales.
5. Ofrecer una explicación textual equivalente y movimiento reducido. La teoría puede explorarse y cerrarse; no es una barrera antes de cada práctica.

La experiencia debe ser práctica e interactiva: dos valoraciones iniciales, guía visual, controles de detener/respirar libre, valoración posterior, nota/acción opcional y revisión de resultados. No añadir tutoriales largos obligatorios ni una nueva aplicación independiente.

## Revisión y especificación completa

Versión propuesta 1.1 · 23 de octubre de 2026

**Decisión recomendada:** implementar primero en Resonance Lab / Frequency Healer, como “Respiración y atención”. Base60 puede incorporar después el seguimiento de acciones y la reflexión sobre el tiempo. Esta revisión prepara la implementación; no modifica ni despliega las aplicaciones.

El valor para el desarrollo personal es observar cómo cambia la experiencia y cómo se traduce en una conducta cotidiana. Una sensación intensa, una frecuencia alta o una estimación temporal distinta no constituyen por sí mismas una medida de desarrollo.

## 1. Encaje en las aplicaciones

| Parte del módulo | Destino recomendado | Motivo |
|---|---|---|
| Péndulo didáctico, frecuencia, amplitud y fase | Resonance Lab | Encaja con sus laboratorios de oscilación y sonido. |
| Práctica respiratoria, registro antes/después y comparación personal | Resonance Lab | Un solo temporizador y una sola fuente del registro de sesión. |
| Acción elegida, seguimiento posterior y relación con la jornada | Base60, en una segunda entrega | Encaja con la bitácora y el trabajo sobre decisiones. |
| Experimento específico de percepción temporal | Entrega posterior, con protocolo propio | La sesión conocida de diez minutos no permite una estimación independiente. |

Base60 es aquí una forma de organizar y representar el tiempo. El uso de sesenta minutos o de seis respiraciones por minuto no demuestra un mecanismo fisiológico común.

**Alcance del primer lanzamiento:** comparación de catorce días, guía sin retenciones, registros breves, informe descriptivo y exportación. Las semanas 3–4 quedan como extensión exploratoria opcional. Esta es una reducción de alcance propuesta respecto al documento original, no una validación experimental del protocolo.

## 2. Hallazgos concretos en el código

Se leyó el módulo adjunto completo y se inspeccionaron las copias de trabajo de ambas aplicaciones. Los archivos decisivos siguientes también se verificaron en la rama principal de GitHub el 23 de octubre de 2026.

| Archivo existente | Hallazgo | Consecuencia para implementar |
|---|---|---|
| Frequency Healer: frontend/src/components/BreathingGuide.tsx | Secuencia fija de 4 s de inhalación, 7 s de retención, 8 s de exhalación y 1 s de pausa. | No sirve directamente para el protocolo de 0,1 Hz sin retenciones. Crear una guía específica o extraer un motor configurable manteniendo intacta la configuración anterior. |
| Frequency Healer: frontend/src/lib/types.ts | OBESessionLog exige campos de parálisis, separación y claridad visual. | Crear BentovSession; no inventar valores OBE ni guardar este módulo bajo esa entidad. |
| Frequency Healer: frontend/src/lib/dataExport.ts | La exportación usa una lista explícita de claves, validadores y contrato versionado. La verificación comprueba cantidad y orden de claves. | Añadir el módulo mediante una versión de exportación nueva y conservar la lectura de exportaciones anteriores. Cambiar únicamente la lista rompería compatibilidad. |
| Base60: app/api/entries/route.ts | El registro exige contexto temporal y lunar; limita claridad y estrés a 1–10. | No enviar la sesión Bentov directamente: utiliza 0–10, otra duración y otra semántica. El cero sería transformado en uno. Hace falta un contrato de integración explícito. |

La copia local de Frequency Healer usa la marca Resonance Lab, estilos FH y navegación por laboratorios. Puede conservarse ese diseño. El diario OBE y sus reglas de descanso no son un registro general de bienestar: no deben aplicarse automáticamente a este nuevo módulo.

Fuentes de código:
- [BreathingGuide.tsx](https://github.com/antoniodiaz70ad-dev/frequency-healer/blob/main/frontend/src/components/BreathingGuide.tsx)
- [types.ts](https://github.com/antoniodiaz70ad-dev/frequency-healer/blob/main/frontend/src/lib/types.ts)
- [dataExport.ts](https://github.com/antoniodiaz70ad-dev/frequency-healer/blob/main/frontend/src/lib/dataExport.ts)
- [Base60: entries](https://github.com/antoniodiaz70ad-dev/base60-platform/blob/main/app/api/entries/route.ts)

Identificadores de los archivos verificados, para reproducir la revisión:
- BreathingGuide.tsx: f614478b4b775904e83ac7773fa9acd3a0dc9cfa.
- types.ts: 7ef42587cf46484c2fce81a511b38bdb26857152.
- dataExport.ts: 7749feab035a2b6af0aa1455ec79406e1462b3a5.
- Base60 entries: 48dcbd08e6f085d166d7072038db96e835f54beb.

Estos hallazgos describen código disponible; no certifican qué versión está desplegada. No se ejecutaron pruebas de las aplicaciones porque esta entrega es una revisión y no cambia su implementación.

## 3. Correcciones al contenido original

### 3.1 Péndulo y respiración

Cambiar “punto de reposo” por **punto de inversión**. En el extremo, la velocidad instantánea es cero; el péndulo no permanece detenido durante un segundo. La relación v máxima = 2πfA corresponde al movimiento armónico simple; para un péndulo gravitatorio es una aproximación de ángulo pequeño si A expresa desplazamiento compatible. En ese modelo la magnitud de la aceleración es máxima en los extremos. No generalizarlo a toda aceleración de cualquier péndulo. [1]

Eliminar “la pausa es el punto de mayor carga”. Traslada una magnitud mecánica a la respiración sin justificar la equivalencia. Texto propuesto:

> Observa el cambio entre inhalar y exhalar, sin detener deliberadamente el aire. La animación sirve como referencia; no mide tu respiración.

La animación respiratoria no necesita simular un péndulo gravitatorio físicamente exacto. El péndulo didáctico sí debe declarar su modelo. Mantener ambas funciones diferenciadas.

### 3.2 Ritmo exacto y frecuencia realmente observada

La pauta original 4–5 s más 5–6 s produce ciclos de 9–11 s: aproximadamente 5,45–6,67 ciclos/min. Si además se añaden pausas, cambia otra vez.

Para la comparación propuesta, fijar **5 s de inhalación + 5 s de exhalación**, sin retención: un ciclo de diez segundos, seis ciclos/min, 0,1 Hz. La elección 5+5 simplifica el protocolo; no se presenta como superior a 4+6. Si resulta incómoda, permitir respiración natural o finalizar.

Mostrar “Ritmo de la guía: 6 ciclos/min”. Sin sensor respiratorio, no mostrar “Respiraste a 0,1 Hz”. La amplitud del círculo tampoco mide volumen pulmonar.

### 3.3 Resonancia y ensayo de 2026

La literatura sobre variabilidad cardiaca describe respuestas alrededor de 0,1 Hz y diferencias individuales. Guiar a ese ritmo no prueba haber encontrado la resonancia de una persona. [2]

El ensayo citado sí existe: Sumińska, Rynkiewicz y Szulczewski, Scientific Reports 16, 22630 (2026), DOI 10.1038/s41598-026-53333-6. Comparó frecuencia individualizada, 0,1 Hz fijo y control. No encontró diferencias claras entre las dos intervenciones, pero sus autores advierten que los resultados no permiten conclusiones firmes sobre superioridad o equivalencia. [3]

Sustituir “no hace falta buscar tu frecuencia exacta” por:

> Este módulo comienza con una pauta sencilla de seis ciclos por minuto. No identifica tu frecuencia de resonancia ni garantiza que sea la más cómoda para ti.

El estudio empleó biofeedback; no valida automáticamente una guía visual sin sensor ni este plan concreto de catorce días.

### 3.4 Percepción del tiempo

Conocer que una práctica dura diez minutos introduce una referencia fuerte. Ocultar el reloj no elimina ese conocimiento; contar ciclos también proporciona una pista.

En la primera versión, registrar opcionalmente “se sintió corta / intermedia / larga”, como experiencia subjetiva. No usar el cociente tiempo percibido/transcurrido como indicador principal de progreso. Si se conserva una estimación numérica, identificarla como estimación con duración conocida.

El estudio de Yarrow de 2001 documenta una ilusión vinculada a movimientos sacádicos de los ojos. No valida el ejercicio completo de visualización de Bentov ni convierte los “segundos detenidos” autoinformados en una medida de conciencia. [4] Reservar el reloj para una explicación opcional, sin puntuación.

Un experimento temporal posterior necesitaría intervalos de duración no anticipada, instrucciones constantes, orden aleatorio, varias repeticiones y control de pistas temporales. Debe ser una tarea separada de la guía respiratoria.

### 3.5 Comparación y diario

Cambiar “si no hay diferencia, se dice que no hay diferencia” por “estos registros no muestran una diferencia clara”. Con pocos datos, ausencia de una diferencia observada no demuestra equivalencia.

Repetir una experiencia permite estudiar su consistencia; no valida por sí solo su interpretación, su causa ni una afirmación metafísica.

Observación, interpretación y comprobación son una buena estructura. No obligar a completar la comprobación al terminar: se refiere a algo que sucede después. Permitir “pendiente” y “no pude comprobarlo”. La pregunta sobre evidencia de una intuición debe ser una ayuda opcional, no un requisito para guardar.

Observar un posible antecedente de un pensamiento es introspección. No se debe afirmar que el usuario identificó el origen neuronal del pensamiento.

### 3.6 Otras precisiones

- La existencia de ondas estacionarias y holografía no valida todas las analogías del capítulo 1. En la app cimática, si la figura es calculada, llamarla simulación de una placa; no medida de una placa física ni del usuario.
- El batido físico de dos ondas mezcladas y la percepción binaural son fenómenos distintos. Una diferencia de diez Hz no demuestra que el cerebro oscile globalmente a diez Hz. Si se incorpora audio después, mantener el volumen cómodo y el carácter opcional. La revisión de 2023 encontró resultados inconsistentes sobre sincronización cerebral. [5]
- Sustituir “7 Hz: no replicado” por “el material revisado no aporta validación suficiente para usar esta afirmación como función medible”. Esta revisión no es una búsqueda sistemática de todas las posibles replicaciones.
- El vínculo cuerpo–Schumann no se convierte en mecanismo por cercanía numérica.
- La referencia de Huygens está mal atribuida: arXiv:0802.1024 corresponde a **Rui Dilão (2008), Synchronizing Huygens’s clocks**, no a Bennett et al. [6]
- Zelano et al. (2016) está verificado. Estudia respiración nasal, actividad en regiones cerebrales concretas y tareas cognitivas; no valida “elevar la conciencia” ni este protocolo de 0,1 Hz. [7]

## 4. Protocolo propuesto para la primera versión

Nombre en pantalla: **Respiración y atención**.
Subtítulo informativo: “Exploración personal inspirada en preguntas de Bentov”.

Preparación y evaluación posterior se hacen fuera del temporizador. Así se evita que escribir más o menos modifique el tiempo de práctica. La práctica dura diez minutos; el recorrido completo requiere algo más.

| Momento | Día con pauta | Día natural |
|---|---|---|
| Antes de empezar | Tensión y claridad, 0–10; se puede omitir. | Igual. |
| Minutos 0–2 | Respiración natural. | Respiración natural. |
| Minutos 2–8 | Guía 5+5, seis minutos, sin retenciones. | Respiración natural, sin animación rítmica ni conteo. |
| Minutos 8–10 | Respiración natural y observación. | Igual. |
| Al terminar | Tensión, claridad, comodidad; observación y acción opcionales. | Igual. |

Los dos minutos iniciales son preparación, no una medición fisiológica basal. El usuario puede mantener los ojos abiertos. La guía no pide inhalar profundamente ni aumentar el volumen de aire.

La instrucción común es observar sin buscar sensaciones especiales. La pauta introduce una diferencia visual y de expectativa que no queda cegada; la comparación explora la experiencia del conjunto de la práctica, no aísla un mecanismo biológico.

**Plan de catorce días:**
- Al inscribirse, generar y guardar el calendario completo: cuatro días pautados y tres naturales en la primera semana; tres pautados y cuatro naturales en la segunda.
- Barajar el orden dentro de cada semana y conservar el resultado. “Aleatorio” no significa alternar obligatoriamente uno y otro.
- Fijar fechas usando la zona horaria elegida al comenzar. Un día omitido se marca omitido; no se vuelve a sortear.
- Registrar una sesión programada por fecha. Prácticas adicionales son libres y quedan fuera de la comparación principal.
- No exigir compensar sesiones ni aumentar intensidad para conservar una racha.
- En estos catorce días, mantener silencio en ambos modos. Audio, ejercicio introspectivo adicional y otras variaciones se registran fuera de esta comparación.

**Semanas 3–4, extensión opcional:** mantener la pauta cómoda que el usuario elija. Añadir observación de pensamientos y seguimiento de acciones. No imponer respiración pautada si resultó incómoda. No mezclar sus resultados con la comparación inicial.

**Texto visible de salida:** “Respira con suavidad. Si aparece mareo, hormigueo o falta de aire, detén la guía y vuelve a tu respiración habitual”. Respirar lentamente pero con un volumen excesivo puede producir hiperventilación. [8] Ante malestar fuerte o persistente, la app debe aconsejar valoración profesional. No interpretar malestar como progreso. La literatura también documenta experiencias difíciles durante meditación; el estudio de Lindahl no permite estimar su frecuencia en este módulo concreto. [9]

## 5. Datos y significado

Guardar valores numéricos ausentes como null. Cero es una respuesta válida, no ausencia.

| Entidad/campos | Significado y regla |
|---|---|
| BentovProgram: id, schema_version, protocol_version, created_at, timezone, start_date, schedule | Calendario completo e inmutable una vez iniciado. Cada elemento contiene fecha y modo asignado; las omisiones se registran aparte. |
| BentovSession: id, program_id, scheduled_date, assigned_mode | Identidad estable de una sesión y su asignación. |
| actual_mode: paced / natural / mixed | Lo que se ejecutó; distinto de lo asignado si el usuario cambia la pauta. Describe la guía ejecutada, no respiración verificada. |
| status: completed / stopped / interrupted | Finalización real. Cambiar a otra pantalla o cerrar la app no equivale a completar. |
| started_at, ended_at, elapsed_active_ms, elapsed_wall_ms | Fechas para ordenar; tiempo activo separado del tiempo total de reloj. |
| protocol_version, target_inhale_ms, target_exhale_ms, guided_active_ms | Parámetros realmente utilizados; valores nulos cuando no corresponden. |
| tension_pre/post, clarity_pre/post | Autoinformes 0–10. Tensión: ninguna a máxima percibida; claridad: ninguna a máxima percibida. Mantener los mismos anclajes. |
| pre_recorded_at, post_recorded_at, comfort | Momento del autoinforme y comodidad: cómoda / neutra / incómoda, opcional. |
| interruptions, deviations, stop_reason | Hechos del recorrido, por ejemplo pausa manual, pestaña oculta o cambio de modo. |
| observation, interpretation, action | Texto opcional del usuario, sin evaluación automática. |
| followup: status, text, recorded_at | Comprobación posterior: pendiente / registrada / no comprobada. |
| perceived_duration_category | Experiencia opcional con duración conocida; no indicador de exactitud temporal. |

El primer lanzamiento no incluye HRV, puntuación de coherencia, segundos de reloj detenido ni una “frecuencia personal”. La interfaz no muestra gráficos fisiológicos de ejemplo como si fueran datos reales.

Etiquetas de procedencia:
- **Registrado por la app:** duración e interrupciones.
- **Reportado por ti:** tensión, claridad, comodidad y notas.
- **Calculado:** cambio antes/después y medias.
- **Simulado:** oscilador didáctico.
- **No disponible:** cualquier medida fisiológica sin adquisición válida.

Una ampliación de HRV requiere un diseño específico: intervalos entre latidos válidos, fuente del sensor, unidades, duración de ventana y calidad de señal. Un valor de pulso promedio no basta para calcular RMSSD. Reposo y respiración pautada se analizan por separado; no extraer una conclusión de mejora duradera a partir del aumento durante la pauta.

## 6. Informe que sí puede mostrar la app

Por sesión, calcular:
- Cambio de tensión = tensión posterior − tensión previa. Un valor negativo indica menor tensión reportada.
- Cambio de claridad = claridad posterior − claridad previa. Un valor positivo indica mayor claridad reportada.

Mostrar cada punto, la media y el rango por modo; mostrar el número de pares disponibles para cada variable. No convertir una escala subjetiva de 0–10 en un porcentaje de “sanación”.

La comparación principal incluye sesiones programadas completas, sin cambios de pauta, con el par de respuestas necesario. Es una selección descriptiva: puede favorecer las prácticas más tolerables. Por ello, junto a las medias deben verse todos los días asignados, completados, omitidos, interrumpidos y cambiados, y sus motivos cuando consten. No ocultar los abandonos.

Si un grupo no tiene pares, mostrar “Todavía no hay datos comparables”. Con un único registro mostrar el punto, sin sugerir estabilidad. No imputar ceros ni usar respuestas posteriores como sustituto de las anteriores.

Texto del informe:

> Estos datos describen tus respuestas en estas sesiones. La cantidad es pequeña y conocías la práctica que realizabas. Las diferencias pueden reflejar la pauta, expectativas, el contexto del día u otros factores.

La acción cotidiana aporta contexto: “hice una pausa antes de responder”, “retomé la tarea” o “no observé cambio”. No se puntúa una personalidad ni un nivel de conciencia. El número de comprobaciones es uso del diario, no evidencia de desarrollo.

## 7. Implementación en Resonance Lab

Ruta propuesta: /respiracion-atencion. Entrada discreta desde “Explorar”; mantener el lenguaje visual existente.

Archivos propuestos, sujetos a revisar la rama actual antes de programar:
- frontend/src/app/respiracion-atencion/page.tsx
- frontend/src/components/bentov/BentovModule.tsx
- frontend/src/components/bentov/PacedBreathing.tsx
- frontend/src/lib/bentov/types.ts
- frontend/src/lib/bentov/protocol.ts
- frontend/src/lib/bentov/storage.ts
- frontend/src/lib/bentov/summary.ts

Usar los componentes FH existentes para superficies, botones y encabezados. La teoría es breve y desplegable; no bloquear cada sesión con una lección.

Persistir programa, sesiones y borrador bajo claves propias, por ejemplo rl:bentov-programs:v1 y rl:bentov-sessions:v1. Validar estructura y versión al leer. Un archivo o registro corrupto debe conservarse y ofrecer exportación del original; no sustituirlo silenciosamente por una lista vacía.

Guardar con identificadores estables para evitar duplicación al pulsar dos veces. Mantener el borrador si falla el almacenamiento y ofrecer una descarga de recuperación. Informar al usuario de que los registros locales pertenecen a ese navegador y de las opciones de exportación/borrado.

**Temporizador:**
- Usar un reloj monotónico para duración activa. El número de callbacks ejecutados no es una medida de segundos.
- Derivar fase y avance de ese tiempo; no acumular deriva con sucesivos timeouts.
- La guía representa un ciclo completo cada diez segundos: inhalar y exhalar no se cuentan como dos ciclos.
- Al ocultarse la pestaña, pausar la guía y registrar la interrupción. No contabilizar ese intervalo como práctica guiada verificada.
- Al volver, ofrecer continuar como sesión exploratoria o finalizar. La app no debe acelerar ciclos para recuperar tiempo.
- El botón Detener permanece visible; cancela animación y cualquier recurso propio de la sesión. Nunca iniciar audio automáticamente.
- En modo natural, evitar estímulos que marquen seis ciclos/min.
- Admitir movimiento reducido, controles de teclado y textos de fase. Evitar anuncios de lector de pantalla cada segundo.

**Exportación:** definir una versión 2 que incorpore las nuevas claves y mantener el verificador de versión 1 con su lista histórica. Conservar el cálculo de integridad de cada contrato. Añadir simplemente claves a la lista de versión 1 haría que exportaciones antiguas dejaran de coincidir.

Antes de escribir código, leer AGENTS.md y las guías locales de la versión de Next.js instalada, como exige el repositorio. Implementar en una rama nueva y una vista previa; el presente documento no constituye una implementación ni un despliegue.

## 8. Integración posterior con Base60

Primera posibilidad, de bajo coste: copiar voluntariamente un resumen legible a la bitácora. El texto conserva las escalas y unidades originales; no realiza una transferencia automática.

Para una integración estructurada posterior, definir un registro propio de reflexión vinculado a una sesión externa, con:
- source_app, source_session_id y source_protocol_version.
- Fecha original de sesión, zona horaria y fecha de importación distintas.
- Acción elegida, observación posterior y estado de seguimiento.
- Campos explícitos para tensión y claridad 0–10, si se decide importarlos.

No reutilizar directamente los campos 1–10 de Base60 ni transformar cero en uno. No rellenar contexto lunar inventado para superar la validación del endpoint actual. No atribuir causalidad a la hora, al cuadrante o a la fase lunar.

La importación debe mostrar una vista previa, realizarse a petición del usuario y evitar duplicados con la identidad de origen. No enviar diarios o valores personales en parámetros de URL. Las dos aplicaciones no deben asumir que comparten una identidad autenticada.

Esta integración no debe alterar la rueda de Mi Tiempo ni crear un segundo temporizador de la misma práctica.

## 9. Criterios de aceptación de la futura implementación

1. Una guía 5+5 completa seis ciclos en sesenta segundos, sin retenciones; el modo natural no contiene esa pauta.
2. El calendario contiene 7/7 asignaciones, conserva los bloques 4/3 y 3/4 y no cambia al recargar, omitir o detener.
3. Una interrupción no produce una sesión completada ni tiempo activo ficticio.
4. Cero se conserva; null no entra en medias. Los denominadores por variable reflejan respuestas realmente disponibles.
5. El informe muestra abandonos y cambios de modo además de los resultados comparables.
6. Un fallo de almacenamiento conserva la sesión recuperable; doble guardado no duplica registros; no se sobrescriben datos corruptos.
7. La nueva exportación contiene el módulo y verifica su integridad. Una exportación V1 previa sigue validándose.
8. Los registros y flujos de voz, cimática, OBE y generador conservan su comportamiento previo.
9. No aparece una medida de HRV, respiración real, resonancia personal o conciencia derivada de una animación.
10. La interfaz funciona con teclado, pantalla móvil y movimiento reducido; Detener es accesible durante toda la práctica.

En la implementación ejecutar las comprobaciones del repositorio: lint, typecheck, pruebas del protocolo/almacenamiento/informe/exportación, flujos de interfaz afectados y build. El alcance de esas pruebas se debe ajustar a los cambios reales. No hacen falta pruebas que se limiten a repetir textos.

## 10. Referencias verificadas y alcance

[1] OpenStax, University Physics Volume 1, 15.1, Simple Harmonic Motion. Sustenta las relaciones del modelo armónico.
https://openstax.org/books/university-physics-volume-1/pages/15-1-simple-harmonic-motion

[2] Lehrer, P. M. y Gevirtz, R. (2014). Heart rate variability biofeedback: how and why does it work? Frontiers in Psychology, 5:756. DOI 10.3389/fpsyg.2014.00756. Explica mecanismos propuestos y diferencias de frecuencia.
https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.00756/full

[3] Sumińska, S., Rynkiewicz, A. y Szulczewski, M. (2026). Resonance frequency versus fixed 0.1 Hz breathing in HRV biofeedback: a four-week randomized comparison. Scientific Reports, 16:22630. DOI 10.1038/s41598-026-53333-6. Consultado el texto del editor disponible en ResearchGate; la página directa de Nature no fue accesible durante esta comprobación.
https://doi.org/10.1038/s41598-026-53333-6
https://www.researchgate.net/publication/405014097_Resonance_frequency_versus_fixed_01_Hz_breathing_in_HRV_biofeedback_a_four-week_randomized_comparison

[4] Yarrow, K., Haggard, P., Heal, R., Brown, P. y Rothwell, J. C. (2001). Illusory perceptions of space and time preserve cross-saccadic perceptual continuity. Nature, 414:302–305. DOI 10.1038/35104551.
https://openaccess.city.ac.uk/id/eprint/333/

[5] Ingendoh, R. M., Posny, E. S. y Heine, A. (2023). Binaural beats to entrain the brain? A systematic review of the effects of binaural beat stimulation on brain oscillatory activity, and the implications for psychological research and intervention. PLOS ONE, 18(5):e0286023.
https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0286023

[6] Dilão, R. (2008). Synchronizing Huygens’s clocks. arXiv:0802.1024. Modelo de sincronización en fase y antifase; corrige la atribución de la referencia original.
https://arxiv.org/abs/0802.1024

[7] Zelano, C. et al. (2016). Nasal Respiration Entrains Human Limbic Oscillations and Modulates Cognitive Function. Journal of Neuroscience, 36(49):12448–12467. DOI 10.1523/JNEUROSCI.2586-16.2016.
https://pmc.ncbi.nlm.nih.gov/articles/PMC5148230/

[8] Szulczewski, M. T. (2019). Training of paced breathing at 0.1 Hz improves CO2 homeostasis and relaxation during a paced breathing task. PLOS ONE, 14(6):e0218550.
https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0218550

[9] Lindahl, J. R. et al. (2017). The varieties of contemplative experience: A mixed-methods study of meditation-related challenges in Western Buddhists. PLOS ONE, 12(5):e0176239.
https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0176239

Fuente conceptual original: Bentov, I. (1977), Stalking the Wild Pendulum. Se utiliza como inspiración histórica y objeto de lectura crítica. Las decisiones de producto, el protocolo 1.1 y los criterios de aceptación anteriores son propuestas de esta revisión, no resultados publicados.


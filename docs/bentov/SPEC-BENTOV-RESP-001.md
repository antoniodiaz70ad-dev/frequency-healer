> **Referencia histórica sustituida el 2026-10-23.** El encargo vigente está en [SPEC-BENTOV-RESP-002.md](./SPEC-BENTOV-RESP-002.md). Sus parámetros, alcance y criterios prevalecen sobre este documento. La versión vigente incluye el recorrido completo y conserva producción intacta.

# SPEC-BENTOV-RESP-001 — Laboratorio Bentov: Resonancia cardiorrespiratoria V1

Fecha: 2026-10-21
Estado: ENCARGO A CODEX / pendiente de implementación
Repositorio: antoniodiaz70ad-dev/frequency-healer
Rama de trabajo: codex/bentov-respiration-lab-v1

## Propósito científico
Construir un módulo de bienestar de diez minutos que explore la relación entre respiración guiada, respuesta cardiovascular medida cuando exista sensor compatible y experiencia subjetiva. Bentov inspira la pregunta, NO justifica afirmar que el universo es consciente ni que medimos conciencia, chakras, viajes astrales o capacidades terapéuticas.

**Prohibiciones:** resultados inventados, falsa medición de coherencia, presentar frecuencia respiratoria GUIADA como frecuencia respiratoria REAL, estimar HRV solo a partir del pulso, afirmar que 0.1 Hz es frecuencia fisiológica individual óptima.

## Protocolo de 600 segundos
- 0–120 s: reposo, respiración espontánea sin metrónomo.
- 120–480 s: respiración guiada durante 360 s con 4 s inhalar + 6 s exhalar; ritmo mostrado 0.1 Hz, 6 ciclos/minuto, 36 ciclos previstos.
- 480–600 s: recuperación con respiración natural, sin guía obligatoria.
- Pausa, reinicio y salida segura. Computar tiempo con reloj monotónico, no contar renders. Gestionar suspensión y visibilidad de pantalla; registrar duración real y discontinuidades.
- Antes y después: estrés y calma 0–10; después: comodidad respiratoria 0–10, síntomas adversos sí/no, cumplimiento autorreportado opcional.
- Respiración lenta suave, no profunda/forzada; detener ante mareo, disnea, dolor o malestar. No imponer retenciones. Aviso no clínico.

## Fases y visualización
Interfaz simple: preparación -> sesión -> resultados -> historial local optativo. Círculo que se expande 4 segundos y contrae 6 segundos, con indicador textual accesible. Audio opcional sujeto a permisos del navegador. Reducir movimiento; lector de pantalla; controles grandes; no perder funciones de tonos, voz, binaurales o laboratorio cimático.

## Modos de datos
1. Sin sensor: mostrar SOLO parámetros de guía, duración, pausas, autoevaluaciones y respuestas de usuario; NO pulso/HRV/coherencia.
2. Con sensor validado (futuro o implementación aislada): diseñar contrato HeartIntervalSource para intervalos NN/RR procedentes de dispositivo apropiado; registrar tipo, procedencia, latencia y calidad. No asumir que Web Bluetooth/HealthKit funciona en todos los navegadores ni en iOS.
3. Datos sintéticos para pruebas: marcar visiblemente DATOS SIMULADOS y no mezclar con datos reales.

## HRV: condiciones de medición
Cuando haya intervalos NN adecuados:
RMSSD = sqrt(mean((NN[i+1]-NN[i])^2))
SDNN = desviación estándar muestral de intervalos NN válidos.
Ambas métricas en ms. Conservar ventana temporal, política de artefactos, proporción válida, marca temporal y procedencia. Interrumpir/suprimir el cálculo cuando datos sean insuficientes. No comparar 2 minutos con una referencia clínica estandarizada de 5 minutos como si fueran equivalentes. No interpretar LF/HF como balance autonómico ni HRV como prueba de estados superiores de conciencia.
Sin sensores respiratorios no se calcula sincronía real entre respiración fisiológica y ritmo cardíaco: mostrar únicamente sincronía de la guía.

## Diseño de software
Codex DEBE inspeccionar primero estructura real, framework, rutas, test runner y despliegues. Adaptar nombres a convenciones existentes y evitar cambios innecesarios. Separar responsabilidades:
- BreathingProtocolEngine (tiempo, fases, interrupciones)
- BreathingVisualizer (animación, reducción movimiento, accesibilidad)
- AudioCueEngine (opcional)
- PhysiologyAdapter / HeartIntervalSource (stub e integración desacoplada)
- SignalQualityValidator (artefactos y calidad)
- HRVAnalyzer (cálculos puros solo para datos reales/sintéticos identificados)
- SessionRepository (local voluntario, exportación y eliminación)
- SessionReport (fuentes, límites y resultados)
- SafetyController (parar, síntomas, mensajes)

Modelo mínimo: id, schemaVersion, startedAt, plannedDurationSec=600, actualDurationSec, phaseDurations, protocolVersion, inhaleSec=4, exhaleSec=6, pauses, completion, measurementSource=(none|manual|sensor|simulated), consentState, stress/calm before-after, comfort, symptoms, optional deviceMetadata, optional metrics with window, quality and provenance. Datos sensibles privados por defecto; no envíos a analítica externa ni Supabase sin revisión separada. No grabación de voz ni cámara para este módulo.

## Pruebas y gates
Unitarias:
- 600 s planificados; cambios de fase exactamente a 120 y 480 segundos.
- 36 ciclos en guía (sin contar reposo/recuperación).
- Tiempo monotónico: tolerancia <250 ms en primer plano controlado, manejar suspensión de pantalla.
- Pausa/reanudación no duplican fases ni audio.
- Datos simulados distinguibles en toda pantalla/exportación.
- Sin sensor: ningún indicador cardíaco/HRV ficticio.
- RMSSD/SDNN contra vectores NN conocidos; casos constantes, artefactos, lagunas, irregularidad, marcas duplicadas y desconexión.
- Almacenamiento local, exportación, eliminación, sin escrituras remotas.

Validación de UX: piloto de 10–15 adultos SOLO para usabilidad, no eficacia médica. Objetivos internos: >=90% comprende qué se midió y >=90% completa navegación sin ayuda. Registrar toda incidencia adversa comunicada. Test de accesibilidad y móviles, especialmente Safari iOS.

Comandos requeridos según scripts reales: typecheck, lint, tests, build. Registrar resultados y evidencia de no regresiones en generación de tonos, voz y cimática.

## Orden de trabajo y entregables
P0 / PR-1: experiencia funcional sin sensor y temporización rigurosa.
P0 / PR-2: autoevaluación y reporte, guardado local, exportación, eliminación.
P1 / PR-3: adaptadores/HRV solo tras evaluar hardware y compatibilidad.
P1 / PR-4: validación integral, piloto y documentación.
Entregar documentación de decisiones, pruebas, capturas, límites científicos, riesgos y preview independiente. Evitar sobreingeniería.

## Protección estricta de producción
- Esta rama es la única autorizada para implementación. PROHIBIDO push a main, merge, release o promoción a Production.
- PR siempre en borrador. No activar auto-merge.
- No cambiar env vars ni secretos de producción, ni migrar bases productivas.
- Preview solo si entorno aislado. No escribir en servicios persistentes compartidos con producción.
- Si se necesita configuración, permiso o credencial productiva, PARAR y consultar.
- No desplegar producción hasta autorización explícita posterior del usuario.
- Antes de cada PR reportar rama base, diff, verificación de tests y de producción intacta.

## Fuente primaria conceptual
Itzhak Bentov, *Stalking the Wild Pendulum* (1977). El PDF revisado por el equipo fue un suplemento gráfico del audiolibro (46 páginas), no la obra íntegra. Usar hipótesis sobre oscilaciones y resonancia como inspiración, no como hechos probados.

## Primera instrucción para Codex
1. Audita árbol del repositorio, dependencias, tests y despliegue actual sin modificar producción.
2. Implementa únicamente PR-1 + interfaces mínimas para expansiones posteriores en esta rama.
3. Corre tests/build, genera evidencia de desktop/mobile y abre/actualiza un PR EN BORRADOR.
4. Detente antes de merge/despliegue. Solicita aprobación para PR-2 o acceso a sensores.

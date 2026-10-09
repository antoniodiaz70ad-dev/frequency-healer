# Resonance Lab — registro del cambio de nombre

**Fecha:** 2026-10-09  
**Alcance:** texto visible y metadatos; sin cambios en datos, contratos, rutas, audio o despliegue.

## Motivo

El nombre **Resonance Lab** describe con precisión una plataforma de simulación, escucha, práctica y observación acústica. Evita sugerir resultados terapéuticos y mantiene la separación entre acústica, experiencia subjetiva y registro personal.

## Archivos modificados

- `frontend/src/app/layout.tsx`: título y descripción global.
- `frontend/src/components/Sidebar.tsx`: marca visible.
- `frontend/src/app/page.tsx`: portada de la aplicación y texto de entrada.
- `frontend/src/app/landing/page.tsx`: metadatos, marca, accesibilidad y textos visibles.
- `frontend/src/app/sesion-nueva/page.tsx`: título de calendario.
- `frontend/src/app/generador/page.tsx`: nota del generador.
- `frontend/src/components/data/UnifiedDataExport.tsx`: descripción visible de exportación.
- `frontend/src/lib/icsAlarm.ts`: identificador de producto del calendario.
- `frontend/src/lib/types.ts`: encabezado descriptivo, sin renombrar tipos internos.
- `backend/main.py`: descripción, título y respuesta de salud del servicio.
- `.github/workflows/regression.yml`: nombre visible del workflow.
- `frontend/ui/harmonic-flows.test.mjs`: expectativa del texto visible.
- `frontend/README.md`: nombre del producto.
- `docs/FREQUENCY_HEALER_V1_COPY_FREEZE.md`: nota histórica.
- `docs/V1_CLAIMS_SAFETY_AUDIT.md`: nota histórica.

## Compatibilidad preservada

Las claves `fh:*`, prefijos `--fh-*`, componentes `FH*`, rutas, nombres internos, esquemas y formatos existentes conservan su identidad. Los documentos históricos restantes mantienen el nombre anterior como registro de la etapa en que fueron creados.

## Revisión de lenguaje de claims

Se revisaron coincidencias de `sana`, `cura`, `heal`, `terap`, `tratamiento`, `equilibr` y `aline` en `frontend/src`.

- **Cambiado:** el comentario “Sistema de frecuencias para sanación” pasó a “Sistema de frecuencias para exploración acústica”.
- **Sin cambio:** negaciones y avisos de seguridad que rechazan eficacia terapéutica; identificadores, nombres y etiquetas históricas requeridos para compatibilidad; textos comunes no médicos como “trata cualquier sensación” y “equilibrio” dentro de etiquetas heredadas.

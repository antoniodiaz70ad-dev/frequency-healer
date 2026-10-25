# Puente implementado — 25 octubre 2026

## Alcance

Frequency Healer permite compartir una sesión local guardada mediante selección explícita de observación, interpretación, acción y escalas (todas desmarcadas inicialmente). Base60 abre la práctica desde Mi Tiempo o el diario existente, muestra cuenta y perfil, recibe una vista previa y exige otra confirmación antes de guardar. No se comparten tokens ni perfiles natales. El resumen original es inmutable; el seguimiento tiene revisión, estado, observación y siguiente acción. Hay exportación y eliminación de la copia en Base60, conservando el original local.

Ventanas y orígenes HTTPS exactos, canal aleatorio y vencimiento de una hora. El servidor verifica identidad con auth.getUser, propiedad de perfil/flujo, Origin y cabecera CSRF; no hay CORS público. Importación y consumo del flujo son transaccionales, con índice único por usuario/origen/sesión. Reintentar el mismo contenido devuelve el mismo registro; cambiarlo produce 409. El flujo puede recuperar un ACK vencido únicamente si ya guardó ese mismo registro.

No cambian el programa de 14 días, duración, pauta 5+5 ni modo natural. El péndulo se desmonta al comenzar la práctica y las respuestas anteriores se limpian. No se añade audio ni se atribuyen efectos terapéuticos al movimiento.

## Configuración de un entorno aislado

Base60 parte de f32d32f (PR34), preservando la experiencia personal y el contexto del calendario. Frequency Healer parte de main 43261ef. Mantener ambos PR en borrador.

1. Crear staging independiente, sin registros reales; reproducir las migraciones previas y la tabla lunar_birth_profiles con id/user_id UUID y sus permisos. La migración nueva referencia esa tabla existente. No ejecutar sobre el proyecto compartido de producción.
2. Aplicar `supabase/migrations/20261025130743_frequency_bridge.sql` en Base60. Crea tres tablas, validación de resumen y tres RPC SECURITY INVOKER. RLS verifica usuario y perfil; los resúmenes no admiten UPDATE. No modifica permisos de otras tablas.
3. Configurar exclusivamente el Preview de esa rama: Base60 `FREQUENCY_BRIDGE_ENABLED=true`, `BASE60_BRIDGE_ORIGIN=https://origen-base60-exacto`, `FREQUENCY_HEALER_ORIGIN=https://origen-fh-exacto`. Sus variables Supabase deben apuntar a staging.
4. Frequency Healer: `BASE60_BRIDGE_ENABLED=true`, `BASE60_BRIDGE_ORIGINS=https://origen-base60-exacto`. Se acepta una lista separada por comas, sin comodines. Reconstruir ambos previews después de configurar. FH necesita el repositorio completo: Next/Turbopack usa su raíz para importar el contrato compartido.
5. Verificar login real con dos cuentas, aislamiento cruzado, ventanas/popups y cabeceras COOP en ambos despliegues. No quitar protección para conservar opener. Si la conexión se pierde, abrir otro flujo y compartir la sesión local ya guardada.

Flags ausentes/apagados ocultan la interfaz y la API Base60 devuelve 404 antes de acceder a Supabase. Desactivarlos permite revertir la activación sin borrar registros. Los registros son privados y no se almacenan en caché HTTP.

## Pruebas reproducibles

Base60: `npm ci`, `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`. La suite `npm run test:bridge` ejecuta 69 comprobaciones: contrato, API real con PostgreSQL aislado (PGlite), RLS entre usuarios sintéticos, consentimiento, 0/null, idempotencia, conflictos, caducidad, límites, seguimiento y eliminación. PGlite serializa las conexiones del harness: no prueba contención multiconexión en Supabase alojado.

Navegador: instalar dependencias de ambos repositorios hermanos y `npx playwright-core install --with-deps chromium` en Base60; ejecutar `FH_REPO=/ruta/frequency-healer node scripts/qa/bridge-browser.cjs`. Opcionalmente `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` selecciona un binario local. Usa componentes reales, dos orígenes HTTPS, reloj virtual para diez minutos y PostgreSQL aislado. La identidad es sintética, no prueba Supabase Auth ni la apariencia completa del sitio. El workflow frequency-bridge automatiza esta prueba sin secretos ni escrituras remotas.

Frequency Healer: `npm ci`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` desde frontend. El build termina correctamente, pero Next 16.4.0 conserva un aviso de vulnerabilidad preexistente; no se actualizan dependencias de producción en este PR.

## Límites y pendientes

- No se han aplicado migraciones ni activado flags en producción. El circuito alojado con dos cuentas reales sigue pendiente de staging independiente.
- La paginación usa UUID como cursor estable, no orden cronológico; cada tarjeta muestra la fecha de práctica.
- La exportación incluye las prácticas del perfil seleccionado, no todo el diario personal.
- RLS y restricciones protegen los datos de otros usuarios; la confirmación es un control de la aplicación, no una prueba criptográfica de consentimiento frente al propio titular escribiendo sus datos directamente.
- No resuelve permisos históricos de otras tablas ni demuestra seguridad de toda la plataforma.

# ATENEA — actualización de seguridad de dependencias

Fecha: 27 de octubre de 2026 (America/Mexico_City).
Base: PR #33, commit `88319a7b1cf22966ec3f4c02da64e8f3432ab512`.
Rama aislada: `codex/atenea-next-security-20261027`.

## Resultado y alcance

Se prepara una actualización de dependencias para retirar los avisos conocidos del árbol npm del frontend. **No concede GO para voz real ni producción.** No se fusiona el PR #33 ni esta rama, no se configura ningún secreto y no se habilitan proveedores.

| Componente | Antes | Después | Motivo |
| --- | --- | --- | --- |
| Next.js y paquetes internos `@next/*` | 16.4.0 | 16.4.3 | Versión estable de la misma línea seleccionada por la política `security`; elimina los avisos de Next reportados por npm. |
| `eslint-config-next` / plugin Next | 16.4.0 | 16.4.3 | Mantener alineada la configuración del framework. |
| Zod, transitiva de desarrollo de `eslint-plugin-react-hooks` | 4.6.5 | 4.6.7 | Corregir el aviso adicional encontrado al auditar también desarrollo; compatible con el rango existente `^3.25.0 || ^4.0.0`, sin añadir dependencia directa ni override. |

El lockfile mantiene `sharp` 0.35.5; el nuevo requisito de Next es `^0.35.5`. React, WebSocket, Redis, JOSE, Playwright y sus versiones directas se conservan. No se ejecuta un codemod ni una migración de versión mayor.

`experimental.agentUpgrade: "security"` explicita la política de avisos de seguridad soportada por Next. Esta opción no actualiza automáticamente el proyecto. Se preserva el resto de `next.config.ts`.

Los dos archivos `vercel.json` añaden `deploymentEnabled: false` para la rama nueva antes de crear su referencia remota. La exclusión del laboratorio ATENEA existente se conserva. No se modifica la política de otras ramas ni se invoca un despliegue.

## Evidencia de auditoría

- Antes, `npm audit --omit=dev --json` reportó un paquete de producción con severidad crítica: Next 16.4.0, tres avisos asociados.
- Después de actualizar Next, la auditoría completa identificó un aviso alto adicional en Zod 4.6.5, una dependencia **de desarrollo** ya presente en el lockfile original. No se atribuye esa alerta a una exposición demostrada del servicio de producción.
- Después de actualizar Zod, `npm audit --json` devuelve **0 avisos de cualquier severidad**, incluyendo dependencias de desarrollo.
- Esta comprobación se limita a los avisos publicados y a las dependencias resueltas en la fecha de la revisión; no es una auditoría de seguridad integral del servicio ni prueba de ausencia de vulnerabilidades desconocidas.

Fuentes primarias y de registro consultadas:

- [Versión 16.4.3 de Next.js](https://github.com/vercel/next.js/releases/tag/v16.4.3).
- [Aviso de optimización de imágenes](https://github.com/advisories/GHSA-2464-fhr4-w9xw).
- [Aviso de Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r).
- [Aviso de `use cache`](https://github.com/advisories/GHSA-673q-mjm6-r5xr).
- [Aviso de Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- Metadatos npm y documentación de actualización/configuración incluida con la versión instalada de Next.js.

## Validación

Entorno local: Ubuntu 24.04, Node 22.14.0. Los servidores de pruebas escuchan solo en loopback. Los flags ON se usan únicamente dentro de procesos sintéticos del laboratorio; Live y sus indicadores de revisión/readiness permanecen en `false`.

- `npm ci`: instalación reproducible desde el lockfile actualizado.
- `next --version`: 16.4.3.
- Dominio: 306 pruebas, 305 aprobadas, 0 fallos, 1 omisión explícita de Redis real porque no está configurado en local. CI debe ejecutar ese caso con su servicio Redis real.
- TypeScript y ESLint: aprobados.
- Build con flags de laboratorio ON: aprobado, con Next 16.4.3.
- Suite UI completa: **124/124 aprobadas, 0 fallos, 0 omisiones**, con dispositivo de audio sintético; incluye ATENEA y las regresiones Bentov/Cimática.
- Build con flags OFF: aprobado. Smoke HTTP ON y OFF: aprobados.
- Gates OFF: ruta y endpoint de ATENEA cerrados; 1 prueba HTTP aprobada, 0 fallos, 2 escenarios visuales omitidos porque no corresponden con el flag apagado.
- Evidencia local en `docs/evidence/atenea-security/`. El resultado de CI del SHA publicado se enlaza en el PR; se debe verificar por sus logs, incluido Redis real y Chromium fijado.

El intento local de descargar el Chromium fijado por Playwright 1.63.0 devolvió un archivo truncado. Las comprobaciones de navegador locales utilizan Chromium headless 153.0.8010.0 de `@sparticuz/chromium` 153.0.0, instalado fuera del proyecto. **No se afirma equivalencia exacta con Chrome for Testing 153.0.8010.12 de CI**. La validación del SHA publicado debe comprobar los logs completos de CI, además de su estado.

## Revisión y siguiente paso

Este cambio se entrega como draft dirigido a la rama del PR #33 para que el diff contenga solo la actualización de seguridad. Se comprueban duplicados antes de abrirlo. La actualización no se integra automáticamente ni se publica en producción.

Antes de una prueba real siguen pendientes los controles del [backend Live](ATENEA_LIVE_BACKEND.md): login y renovación de tokens, Redis/scheduler operativos, conciliación y cierre de sesiones ambiguas, presupuesto global y alertas, aviso de privacidad y consentimiento remoto, y validación en dispositivos físicos. Un resultado verde de dependencias o de CI no satisface esos requisitos operativos.

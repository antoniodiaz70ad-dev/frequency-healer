# Actualización de seguridad de Next.js 16.4.3

Rama: `codex/next-security-16-4-3`. PR separado, apilado sobre `codex/atenea-voz-mvp` (PR #33, base revisada `88319a7`). No se fusiona ni despliega ninguna rama. Los resultados definitivos de CI se enlazan en el PR de actualización.

## Cambio

- `next`: 16.4.0 → **16.4.3**.
- `eslint-config-next`: 16.4.0 → **16.4.3**, permanece en devDependencies.
- `sharp` resuelto: **0.35.5**.
- Lockfile regenerado con npm; versiones exactas, sin cambio mayor ni canary.
- Excepción de auto-deploy para esta rama en ambos `vercel.json`. No cambia la política de otras ramas ni se activa ningún flag de ATENEA.

Las correcciones de Cimática y del pipeline del PR #33 se mantienen como base de validación; este PR solo añade la actualización de dependencias, su evidencia y la excepción de despliegue. La preparación de staging será otro cambio dependiente para revisar login, Redis, scheduler y consentimiento sin mezclarlo con el parche.

## Fuentes y alcance

Se consultaron la [release estable v16.4.3](https://github.com/vercel/next.js/releases/tag/v16.4.3) y los avisos de seguridad [GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) y [GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw). La auditoría del PR #33 identificaba Next 16.4.0 como bloqueo de seguridad. La documentación instalada de Next se volvió a revisar después de actualizar.

`npm audit --omit=dev --json` del lockfile actualizado reporta **0 vulnerabilidades** (0 críticas/altas/moderadas/bajas). Esto acredita el resultado de la base de avisos de npm en esta revisión; no certifica que la aplicación carezca de vulnerabilidades ni sustituye las pruebas operativas de voz.

## Validación

Comandos desde `frontend`:

```sh
npm ci
npm audit --omit=dev --json
npm test
npm run typecheck
npm run lint
NEXT_PUBLIC_VOICE_JOURNEY_ENABLED=true NEXT_PUBLIC_HARMONIC_LAB_ENABLED=true npm run build
ATENEA_VOICE_ENABLED=true FH_UI_BROWSER=chromium npm run test:ui
ATENEA_VOICE_ENABLED=false node --test ui/atenea-flow.test.mjs
```

La suite CI incluye Redis 7 real, las dos variantes de la guía cimática, limpieza de animaciones y audio, invalidación de curva modal, navegación y laboratorio ATENEA. Se usa shell explícito con `pipefail`; un fallo no queda oculto por `tee`. No se omiten pruebas ni se amplían timeouts para aceptar el upgrade.

Las comprobaciones locales de dominio, TypeScript y ESLint pasaron. La evidencia definitiva de build, Redis y navegador debe leerse en la ejecución del SHA publicado, no inferirse del estado del PR anterior.

## Antes de staging real

Esta actualización resuelve el pendiente de versión del framework cuando la suite completa del PR pase. **No concede GO a voz real**: siguen pendientes el login y renovación de identidad, Redis y scheduler de staging con prueba de fallos, conciliación de creación ambigua, presupuesto global y retención efectiva, integración de consentimiento remoto y pruebas con API/dispositivos físicos. No se crean claves, identidades, bases de datos ni schedules externos en este PR.

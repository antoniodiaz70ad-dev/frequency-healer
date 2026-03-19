# FREQUENCY HEALER — Plan de Mejoras v2.0

> Documento de planificación para la evolución del proyecto.
> Branch: `feature/v2-improvements`
> Fecha: 2026-03-18

---

## Visión General

Transformar Frequency Healer de un prototipo funcional a una aplicación de producción desplegable en Vercel, con audio de calidad profesional, código robusto y experiencia de usuario pulida.

**Principio rector:** El frontend debe ser 100% autosuficiente (sin dependencia del backend Python) para despliegue estático en Vercel. El backend queda como servicio opcional para generación de archivos WAV.

---

## FASE 1: Audio Engine — Calidad Profesional

El motor de audio es el corazón de la app. Actualmente tiene deficiencias que afectan directamente la experiencia terapéutica del usuario.

### 1.1 Fade-in / Fade-out (Anti-pop)

**Problema:** Al iniciar o detener un tono, se producen "clicks" o "pops" audibles porque la señal pasa de 0 a amplitud máxima instantáneamente. Esto es molesto y potencialmente dañino en una app de sanación.

**Solución:** Implementar rampas de ganancia de 50-100ms al iniciar y detener cualquier tono.

```
Antes:  gain = 0 → 0.5 (instantáneo) = POP
Después: gain = 0 → ramp 80ms → 0.5 (suave) = silencio limpio
```

**Implementación:**
- `play()`: Usar `gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.08)` en vez de `setValueAtTime`
- `stop()`: Rampa descendente `gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05)` antes de desconectar, con `setTimeout` para desconectar nodos después del fade
- Aplicar a AMBOS canales en modo binaural

**Archivos:** `frontend/src/lib/audioEngine.ts` — métodos `play()` (líneas 38-101) y `stop()` (líneas 104-129)

---

### 1.2 Rampas de Volumen Suaves

**Problema:** `setVolume()` usa `setValueAtTime` (cambio instantáneo), produciendo clicks audibles al mover el slider de volumen.

**Solución:** Reemplazar con `linearRampToValueAtTime` con rampa de 50ms.

**Implementación:**
- `setVolume()`: `gainNode.gain.linearRampToValueAtTime(newVolume, ctx.currentTime + 0.05)`
- Aplicar a `gainNode` y `gainNodeR` simultáneamente
- Cancelar rampas previas con `cancelScheduledValues` antes de programar nueva rampa

**Archivo:** `audioEngine.ts` — método `setVolume()` (líneas 139-146)

---

### 1.3 Rampas de Frecuencia Suaves

**Problema:** `setFrequency()` cambia la frecuencia instantáneamente y solo afecta al oscilador izquierdo. En modo binaural, el canal derecho queda desincronizado.

**Solución:**
- Usar `exponentialRampToValueAtTime` para transiciones de frecuencia suaves (glide)
- Actualizar AMBOS osciladores en modo binaural manteniendo el `differenceHz`

**Implementación:**
- Almacenar `currentBinauralDiff` como propiedad de la clase
- En `setFrequency(freq)`: actualizar oscilador L a `freq` y oscilador R a `freq + binauralDiff`
- Usar rampa exponencial de 100ms (las rampas exponenciales suenan más naturales para frecuencia)

**Archivo:** `audioEngine.ts` — método `setFrequency()` (líneas 132-136)

---

### 1.4 DynamicsCompressor (Limitador/Protector)

**Problema:** No hay protección contra clipping. Ondas cuadradas a volumen alto, o combinaciones de binaural con frecuencias altas, pueden producir distorsión o niveles peligrosos para los oídos.

**Solución:** Insertar un `DynamicsCompressorNode` en la cadena de audio antes del destino final.

**Cadena de audio resultante:**
```
Oscilador → Gain → [Panner] → Analyser → Compressor → destination
```

**Configuración del compresor:**
- `threshold`: -6 dB (empieza a comprimir cerca del máximo)
- `knee`: 12 dB (transición suave)
- `ratio`: 4:1 (compresión moderada, no destruye dinámica)
- `attack`: 0.003s (reacción rápida a picos)
- `release`: 0.1s (recuperación natural)

**Por qué:** En una app terapéutica, proteger los oídos del usuario es crítico. El compresor actúa como red de seguridad sin afectar la calidad percibida a volúmenes normales.

**Archivo:** `audioEngine.ts` — nuevo nodo en `play()`, propiedad `compressor` en la clase

---

### 1.5 Fix: Canal Derecho Binaural sin Visualización

**Problema:** Línea 80 de `audioEngine.ts` — el canal derecho (`pannerR`) se conecta directamente a `ctx.destination`, saltándose el `analyser`. Resultado: el visualizador solo muestra el canal izquierdo.

**Solución:** Conectar ambos canales al analyser:
```
pannerL → analyser ─┐
pannerR → analyser ─┴→ compressor → destination
```

**Archivo:** `audioEngine.ts` — línea 80, cambiar `this.pannerR.connect(ctx.destination)` por `this.pannerR.connect(this.analyser)`

---

### 1.6 Crossfade entre Pasos de Protocolo

**Problema:** En `playProtocol()`, cada paso hace `stop()` + `play()` = silencio abrupto entre frecuencias. Esto rompe la inmersión terapéutica y produce pops.

**Solución:** Implementar crossfade de 200ms entre pasos:
1. Crear nuevos osciladores para el siguiente paso
2. Fade-out del paso actual (200ms)
3. Fade-in del paso nuevo (200ms, superpuestos)
4. Desconectar nodos del paso anterior después del fade

**Implementación:** Nuevo método `crossfadeTo()` que maneja la transición sin interrumpir el audio. El método `playProtocol()` usa `crossfadeTo()` en vez de `stop()`+`play()`.

**Archivo:** `audioEngine.ts` — nuevo método `crossfadeTo()`, modificar `playProtocol()` (líneas 174-208)

---

### 1.7 Modo Coils Mejorado

**Problema:** El modo "coils" (bobinas electromagnéticas) solo reduce el volumen a 0.8, pero:
- No aplica en modo binaural (línea 73 ignora outputMode)
- No optimiza la forma de onda para bobinas (las bobinas responden mejor a ondas cuadradas)
- Sin advertencia al usuario sobre el modo

**Solución:**
- Aplicar límite de volumen en binaural también
- Agregar propiedad `coilsMaxVolume` configurable
- Recomendar waveform cuadrada cuando se activa modo coils (UI hint, no forzar)

**Archivo:** `audioEngine.ts` — método `play()`, ambas ramas (mono y binaural)

---

## FASE 2: Preparación para Vercel (Deployment)

### 2.1 Frontend 100% Autosuficiente

**Problema:** El frontend depende del backend Python para la API de frecuencias y generación WAV. El backend usa NumPy/SciPy que no son compatibles con Vercel serverless.

**Solución:** El frontend ya tiene los datos embebidos en `frequencies.ts` y `protocols.ts`. Solo necesitamos:

1. **Eliminar dependencia de API para datos**: Ya está resuelto — los datos viven en el frontend
2. **Generación WAV en el navegador**: Implementar `generateWAV()` usando Web Audio API + `OfflineAudioContext` para renderizar audio a buffer y exportar como WAV
3. **API routes opcionales**: Si se necesitan en el futuro, usar Next.js API Routes (no Python)

**Nuevo archivo:** `frontend/src/lib/wavExporter.ts`
- `renderToWAV(frequency, duration, waveform, sampleRate)` → Blob
- `renderBinauralToWAV(baseFreq, beatFreq, duration, sampleRate)` → Blob
- `renderProtocolToWAV(steps, sampleRate)` → Blob
- Usa `OfflineAudioContext` para renderizar sin reproducir
- Convierte `AudioBuffer` a formato WAV (PCM 16-bit)

**Por qué OfflineAudioContext:** Permite usar exactamente el mismo pipeline de audio (osciladores, ganancia, fade) pero renderizando a un buffer en vez de a los altavoces. Garantiza que el WAV descargado suene idéntico a la reproducción en vivo.

---

### 2.2 next.config.ts para Producción

**Problema:** Configuración vacía. Sin headers de seguridad, sin optimización de imágenes, sin compresión.

**Solución:**

```typescript
const nextConfig: NextConfig = {
  // Headers de seguridad
  headers: async () => [{
    source: '/:path*',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ],
  }],
  // Sin backend externo, no necesitamos rewrites
  // Imágenes optimizadas para Vercel
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};
```

**Archivo:** `frontend/next.config.ts`

---

### 2.3 Variables de Entorno

**Problema:** No existe `.env.example` ni configuración de entorno. CORS hardcoded en backend.

**Solución:**
- Crear `frontend/.env.example` con variables documentadas
- Crear `frontend/.env.local` (gitignored) con valores de desarrollo
- Variables necesarias:
  ```
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  NEXT_PUBLIC_APP_NAME=Frequency Healer
  NEXT_PUBLIC_ANALYTICS_ID= (opcional)
  ```

**Archivos:** Nuevo `frontend/.env.example`, actualizar `.gitignore`

---

### 2.4 PWA Manifest

**Problema:** No hay soporte PWA. Una app de frecuencias se beneficia enormemente de funcionar offline y como app instalada.

**Solución:**
- Crear `frontend/public/manifest.json` con metadata de la app
- Agregar meta tags en `layout.tsx` para PWA
- Configurar `theme-color`, `display: standalone`, iconos

**Por qué:** Los usuarios de frecuencias terapéuticas quieren usar la app sin conexión, especialmente durante sesiones de meditación. PWA permite esto sin necesidad de app nativa.

---

## FASE 3: Robustez del Código

### 3.1 Error Handling Global

**Problema:** Ninguna llamada a `engine.play()` tiene try-catch. Si Web Audio API falla (contexto bloqueado, dispositivo no disponible), la app se rompe sin feedback.

**Solución:**

1. **Error boundary de React** — Nuevo componente `AudioErrorBoundary` que captura errores de renderizado
2. **Try-catch en todos los handlers de audio** con mensajes de error amigables:
   - "Tu navegador bloqueó el audio. Haz click en cualquier parte de la página primero."
   - "No se pudo iniciar el audio. Verifica que tu dispositivo tenga salida de sonido."
3. **Estado de error en audioEngine** — nuevo método `getLastError()` y evento `onError`

**Archivos afectados:**
- `generador/page.tsx` — `handlePlay()` (líneas 34-51)
- `biblioteca/page.tsx` — `handlePlayFrequency()` (líneas 36-46)
- `protocolos/page.tsx` — `startStepAudio()` (líneas 44-47)
- Nuevo: `frontend/src/components/AudioErrorBoundary.tsx`

---

### 3.2 Memory Leaks — Limpieza de Efectos

**Problema:** Múltiples `setTimeout` y `setInterval` no se limpian al desmontar componentes.

**Solución por componente:**

**generador/page.tsx:**
- `dwellTimer` (línea 44-50): Guardar ID en ref, limpiar en `useEffect` cleanup
- Agregar `useEffect(() => () => { clearTimeout(dwellTimerRef.current); engine.stop(); }, [])` al componente

**protocolos/page.tsx:**
- `timerRef` (línea 69-83): Ya usa ref, pero falta limpiar al desmontar
- Agregar cleanup que llame `clearInterval(timerRef.current)` y `engine.stopProtocol()`

**AudioVisualizer.tsx:**
- `rafRef` (línea 68): Verificar que `cancelAnimationFrame` se llama siempre en cleanup
- Agregar flag `isMounted` para evitar actualizaciones post-desmontaje

---

### 3.3 Validación de Inputs

**Problema:** No hay validación frontend de rangos de frecuencia, volumen, o configuraciones de binaural.

**Solución:**
- Frecuencia: clampar a 0.1–22000 Hz (rango audible + sub-bass)
- Volumen: clampar a 0–1.0 (normalizar desde 0–100 del slider)
- Binaural diff: clampar a 0.5–40 Hz (rango útil para ondas cerebrales)
- Dwell time: clampar a 0–3600s
- Validar antes de llamar a `engine.play()`

**Archivos:** `generador/page.tsx`, `biblioteca/page.tsx`, `audioEngine.ts` (validación defensiva interna)

---

## FASE 4: UI/UX y Accesibilidad

### 4.1 Accesibilidad (a11y)

**Problema:** Múltiples elementos interactivos carecen de etiquetas accesibles.

**Correcciones específicas:**

| Componente | Elemento | Fix |
|---|---|---|
| `generador/page.tsx` | Botones −/+ frecuencia | `aria-label="Disminuir frecuencia"` / `"Aumentar frecuencia"` |
| `generador/page.tsx` | Toggle binaural | `aria-label="Activar beats binaurales"` + `role="switch"` + `aria-checked` |
| `generador/page.tsx` | Toggle 432 Hz | `aria-label="Activar afinación 432 Hz"` + `role="switch"` + `aria-checked` |
| `generador/page.tsx` | Slider volumen | `aria-label="Volumen"` + `aria-valuemin/max/now` |
| `biblioteca/page.tsx` | Filas expandibles | `role="button"` + `aria-expanded` + `tabIndex={0}` + `onKeyDown` |
| `biblioteca/page.tsx` | Icono búsqueda | `aria-hidden="true"` (decorativo) |
| `protocolos/page.tsx` | Botón stop (■) | `aria-label="Detener protocolo"` |
| `Sidebar.tsx` | Menú móvil | `aria-expanded` + `aria-controls` + `role="navigation"` |
| `Sidebar.tsx` | Puntos de dominio | `aria-hidden="true"` (decorativos, info redundante) |
| `AudioVisualizer.tsx` | Canvas | `aria-label="Visualización de forma de onda"` + `role="img"` |

---

### 4.2 Canvas Responsive

**Problema:** `AudioVisualizer.tsx` tiene dimensiones hardcoded de 600x150 px. El CSS hace responsive con `w-full`, pero el canvas interno no coincide → escalado borroso.

**Solución:**
- Usar `ResizeObserver` para detectar el tamaño real del contenedor
- Actualizar `canvas.width` y `canvas.height` dinámicamente
- Multiplicar por `devicePixelRatio` para pantallas retina
- Re-renderizar cuando cambie el tamaño

**Archivo:** `AudioVisualizer.tsx` — reescribir useEffect de dimensiones

---

### 4.3 SEO y Metadata

**Problema:** Sin Open Graph, sin manifest, charset/viewport implícitos, fonts sin `latin-ext`.

**Solución en `layout.tsx`:**

```typescript
export const metadata: Metadata = {
  title: 'Frequency Healer — Sanación con Frecuencias',
  description: 'Genera tonos terapéuticos, beats binaurales y protocolos de frecuencias para bienestar físico, emocional y espiritual.',
  keywords: ['frecuencias', 'sanación', 'solfeggio', 'binaural', 'rife', 'meditación'],
  openGraph: {
    title: 'Frequency Healer',
    description: 'Sanación con frecuencias terapéuticas',
    type: 'website',
    locale: 'es_ES',
  },
  manifest: '/manifest.json',
  themeColor: '#030712',
};
```

**Fonts:** Agregar `subsets: ["latin", "latin-ext"]` para caracteres acentuados en español.

**Archivo:** `frontend/src/app/layout.tsx` (líneas 16-19)

---

## FASE 5: TypeScript y Calidad de Código

### 5.1 Tipos Faltantes

**Problema:** Varios objetos sin tipado explícito.

| Ubicación | Objeto | Fix |
|---|---|---|
| `biblioteca/page.tsx` L8-12 | `EVIDENCE_INFO` | Crear tipo `EvidenceInfo` en `types.ts` |
| `generador/page.tsx` L9-18 | `PRESETS` | Crear tipo `FrequencyPreset` en `types.ts` |
| `page.tsx` L7-44 | `QUICK_FREQUENCIES`, `DOMAIN_CARDS` | Tipar con interfaces explícitas |

---

### 5.2 Consistencia de Volumen

**Problema:** El slider de volumen usa 0–100 (porcentaje), pero `audioEngine.play()` espera 0–1. La conversión se hace en el handler pero no es explícita ni está documentada.

**Solución:**
- Definir tipo `VolumePercent = number` (0-100) y `VolumeGain = number` (0-1)
- Función de conversión `percentToGain(v: VolumePercent): VolumeGain`
- Usar `VolumePercent` en componentes UI y `VolumeGain` en audioEngine

**Archivos:** `types.ts`, `generador/page.tsx`, `audioEngine.ts`

---

### 5.3 Constantes Centralizadas

**Problema:** Valores mágicos dispersos por todo el código.

**Solución:** Nuevo archivo `frontend/src/lib/constants.ts`:

```typescript
export const AUDIO = {
  FADE_IN_MS: 80,
  FADE_OUT_MS: 50,
  CROSSFADE_MS: 200,
  MIN_FREQUENCY_HZ: 0.1,
  MAX_FREQUENCY_HZ: 22000,
  DEFAULT_FREQUENCY_HZ: 528,
  DEFAULT_VOLUME: 0.5,
  COILS_MAX_VOLUME: 0.8,
  SAMPLE_RATE: 44100,
  FFT_SIZE: 2048,
  BINAURAL_MIN_DIFF: 0.5,
  BINAURAL_MAX_DIFF: 40,
} as const;

export const UI = {
  TIMER_INTERVAL_MS: 250,
  CANVAS_BG_COLOR: '#0d1117',
  SIDEBAR_WIDTH_PX: 256,
  FREQUENCY_MATCH_THRESHOLD_HZ: 0.5,
} as const;

export const COMPRESSOR = {
  THRESHOLD: -6,
  KNEE: 12,
  RATIO: 4,
  ATTACK: 0.003,
  RELEASE: 0.1,
} as const;
```

---

### 5.4 Memoización de Cálculos

**Problema:** Cálculos repetidos en cada render sin `useMemo`.

| Archivo | Cálculo | Solución |
|---|---|---|
| `page.tsx` L47-52 | Stats (total frequencies, protocols) | Envolver en `useMemo([], [])` — datos estáticos |
| `generador/page.tsx` L32 | `effectiveFreq` | `useMemo` con dependencias `[frequency, tuning432]` |
| `generador/page.tsx` L70-77 | `matchingFrequency` | `useMemo` con dependencia `[effectiveFreq]` |

---

## FASE 6: Exportación WAV en Frontend

### 6.1 WAV Exporter (Reemplazo del Backend)

**Problema:** La generación WAV depende del backend Python. Para Vercel, necesitamos generar WAV en el navegador.

**Solución:** Nuevo módulo `wavExporter.ts` usando `OfflineAudioContext`.

**Funcionalidades:**
1. `exportToneAsWAV(config)` → descarga archivo WAV de tono simple
2. `exportBinauralAsWAV(config)` → descarga WAV estéreo con beats binaurales
3. `exportProtocolAsWAV(protocol)` → descarga WAV completo de protocolo con crossfades

**Flujo:**
```
OfflineAudioContext (mismo pipeline que audioEngine)
  → renderiza a AudioBuffer
  → convierte a PCM Int16
  → empaqueta como WAV (header + data)
  → crea Blob → URL.createObjectURL → descarga
```

**Ventajas sobre el backend:**
- Sin latencia de red
- Funciona offline
- Mismo pipeline de audio = sonido idéntico a la reproducción
- Sin dependencia de NumPy/SciPy

**Archivo nuevo:** `frontend/src/lib/wavExporter.ts`

---

### 6.2 Botones de Descarga en UI

**Ubicaciones:**
- `generador/page.tsx`: Botón "Descargar WAV" junto al botón Play
- `protocolos/page.tsx`: Botón "Descargar Protocolo" en cada card de protocolo
- `biblioteca/page.tsx`: Botón de descarga en cada frecuencia expandida

---

## FASE 7: Mejoras de UI Adicionales

### 7.1 Sidebar — Logo Clickeable

**Problema:** El logo "Frequency Healer" no lleva al dashboard.

**Solución:** Envolver en `<Link href="/">`.

**Archivo:** `Sidebar.tsx` — líneas 40-44

---

### 7.2 Sidebar — Keyboard Navigation

**Problema:** Sin soporte de teclado para menú móvil.

**Solución:**
- `Escape` cierra el menú
- `Tab` navega entre links
- Focus trap cuando el menú está abierto

---

### 7.3 Protocolo — Tiempo Restante

**Problema:** Solo se muestra tiempo transcurrido, no tiempo restante ni hora estimada de fin.

**Solución:** Agregar display de "Tiempo restante: MM:SS" y "Finaliza a las HH:MM".

**Archivo:** `protocolos/page.tsx`

---

### 7.4 Dashboard — Cards Interactivas

**Problema:** Las cards de frecuencias rápidas en el dashboard no reproducen audio.

**Solución:** Agregar botón de reproducción rápida (como en biblioteca) directamente en las cards del dashboard.

**Archivo:** `page.tsx`

---

## FASE 8: Configuración de Entorno y Scripts

### 8.1 Scripts de package.json

**Agregar:**
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "type-check": "tsc --noEmit"
  }
}
```

---

### 8.2 .gitignore Actualizado

**Verificar que incluya:**
```
.env.local
.env*.local
.vercel
node_modules
.next
out
```

---

## Resumen de Archivos Afectados

| Archivo | Tipo de Cambio |
|---|---|
| `src/lib/audioEngine.ts` | **Reescritura mayor** — fades, compressor, crossfade, binaural fix, rampas |
| `src/lib/wavExporter.ts` | **Nuevo** — generación WAV en navegador |
| `src/lib/constants.ts` | **Nuevo** — constantes centralizadas |
| `src/lib/types.ts` | Agregar tipos faltantes (EvidenceInfo, FrequencyPreset, VolumePercent) |
| `src/app/layout.tsx` | Metadata SEO, Open Graph, fonts latin-ext |
| `src/app/page.tsx` | Memoización, cards interactivas |
| `src/app/generador/page.tsx` | Error handling, memory leaks, accesibilidad, descarga WAV, memoización |
| `src/app/protocolos/page.tsx` | Error handling, memory leaks, accesibilidad, tiempo restante |
| `src/app/biblioteca/page.tsx` | Error handling, accesibilidad, descarga WAV |
| `src/components/AudioVisualizer.tsx` | Canvas responsive, accesibilidad |
| `src/components/Sidebar.tsx` | Logo clickeable, keyboard nav, aria attrs |
| `src/components/AudioErrorBoundary.tsx` | **Nuevo** — error boundary para audio |
| `next.config.ts` | Headers seguridad, config producción |
| `package.json` | Scripts adicionales |
| `.env.example` | **Nuevo** — variables de entorno documentadas |
| `public/manifest.json` | **Nuevo** — PWA manifest |

---

## Orden de Ejecución

```
1. Crear branch feature/v2-improvements
2. FASE 1: Audio Engine (núcleo — todo lo demás depende de esto)
3. FASE 5: TypeScript y constantes (facilita el resto del trabajo)
4. FASE 3: Error handling y memory leaks
5. FASE 4: Accesibilidad y canvas responsive
6. FASE 6: WAV Exporter (reemplaza backend para Vercel)
7. FASE 2: Config Vercel, env, PWA manifest
8. FASE 7: Mejoras UI adicionales
9. FASE 8: Scripts y cleanup
10. Build de producción + verificación
```

---

## Qué NO se incluye (fuera de alcance)

- **Tests unitarios**: Requiere setup de Vitest + mocking de Web Audio API. Se hará en un PR separado.
- **Backend Python**: No se modifica. Queda como servicio opcional independiente.
- **Base de datos**: Los datos siguen embebidos en TypeScript. Migración a DB es trabajo futuro.
- **Autenticación/usuarios**: Fuera de alcance.
- **Protocolos personalizados**: Feature futura.
- **Internacionalización (i18n)**: La app está en español, agregar idiomas es trabajo futuro.
- **Analytics/tracking**: Se deja preparado con variable de entorno pero sin implementar.

# Laboratorio Cimático — modelo v1

## Alcance

`cymatics-modal-v1` calcula una **respuesta física simulada** de geometrías ideales. La animación de partículas es ilustrativa y no valida dinámica granular real. No mide ni predice efectos sobre el cuerpo.

## Modelos y unidades

- Placa rectangular delgada, homogénea e isotrópica, con bordes simplemente apoyados. Usa SI y `D = E h³ / (12(1−ν²))`, modos seno y las frecuencias de la especificación del producto.
- Membrana circular ideal con borde fijo y tensión uniforme. Usa raíces positivas `j_mn` de `J_m`, incluidas las orientaciones degeneradas para `m > 0`. Las raíces tabuladas proceden de NIST DLMF §10.21 y quedan cubiertas por pruebas de ceros nodales.
- Respuesta forzada compleja: cada modo usa masa modal, acoplamiento en el punto de excitación desplazado y amortiguamiento `ζ > 0`. La vista muestra la envolvente de amplitud estacionaria; no intenta animar cientos de ciclos por segundo.

El truncamiento predeterminado es 5. Si el tono queda fuera del intervalo modal calculado se informa y no se fabrica una figura. Una respuesta débil usa como referencia visual la amplitud de la resonancia modal más cercana, para que la normalización no la presente como una resonancia fuerte. La autoexposición sigue siendo una elección visible del usuario. La placa y membrana no representan bordes libres, placas sujetas por el centro, materiales no lineales ni transitorios de un experimento real.

## Audio

El módulo llama al singleton `AudioEngine`; no crea otro `AudioContext`. Los canales binaurales se mantienen separados y la diferencia se muestra como metadato, nunca como un oscilador físico adicional. Los barridos actualizan `AudioParam` con rampa corta y usan tiempo monotónico del navegador. El MVP visual modela la fundamental; si el audio usa una onda no sinusoidal muestra esta limitación.

## Partículas y reproducción

La semilla controla posiciones deterministas. La aproximación integra a 120 pasos por segundo, desciende el gradiente de amplitud al cuadrado, aplica amortiguamiento, límite de velocidad y repulsión de borde. La animación busca revelar la estructura en 3–5 segundos de interfaz; ese intervalo es ilustrativo, no tiempo físico. Omite impactos, fricción granular, aire y retroacción de partículas.

Las vistas separan el mapa de amplitud, la vibración de fase ralentizada, los contornos de amplitud mínima y las partículas. La vibración reconstruye el desplazamiento instantáneo desde los componentes real e imaginario de la misma respuesta modal; su velocidad visual es deliberadamente lenta y no representa el tiempo físico. En una respuesta multimodal los contornos no se afirman como nodos exactos. Las tres demostraciones seleccionan modos propios calculados y puntos de excitación con acoplamiento no nulo: placa `(2,2)`, membrana `(0,2)` y membrana `(3,1)`. La selección no inicia audio ni aumenta volumen. PNG incluye frecuencia y canal. JSON guarda parámetros efectivos y la galería usa `fh:cymatics-gallery-v1`; lecturas corruptas fallan sin sobrescribir el contenido.

## Rendimiento y accesibilidad

Canvas 2D reduce resolución y partículas según `renderQuality`, limita DPR a 2, pausa con `document.visibilityState`, libera RAF/listeners al desmontar y respeta `prefers-reduced-motion`. Ocultar el visual no detiene el audio. El audio con pantalla bloqueada sigue dependiendo del navegador y del sistema operativo.

## Referencias

- W3C Web Audio API: https://www.w3.org/TR/webaudio-1.0/
- NIST Digital Library of Mathematical Functions, Bessel zeros §10.21: https://dlmf.nist.gov/10.21
- University of Colorado Boulder, Chladni figures: https://physicslabs.colorado.edu/demos/oscillations-and-waves/instruments/resonance-in-plates-bars-solids/chladni-figures/

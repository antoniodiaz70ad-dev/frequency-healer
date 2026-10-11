'use client';
import { useEffect, useRef } from 'react';
import type { SpectrumFrame } from '@/lib/cymatics/spectral';
import styles from './cymatics.module.css';

interface Props { frame: SpectrumFrame | null; history: readonly Float32Array[]; maxFrequencyHz?: number }

export default function SpectralAnalyzer({ frame, history, maxFrequencyHz = 2000 }: Props) {
  const spectrumRef = useRef<HTMLCanvasElement>(null), spectrogramRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!frame) return;
    const canvas = spectrumRef.current, context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const width = canvas.width, height = canvas.height, maxBin = Math.max(2, Math.min(frame.magnitudesDbfs.length - 1, Math.floor(maxFrequencyHz / frame.binWidthHz)));
    context.fillStyle = '#050b16'; context.fillRect(0, 0, width, height);
    context.strokeStyle = '#67e8f9'; context.lineWidth = 2; context.beginPath();
    for (let index = 0; index <= maxBin; index++) {
      const x = index / maxBin * width, y = height - Math.max(0, Math.min(1, (frame.magnitudesDbfs[index] + 100) / 100)) * height;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
  }, [frame, maxFrequencyHz]);
  useEffect(() => {
    if (!frame || !history.length) return;
    const canvas = spectrogramRef.current, context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const image = context.createImageData(canvas.width, canvas.height), maxBin = Math.max(2, Math.min(frame.magnitudesDbfs.length - 1, Math.floor(maxFrequencyHz / frame.binWidthHz)));
    for (let x = 0; x < canvas.width; x++) {
      const source = history[Math.max(0, history.length - canvas.width + x)];
      if (!source) continue;
      for (let y = 0; y < canvas.height; y++) {
        const bin = Math.min(maxBin, Math.round((1 - y / (canvas.height - 1)) * maxBin)), value = Math.max(0, Math.min(1, (source[bin] + 100) / 100)), offset = (y * canvas.width + x) * 4;
        image.data[offset] = Math.round(10 + value * 110); image.data[offset + 1] = Math.round(18 + value * 220); image.data[offset + 2] = Math.round(35 + value * 210); image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
  }, [frame, history, maxFrequencyHz]);
  return <section className={styles.spectral} aria-label="Analizador espectral local">
    <div><h3>FFT en vivo</h3><p>Magnitud dBFS · ventana Hann · 0–{maxFrequencyHz} Hz</p><canvas ref={spectrumRef} width="640" height="180" role="img" aria-label="Espectro FFT del micrófono"/></div>
    <div><h3>Espectrograma</h3><p>Tiempo de izquierda a derecha; color = magnitud dBFS.</p><canvas ref={spectrogramRef} width="240" height="180" role="img" aria-label="Espectrograma local del micrófono"/></div>
    <p role="status">{frame?.peakFrequencyHz == null ? 'Sin pico espectral estable.' : `Pico FFT: ${frame.peakFrequencyHz.toFixed(2)} Hz · ${frame.peakDbfs?.toFixed(1)} dBFS`}</p>
  </section>;
}

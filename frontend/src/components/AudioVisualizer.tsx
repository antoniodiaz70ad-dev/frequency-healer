"use client";
import { useEffect, useRef, useCallback } from "react";
import { getAudioEngine } from "@/lib/audioEngine";
import { UI } from "@/lib/constants";

interface Props {
  isPlaying: boolean;
  color?: string;
}

export default function AudioVisualizer({ isPlaying, color = "#60a5fa" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  useEffect(() => {
    updateCanvasSize();

    const observer = new ResizeObserver(updateCanvasSize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateCanvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isMounted = true;

    const draw = () => {
      if (!isMounted) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.fillStyle = UI.CANVAS_BG_COLOR;
      ctx.fillRect(0, 0, w, h);

      const engine = getAudioEngine();
      const data = engine.getAnalyserData();

      if (data && isPlaying) {
        // Main waveform
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.beginPath();

        const sliceWidth = w / data.length;
        let x = 0;
        for (let i = 0; i < data.length; i++) {
          const v = data[i] * 0.5 + 0.5;
          const y = v * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();

        // Glow effect
        ctx.lineWidth = 6;
        ctx.strokeStyle = `${color}30`;
        ctx.beginPath();
        x = 0;
        for (let i = 0; i < data.length; i++) {
          const v = data[i] * 0.5 + 0.5;
          const y = v * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      } else {
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      isMounted = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, color]);

  return (
    <div ref={containerRef} className="w-full h-[120px] md:h-[150px]">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg border border-[#1f2937]"
        aria-label="Visualización de forma de onda"
        role="img"
      />
    </div>
  );
}

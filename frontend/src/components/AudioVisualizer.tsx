"use client";
import { useEffect, useRef } from "react";
import { getAudioEngine } from "@/lib/audioEngine";

interface Props {
  isPlaying: boolean;
  color?: string;
}

export default function AudioVisualizer({ isPlaying, color = "#60a5fa" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, w, h);

      const engine = getAudioEngine();
      const data = engine.getAnalyserData();

      if (data && isPlaying) {
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
        // Flat line when not playing
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
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, color]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={150}
      className="w-full h-[120px] md:h-[150px] rounded-lg border border-[#1f2937]"
    />
  );
}

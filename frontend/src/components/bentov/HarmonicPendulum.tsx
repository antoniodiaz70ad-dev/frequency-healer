"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULTS = { frequency: 0.1, amplitude: 1, phase: 0 } as const;

export default function HarmonicPendulum() {
  const [frequency, setFrequency] = useState<number>(DEFAULTS.frequency);
  const [amplitude, setAmplitude] = useState<number>(DEFAULTS.amplitude);
  const [phase, setPhase] = useState<number>(DEFAULTS.phase);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const raf = useRef<number | null>(null);
  const origin = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    if (!playing) { if (raf.current) cancelAnimationFrame(raf.current); return; }
    origin.current = performance.now() - timeRef.current * 1000;
    const tick = (now: number) => {
      const next = (now - origin.current) / 1000;
      timeRef.current = next;
      setTime(next);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing]);

  const omega = 2 * Math.PI * frequency;
  const harmonicPhase = omega * time + phase;
  const position = amplitude * Math.cos(harmonicPhase);
  const velocity = -omega * amplitude * Math.sin(harmonicPhase);
  const normalized = position / amplitude;
  const visualAngle = normalized * (20 + amplitude * 8) * Math.PI / 180;
  const pivot = { x: 300, y: 52 };
  const length = 215;
  const bob = { x: pivot.x + Math.sin(visualAngle) * length, y: pivot.y + Math.cos(visualAngle) * length };
  const speedRatio = Math.min(1, Math.abs(velocity) / Math.max(0.001, omega * amplitude));

  const reset = () => {
    setPlaying(false); timeRef.current = 0; setTime(0);
    setFrequency(DEFAULTS.frequency); setAmplitude(DEFAULTS.amplitude); setPhase(DEFAULTS.phase);
  };

  return (
    <section className="bentov-theory"><details open><summary>Explorar péndulo educativo</summary>
      <div className="bentov-pendulum-intro"><div><span className="bentov-simulation-badge">Simulación armónica</span><h3>Movimiento, posición y velocidad</h3></div><p>La frecuencia controla el ritmo; la amplitud, el recorrido. Es un modelo educativo y no una medición corporal.</p></div>
      <div className="bentov-pendulum-stage">
        <svg viewBox="0 0 600 330" role="img" aria-label={`Péndulo simulado: posición ${position.toFixed(2)} metros y velocidad ${velocity.toFixed(2)} metros por segundo`}>
          <defs><radialGradient id="bentov-bob" cx="35%" cy="28%"><stop offset="0" stopColor="#ecfeff"/><stop offset=".25" stopColor="#73d7cc"/><stop offset="1" stopColor="#1b7777"/></radialGradient><linearGradient id="bentov-rope" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e7fbff"/><stop offset="1" stopColor="#73d7cc"/></linearGradient><filter id="bentov-glow"><feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
          <path className="bentov-pendulum-arc" d="M 171 226 A 215 215 0 0 0 429 226"/><path className="bentov-pendulum-arc bentov-pendulum-arc--inner" d="M 232 257 A 215 215 0 0 0 368 257"/>
          <g className="bentov-pendulum-marks"><line x1="171" y1="216" x2="160" y2="233"/><line x1="300" y1="258" x2="300" y2="280"/><line x1="429" y1="216" x2="440" y2="233"/><text x="145" y="255">−A</text><text x="292" y="302">0</text><text x="438" y="255">+A</text></g>
          <circle cx={pivot.x} cy={pivot.y} r="16" className="bentov-pendulum-pivot"/><circle cx={pivot.x} cy={pivot.y} r="5" fill="#08111d"/><line x1={pivot.x} y1={pivot.y} x2={bob.x} y2={bob.y} stroke="url(#bentov-rope)" strokeWidth="4" strokeLinecap="round"/><circle cx={bob.x} cy={bob.y} r={31 + speedRatio * 3} fill="url(#bentov-bob)" filter="url(#bentov-glow)"/><circle cx={bob.x - 8} cy={bob.y - 10} r="7" fill="rgb(255 255 255 / 55%)"/>
        </svg>
        <div className="bentov-pendulum-readout" aria-live="off"><div><span>Posición</span><strong>{position.toFixed(2)} <small>m</small></strong></div><div><span>Velocidad</span><strong>{velocity.toFixed(2)} <small>m/s</small></strong></div><div><span>Periodo</span><strong>{(1 / frequency).toFixed(1)} <small>s</small></strong></div></div>
      </div>
      <div className="bentov-controls">
        <label>Frecuencia <span>{frequency.toFixed(2)} Hz</span><input aria-label="Frecuencia del péndulo" type="range" min="0.05" max="0.5" step="0.01" value={frequency} onChange={e => setFrequency(Number(e.target.value))}/></label>
        <label>Amplitud <span>{amplitude.toFixed(1)} m</span><input aria-label="Amplitud del péndulo" type="range" min="0.2" max="2" step="0.1" value={amplitude} onChange={e => setAmplitude(Number(e.target.value))}/></label>
        <label>Fase <span>{Math.round(phase * 180 / Math.PI)}°</span><input aria-label="Fase del péndulo" type="range" min="0" max={Math.PI * 2} step="0.1" value={phase} onChange={e => setPhase(Number(e.target.value))}/></label>
      </div>
      <div className="bentov-pendulum-actions"><button className="fh-action fh-action--primary" onClick={() => setPlaying(value => !value)}>{playing ? "Pausar movimiento" : "Iniciar movimiento"}</button><button className="fh-action fh-action--secondary" onClick={reset}>Restablecer</button></div>
      <p className="bentov-equation"><span>Modelo</span><code>x = A cos(2πft + fase)</code><code>v = −2πfA sen(2πft + fase)</code></p>
    </details></section>
  );
}

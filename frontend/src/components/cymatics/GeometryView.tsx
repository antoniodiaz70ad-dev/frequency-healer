'use client';
import { useEffect, useRef } from 'react';
import { FIGURES, INTERVALS, flowerCenters, pentagonalPanels, validateGeometry, type GeometryConfig, type Point3 } from '@/lib/cymatics/geometry';
import styles from './geometry.module.css';

export default function GeometryView({ config }: { config: GeometryConfig }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let frame = 0, last = -Infinity;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const paint = (time = 0) => {
      ctx.clearRect(0,0,800,600); ctx.fillStyle = '#080e1b'; ctx.fillRect(0,0,800,600);
      try { validateGeometry(config); } catch { return; }
      const shift = config.animate && !media.matches ? time / 1000 * config.baseHz / 256 : 0;
      const phase = config.phaseDegrees * Math.PI / 180, rotation = config.rotationDegrees * Math.PI / 180;
      const project = ([x,y,z]: Point3): [number,number] => {
        const a = x*Math.cos(rotation)-y*Math.sin(rotation), b = x*Math.sin(rotation)+y*Math.cos(rotation);
        return [400 + a*150, 300 + (b*.65-z*.75)*150];
      };
      const line = (points: [number,number][], color = '#80e1da', close = false) => {
        if (!points.length) return;
        ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.7;
        points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
        if (close) ctx.closePath(); ctx.stroke();
      };
      if (config.figure === 'flower') {
        const r = 240/(config.flowerRings+1);
        ctx.strokeStyle = '#e4c784'; ctx.lineWidth = 1.5;
        for (const [x,y] of flowerCenters(config.flowerRings)) {
          const a = x*Math.cos(rotation)-y*Math.sin(rotation), b = x*Math.sin(rotation)+y*Math.cos(rotation);
          ctx.beginPath();ctx.arc(400+a*r,300+b*r,r,0,Math.PI*2);ctx.stroke();
        }
      } else if (config.figure === 'lissajous') {
        const ratio = INTERVALS.find(i => i.id === config.interval)!;
        line(Array.from({length:1201},(_,i) => {
          const t = i/1200*Math.PI*2;
          return [400 + 235*Math.sin(ratio.denominator*t),300 + 235*Math.sin(ratio.numerator*t+phase)];
        }));
        const t = shift*Math.PI*2/ratio.denominator;
        ctx.fillStyle = '#f0d595';ctx.beginPath();ctx.arc(400+235*Math.sin(ratio.denominator*t),300+235*Math.sin(ratio.numerator*t+phase),6,0,Math.PI*2);ctx.fill();
      } else if (config.figure === 'russell') {
        const cycle = .5+.5*Math.cos(phase+shift*Math.PI*2), width = .2+.7*cycle;
        line([project([0,0,-1.5]),project([0,0,1.5])],'#627693');
        for (const sign of [-1,1]) {
          line(Array.from({length:321},(_,i) => {
            const u=i/320, a=u*Math.PI*8, radius=width*u;
            return project([radius*Math.cos(a),radius*Math.sin(a),sign*(1.4-u*1.15)]);
          }),sign===1?'#e4c784':'#80e1da');
          line(Array.from({length:121},(_,i)=>{const a=i/120*Math.PI*2;return project([width*Math.cos(a),width*Math.sin(a),sign*.25]);}));
        }
        ctx.fillStyle='#e8f7f4'; const center=project([0,0,0]);ctx.beginPath();ctx.arc(...center,5,0,Math.PI*2);ctx.fill();
      } else {
        const panels = pentagonalPanels(config.openingDegrees);
        for(let copy=0;copy<config.copies;copy++) for(const panel of panels) {
          const offset=(copy-(config.copies-1)/2)*1.75, scale=config.copies>1?.7:1.2;
          line(panel.map(([x,y,z])=>project([(x+offset)*scale,y*scale,z*scale])),copy%2?'#e4c784':'#80e1da',true);
        }
      }
    };
    const loop = (time: number) => {
      if (time-last>=32) { paint(time);last=time; }
      frame=requestAnimationFrame(loop);
    };
    const sync = () => {
      cancelAnimationFrame(frame);paint();
      if(config.animate && !media.matches && !document.hidden && ['russell','lissajous'].includes(config.figure)) frame=requestAnimationFrame(loop);
    };
    sync(); media.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
    return () => {cancelAnimationFrame(frame);media.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);};
  },[config]);
  const figure = FIGURES.find(f=>f.id===config.figure)!;
  return <figure className={styles.figure}><canvas ref={ref} width="800" height="600" role="img" aria-label={`Visualización: ${figure.name}`} /><figcaption>{figure.kind} · {figure.description}{config.animate && ['lissajous','russell'].includes(config.figure) && ` Movimiento ilustrativo: base visual = f₀/256; con ${config.baseHz} Hz se representan ${(config.baseHz/256).toFixed(3)} ciclos/s. Se respeta la preferencia de movimiento reducido.`}</figcaption></figure>;
}

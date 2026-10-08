'use client';
import { useEffect, useMemo, useRef } from 'react';
import type { CymaticsConfigV1, ModalField } from '@/lib/cymatics/types';

interface Props { config:CymaticsConfigV1; field:ModalField; label:string; hidden?:boolean; captureRef?:React.RefObject<HTMLCanvasElement|null>; scaleMax?:number; }
const palette=(t:number)=>`hsl(${205+85*t} 90% ${12+58*t}%)`;
function random(seed:number){let s=seed>>>0;return()=>((s=Math.imul(1664525,s)+1013904223>>>0)/4294967296);}

export default function CymaticsCanvas({config,field,label,hidden,captureRef,scaleMax}:Props){
  const own=useRef<HTMLCanvasElement>(null),canvasRef=captureRef??own;
  const particles=useMemo(()=>{const r=random(config.particleSeed),count=config.renderQuality==='high'?1400:config.renderQuality==='medium'?850:420;return Array.from({length:count},()=>({x:r(),y:r(),j:r()}));},[config.particleSeed,config.renderQuality]);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas||hidden)return;const ctx=canvas.getContext('2d');if(!ctx)return;let frame=0,raf=0,visible=document.visibilityState==='visible';const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize=()=>{const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(320,Math.round(rect.width*dpr));canvas.height=Math.max(240,Math.round(rect.height*dpr));};resize();
    const render=()=>{if(!visible)return;const w=canvas.width,h=canvas.height,s=field.size,side=Math.min(w,h)*.92,ox=(w-side)/2,oy=(h-side)/2,scale=config.autoExposure?Math.max(field.maxAmplitude,1e-12):Math.max(scaleMax??field.maxAmplitude*2,1e-12);ctx.fillStyle='#030712';ctx.fillRect(0,0,w,h);
      if(config.view==='field'){const cell=side/s;for(let y=0;y<s;y++)for(let x=0;x<s;x++){const v=Math.min(1,field.values[y*s+x]/scale);ctx.fillStyle=palette(v);ctx.fillRect(ox+x*cell,oy+y*cell,cell+1,cell+1);}}
      else {ctx.strokeStyle='#26344d';ctx.lineWidth=2;ctx.beginPath();if(config.surfaceType==='circular-membrane'){ctx.arc(w/2,h/2,side/2,0,Math.PI*2);}else ctx.rect(ox,oy,side,side);ctx.stroke();ctx.fillStyle='#d7f5ff';const drift=reduced?0:Math.sin(frame/45)*.004;for(const p of particles){const ix=Math.min(s-1,Math.max(0,Math.floor(p.x*s))),iy=Math.min(s-1,Math.max(0,Math.floor(p.y*s)));const v=field.values[iy*s+ix]/Math.max(field.maxAmplitude,1e-12);if(v<.48&&config.surfaceType==='square-plate'||v<.48&&Math.hypot(p.x-.5,p.y-.5)<.5){const x=ox+(p.x+drift*(p.j-.5))*side,y=oy+p.y*side;ctx.globalAlpha=.35+.6*(1-v);ctx.fillRect(x,y,1.4,1.4);}}ctx.globalAlpha=1;}
      ctx.fillStyle='rgba(3,7,18,.78)';ctx.fillRect(12,h-48,Math.min(w-24,390),34);ctx.fillStyle='#dbeafe';ctx.font=`${Math.max(12,w/55)}px ui-monospace`;ctx.fillText(`${label} · ${config.channelFrequenciesHz.join(' / ')} Hz · ${config.modelVersion}`,22,h-26);frame++;if(!reduced)raf=requestAnimationFrame(render);};
    const visibility=()=>{visible=document.visibilityState==='visible';if(visible){cancelAnimationFrame(raf);render();}};document.addEventListener('visibilitychange',visibility);window.addEventListener('resize',resize);render();return()=>{cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('resize',resize);};
  },[canvasRef,config,field,hidden,label,particles,scaleMax]);
  if(hidden)return <div className="cymatics-hidden" role="status">Visual oculto. El audio puede continuar.</div>;
  return <canvas ref={canvasRef} className="cymatics-canvas" role="img" aria-label={label}/>;
}

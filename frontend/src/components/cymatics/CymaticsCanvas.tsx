'use client';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { createParticles, sampleField, stepParticles } from '@/lib/cymatics/particles';
import type { CymaticsConfigV1, ModalField } from '@/lib/cymatics/types';
import styles from './cymatics.module.css';

interface Props { config:CymaticsConfigV1; field:ModalField; label:string; hidden?:boolean; captureRef?:React.RefObject<HTMLCanvasElement|null>; scaleMax?:number; showContours?:boolean; resetToken?:number; }
const palette=(t:number)=>`hsl(${218+72*t} ${70+20*t}% ${9+58*t}%)`;
const displacementPalette=(value:number)=>value>=0?`hsl(184 88% ${12+54*Math.min(1,value)}%)`:`hsl(276 88% ${12+54*Math.min(1,-value)}%)`;

function contourSegments(field:ModalField,threshold=.085){
  const segments:Array<[number,number,number,number]>=[],s=field.size;
  for(let y=0;y<s-1;y++)for(let x=0;x<s-1;x++){
    const values=[field.values[y*s+x],field.values[y*s+x+1],field.values[(y+1)*s+x+1],field.values[(y+1)*s+x]].map(v=>v/Math.max(field.maxAmplitude,1e-20));
    const points:Array<[number,number]>=[],corners:[[number,number],[number,number],[number,number],[number,number]]=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
    for(let edge=0;edge<4;edge++){const next=(edge+1)%4,a=values[edge],b=values[next];if((a<threshold)!==(b<threshold)){const t=(threshold-a)/(b-a),p=corners[edge],q=corners[next];points.push([(p[0]+(q[0]-p[0])*t+.5)/s,(p[1]+(q[1]-p[1])*t+.5)/s]);}}
    if(points.length===2)segments.push([points[0][0],points[0][1],points[1][0],points[1][1]]);else if(points.length===4)segments.push([points[0][0],points[0][1],points[1][0],points[1][1]],[points[2][0],points[2][1],points[3][0],points[3][1]]);
  }
  return segments;
}

export default function CymaticsCanvas({config,field,label,hidden,captureRef,scaleMax,showContours=false,resetToken=0}:Props){
  const own=useRef<HTMLCanvasElement>(null),canvasRef=captureRef??own,count=config.renderQuality==='high'?1150:config.renderQuality==='medium'?720:380;
  const particles=useMemo(()=>{void resetToken;void field;return createParticles(config.particleSeed,count,config.surfaceType);},[config.particleSeed,config.surfaceType,count,field,resetToken]);
  const contours=useMemo(()=>contourSegments(field),[field]);
  useLayoutEffect(()=>{
    const canvas=canvasRef.current;if(!canvas||hidden)return;const ctx=canvas.getContext('2d');if(!ctx)return;let raf=0,visible=document.visibilityState==='visible',last=performance.now(),accumulator=0;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,fixedStep=1/120;
    const resize=()=>{const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(320,Math.round(rect.width*dpr));canvas.height=Math.max(240,Math.round(rect.height*dpr));};resize();
    if(reduced&&config.view==='particles')for(let i=0;i<480;i++)stepParticles(particles,field,config.surfaceType,fixedStep);
    const drawBoundary=(w:number,h:number,side:number,ox:number,oy:number)=>{ctx.strokeStyle='#5d789f';ctx.lineWidth=Math.max(1.5,w/500);ctx.beginPath();if(config.surfaceType==='circular-membrane')ctx.arc(w/2,h/2,side/2,0,Math.PI*2);else ctx.rect(ox,oy,side,side);ctx.stroke();};
    const drawField=(w:number,h:number,side:number,ox:number,oy:number,opacity=1)=>{const s=field.size,cell=side/s,scale=config.autoExposure?Math.max(field.maxAmplitude,1e-20):Math.max(scaleMax??field.maxAmplitude*2,1e-20);ctx.save();ctx.globalAlpha=opacity;for(let y=0;y<s;y++)for(let x=0;x<s;x++){const px=(x+.5)/s,py=(y+.5)/s;if(config.surfaceType==='circular-membrane'&&Math.hypot(px-.5,py-.5)>.5)continue;const value=Math.min(1,field.values[y*s+x]/scale);ctx.fillStyle=palette(value);ctx.fillRect(ox+x*cell,oy+y*cell,cell+1,cell+1);}ctx.restore();};
    const drawVibration=(side:number,ox:number,oy:number,now:number)=>{const s=field.size,cell=side/s,scale=config.autoExposure?Math.max(field.maxAmplitude,1e-20):Math.max(scaleMax??field.maxAmplitude,1e-20),phase=reduced?0:(now/900)%(Math.PI*2),cos=Math.cos(phase),sin=Math.sin(phase);for(let y=0;y<s;y++)for(let x=0;x<s;x++){const px=(x+.5)/s,py=(y+.5)/s;if(config.surfaceType==='circular-membrane'&&Math.hypot(px-.5,py-.5)>.5)continue;const index=y*s+x,displacement=(field.realValues[index]*cos-field.imaginaryValues[index]*sin)/scale;ctx.fillStyle=displacementPalette(displacement);ctx.fillRect(ox+x*cell,oy+y*cell,cell+1,cell+1);}};
    const drawContours=(side:number,ox:number,oy:number)=>{ctx.save();ctx.strokeStyle='#79f4dc';ctx.shadowColor='rgba(121,244,220,.35)';ctx.shadowBlur=3;ctx.lineWidth=Math.max(1.4,side/360);ctx.beginPath();for(const [x1,y1,x2,y2] of contours){ctx.moveTo(ox+x1*side,oy+y1*side);ctx.lineTo(ox+x2*side,oy+y2*side);}ctx.stroke();ctx.restore();};
    const render=(now=performance.now())=>{if(!visible)return;const elapsed=Math.min(.08,(now-last)/1000);last=now;if(config.view==='particles'&&!reduced){accumulator+=elapsed;while(accumulator>=fixedStep){stepParticles(particles,field,config.surfaceType,fixedStep);accumulator-=fixedStep;}}
      const w=canvas.width,h=canvas.height,side=Math.min(w,h)*.9,ox=(w-side)/2,oy=(h-side)/2;ctx.fillStyle='#020611';ctx.fillRect(0,0,w,h);
      if(config.view==='field')drawField(w,h,side,ox,oy,1);else if(config.view==='vibration'){drawVibration(side,ox,oy,now);if(showContours)drawContours(side,ox,oy);}else if(config.view==='nodal-lines'){drawField(w,h,side,ox,oy,.3);drawContours(side,ox,oy);}else{drawField(w,h,side,ox,oy,.24);if(showContours)drawContours(side,ox,oy);for(const particle of particles){const amplitude=sampleField(field,particle.x,particle.y),radius=Math.max(1.5,w/430)*(1.12-.35*Math.min(1,amplitude));ctx.fillStyle=amplitude<.14?'#fff7c8':'#d9f8ff';ctx.globalAlpha=.58+.4*(1-Math.min(1,amplitude));ctx.beginPath();ctx.arc(ox+particle.x*side,oy+particle.y*side,radius,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
      drawBoundary(w,h,side,ox,oy);ctx.fillStyle='rgba(2,6,17,.82)';ctx.fillRect(12,h-48,Math.min(w-24,430),34);ctx.fillStyle='#e7f2ff';ctx.font=`${Math.max(12,w/55)}px ui-monospace`;ctx.fillText(`${label} · ${config.channelFrequenciesHz.map(f=>f.toFixed(1)).join(' / ')} Hz`,22,h-26);if(!reduced)raf=requestAnimationFrame(render);};
    const observer=new ResizeObserver(()=>{resize();render();});observer.observe(canvas);
    const visibility=()=>{visible=document.visibilityState==='visible';if(visible){last=performance.now();cancelAnimationFrame(raf);resize();render();}else cancelAnimationFrame(raf);};document.addEventListener('visibilitychange',visibility);window.addEventListener('resize',resize);render();return()=>{cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('resize',resize);};
  },[canvasRef,config,contours,field,hidden,label,particles,scaleMax,showContours]);
  if(hidden)return <div className={styles.hidden} role="status">Visual pausado y oculto. El audio puede continuar.</div>;
  return <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={label}/>;
}

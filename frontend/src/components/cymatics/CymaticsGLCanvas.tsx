'use client';
import {useEffect,useLayoutEffect,useRef} from 'react';
import type React from 'react';
import type {CymaticsParticle} from '@/lib/cymatics/particles';
import type {SurfaceType} from '@/lib/cymatics/types';
import {CymaticsGLRenderer,type SandFrames} from './CymaticsGLRenderer';
import styles from './cymatics.module.css';

/** Renders grains every display frame (no 30 fps cap); motion between physics steps is interpolated on the GPU. */
export default function CymaticsGLCanvas({particles,surface,frames,onReady}:{particles:CymaticsParticle[];surface:SurfaceType;frames?:React.RefObject<SandFrames|null>;onReady:(ready:boolean)=>void}){const ref=useRef<HTMLCanvasElement>(null),latest=useRef({particles,surface});
  useLayoutEffect(()=>{latest.current={particles,surface};},[particles,surface]);
  // The renderer lives as long as the canvas: changing grains or surface must not toggle WebGL readiness (that used to restart the sand worker).
  useEffect(()=>{const canvas=ref.current;if(!canvas)return;let renderer:CymaticsGLRenderer;try{renderer=new CymaticsGLRenderer(canvas);onReady(true);}catch{onReady(false);return;}let raf=0;const draw=(now:number)=>{renderer.render(latest.current.particles,latest.current.surface,frames?.current,now);raf=requestAnimationFrame(draw);};raf=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(raf);renderer.destroy();onReady(false);};},[frames,onReady]);return <canvas ref={ref} className={styles.glCanvas} aria-hidden="true"/>;}

'use client';
import {useEffect,useRef} from 'react';
import type {CymaticsParticle} from '@/lib/cymatics/particles';
import type {SurfaceType} from '@/lib/cymatics/types';
import {CymaticsGLRenderer} from './CymaticsGLRenderer';
import styles from './cymatics.module.css';

export default function CymaticsGLCanvas({particles,surface,onReady}:{particles:CymaticsParticle[];surface:SurfaceType;onReady:(ready:boolean)=>void}){const ref=useRef<HTMLCanvasElement>(null);useEffect(()=>{const canvas=ref.current;if(!canvas)return;let renderer:CymaticsGLRenderer;try{renderer=new CymaticsGLRenderer(canvas);onReady(true);}catch{onReady(false);return;}let raf=0,last=0;const draw=(now=0)=>{if(now-last>=1000/30){renderer.render(particles,surface);last=now;}raf=requestAnimationFrame(draw);};draw();return()=>{cancelAnimationFrame(raf);renderer.destroy();onReady(false);};},[onReady,particles,surface]);return <canvas ref={ref} className={styles.glCanvas} aria-hidden="true"/>;}

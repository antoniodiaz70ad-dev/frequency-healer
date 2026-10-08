'use client';
import dynamic from 'next/dynamic';
const CymaticsLab=dynamic(()=>import('@/components/cymatics/CymaticsLab'),{ssr:false,loading:()=> <p role="status">Cargando simulación…</p>});
export default function CymaticsLoader(){return <CymaticsLab/>;}

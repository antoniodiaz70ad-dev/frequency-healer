'use client';
import dynamic from 'next/dynamic';
const CymaticsLab=dynamic(()=>import('@/components/cymatics/CymaticsWorkspace'),{ssr:false,loading:()=> <p role="status">Cargando simulación…</p>});
export default function CymaticsLoader(){return <CymaticsLab/>;}

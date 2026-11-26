"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { readRecordCollections, type RecordCollection } from "@/lib/recordCollections";
import { VOICE_ENABLED, HARMONIC_ENABLED } from "@/lib/voice/feature";
export default function RecordsPage(){
 const [rows,setRows]=useState<RecordCollection[]>([]),[loading,setLoading]=useState(true),[query,setQuery]=useState(""),[type,setType]=useState("todos");
 useEffect(()=>{let current=true;void readRecordCollections({getItem:key=>localStorage.getItem(key)}).then(value=>{if(current){setRows(value);setLoading(false);}});return()=>{current=false;};},[]);
 const visible=rows.filter(r=>(!r.gated||(r.gated==="voice"?VOICE_ENABLED:HARMONIC_ENABLED))&&(type==="todos"||r.type===type)&&r.title.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
 return <div className="rl-collection"><header className="rl-collection-header"><p className="rl-kicker">Tu experiencia, a mano</p><h1>Mis registros</h1><p>Encuentra tus diarios, experimentos y recetas. Cada cuaderno conserva su contenido y sus opciones de exportación.</p></header>
 <p className="rl-muted">Los registros pertenecen a este navegador. Esta vista los consulta sin moverlos ni modificarlos.</p>
 <div className="rl-record-tools"><input aria-label="Buscar un cuaderno" placeholder="Buscar un cuaderno" type="search" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Tipo de registro" value={type} onChange={e=>setType(e.target.value)}><option value="todos">Todos los registros</option><option value="diarios">Diarios y sesiones</option><option value="experimentos">Experimentos</option><option value="recetas">Recetas y estructuras</option></select></div>
 {loading?<p role="status">Consultando tus registros…</p>:visible.length===0?<p role="status">No hay cuadernos que coincidan con esta búsqueda.</p>:<ul className="rl-destination-list">{visible.map(r=><li key={r.id}><Link href={r.href} className="rl-destination"><h2>{r.title}</h2><p>{r.description}</p></Link><span className={`rl-record-count ${r.error?"rl-record-error":""}`}>{r.error??(r.count===undefined?"Abrir diario":`${r.count} ${r.count===1?"registro":"registros"}`)}</span></li>)}</ul>}
 <p className="rl-collection-note"><Link href="/ajustes" className="rl-text-link">Datos y copias de respaldo</Link></p></div>;
}

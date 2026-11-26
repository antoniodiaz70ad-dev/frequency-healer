"use client";
import Link from "next/link";
import { useState } from "react";
import { FavoriteList } from "@/components/navigation/Favorites";
const choices=[
 {id:"practicar",title:"Practicar",description:"Preparar una sesión de sonido y atención",cta:"Elegir una práctica",href:"/practicar"},
 {id:"estudiar",title:"Estudiar",description:"Consultar libros, conceptos y fuentes",cta:"Abrir mi biblioteca",href:"/estudiar"},
 {id:"experimentar",title:"Experimentar",description:"Comparar una variable y registrar lo observado",cta:"Elegir un experimento",href:"/experimentar"},
] as const;
export default function HomePage(){
 const [purpose,setPurpose]=useState<string>("estudiar"),selected=choices.find(c=>c.id===purpose)!;
 return <div className="rl-home"><p className="rl-home-eyebrow">Tu espacio de exploración</p>
 <h1>Una pregunta.<br/>Un camino para explorar.</h1>
 <p className="rl-home-description">Practica con sonido, comprende sus principios y contrasta tus observaciones.</p>
 <fieldset className="rl-purpose"><legend>Hoy quiero</legend><div className="rl-purpose-options">
 {choices.map(c=><label key={c.id} className="rl-purpose-option"><input type="radio" name="purpose" value={c.id} checked={purpose===c.id} onChange={()=>setPurpose(c.id)}/><span className="rl-purpose-name">{c.title}</span><span className="rl-purpose-description">{c.description}</span></label>)}
 </div></fieldset><div className="rl-home-actions"><Link href={selected.href} className="rl-button">{selected.cta}</Link><Link href="/mis-registros" className="rl-text-link">Ver mis registros</Link></div><FavoriteList/></div>;
}

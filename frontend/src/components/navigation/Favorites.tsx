"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "@phosphor-icons/react";
import { destinations, FAVORITES_KEY, parseFavorites } from "@/lib/navigation";
import { VOICE_ENABLED, HARMONIC_ENABLED } from "@/lib/voice/feature";
const EVENT="resonance-favorites-updated";
export function useFavorites(){
 const [ids,setIds]=useState<string[]>([]),[error,setError]=useState("");
 useEffect(()=>{const read=()=>{try{setIds(parseFavorites(localStorage.getItem(FAVORITES_KEY)));setError("");}catch{setError("Tus favoritos no están disponibles en este navegador.");}};read();window.addEventListener(EVENT,read);window.addEventListener("storage",read);return()=>{window.removeEventListener(EVENT,read);window.removeEventListener("storage",read);};},[]);
 const toggle=(id:string)=>{try{const current=parseFavorites(localStorage.getItem(FAVORITES_KEY));localStorage.setItem(FAVORITES_KEY,JSON.stringify(current.includes(id)?current.filter(x=>x!==id):[...current,id]));window.dispatchEvent(new Event(EVENT));}catch{setError("No se pudo actualizar el favorito. Tus datos se conservan.");}};
 return {ids,error,toggle};
}
export function FavoriteButton({id,title}:{id:string;title:string}){
 const {ids,error,toggle}=useFavorites(),active=ids.includes(id);
 return <span className="rl-favorite-control"><button type="button" className="rl-favorite-button" aria-label={`${active?"Quitar":"Añadir"} ${title} ${active?"de":"a"} favoritos`} aria-pressed={active} onClick={()=>toggle(id)} title={active?"Quitar de favoritos":"Añadir a favoritos"}><Star size={24} weight={active?"fill":"regular"} aria-hidden="true"/></button>{error&&<span className="rl-inline-error" role="status">{error}</span>}</span>;
}
export function FavoriteList(){
 const {ids,error}=useFavorites(),rows=destinations.filter(d=>ids.includes(d.id)&&(!d.gated||(d.gated==="voice"?VOICE_ENABLED:HARMONIC_ENABLED)));
 if(!rows.length&&!error)return null;
 return <section className="rl-favorites" aria-labelledby="favoritos"><h2 id="favoritos">Favoritos</h2>{error?<p role="status">{error}</p>:<ul>{rows.map(r=><li key={r.id}><Link href={r.href}>{r.title}</Link></li>)}</ul>}<p className="rl-muted">Guardados en este navegador.</p></section>;
}

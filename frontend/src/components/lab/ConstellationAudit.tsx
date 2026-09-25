'use client';
import { useEffect, useState } from 'react';
import type { ConstellationExperimentLinkV2 } from '@/lib/experiments/v2';
import { CONSTELLATIONS_KEY, ConstellationStore } from '@/lib/harmonic/constellationStorage';
import styles from './SavedExperimentReader.module.css';
export default function ConstellationAudit({link}:{link:ConstellationExperimentLinkV2}) {
  const [source,setSource]=useState('Comprobando la fuente actual…');
  useEffect(()=>{
    let active=true,run=0;
    const check=async()=>{const current=++run;try{const rows=await new ConstellationStore(localStorage).load();const found=rows.find(row=>row.id===link.id);const message=!found?'La constelación de origen ya no está disponible con este ID.':JSON.stringify(found)===JSON.stringify(link.snapshot)?'La fuente actual coincide con el snapshot confirmado.':'La fuente actual cambió desde la confirmación (incluido nombre o definición).';if(active&&current===run)setSource(message);}catch{if(active&&current===run)setSource('La fuente actual no se puede verificar. El experimento conserva su snapshot independiente.');}};
    void check();const changed=(event:StorageEvent)=>{if(event.key===CONSTELLATIONS_KEY||event.key===null)void check();};window.addEventListener('storage',changed);return()=>{active=false;window.removeEventListener('storage',changed);};
  },[link]);
  const snapshot=link.snapshot;
  return <section aria-label="Constelación vinculada"><h4>Constelación confirmada · snapshot inmutable</h4>
    <dl className={styles.fields}>{[['Nombre',snapshot.name??'Sin registrar'],['ID de constelación',link.id],['Firma exacta',link.signature],['Generación',link.generationVersion],['Semilla',`${snapshot.seedFrequencyHz} Hz`],['Modo',snapshot.playbackMode],['Orden',snapshot.playbackOrder?.join(' → ')??'Simultáneo; multiplicidad conservada']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <table><caption>Miembros confirmados de la constelación</caption><thead><tr><th>ID</th><th>Tipo / relación</th><th>Frecuencia exacta</th></tr></thead><tbody>{snapshot.members.map(member=><tr key={member.id}><th scope="row">{member.id}</th><td>{member.relationshipType} · {member.relationshipType==='root'?'1:1':member.relationshipType==='ratio'?`${member.ratio.numerator}:${member.ratio.denominator}`:`octava ${member.octaveOffset}`}</td><td>{member.frequencyHz} Hz</td></tr>)}</tbody></table>
    <p role="status">{source}</p><p>La disponibilidad actual de la fuente no cambia la validez del snapshot guardado ni su exportación. La firma matemática no identifica por sí sola nombres o IDs.</p>
  </section>;
}

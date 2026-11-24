'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import CymaticsLab from './CymaticsLab';
import GeometryIntentionLab from './GeometryIntentionLab';
import styles from './geometry.module.css';

export default function CymaticsWorkspace() {
  const search=useSearchParams(),router=useRouter(),geometry=search.get('area')==='geometria';
  const choose=(next:boolean)=>{const params=new URLSearchParams(search.toString());if(next)params.set('area','geometria');else params.delete('area');router.replace(`/laboratorio-cimatico${params.size?`?${params}`:''}`,{scroll:false});};
  const navigation=<nav className={styles.navigation} aria-label="Áreas del laboratorio"><button type="button" aria-pressed={!geometry} onClick={()=>choose(false)}>Placas y membranas</button><button type="button" aria-pressed={geometry} onClick={()=>choose(true)}>Geometría e intención</button></nav>;
  return geometry?<GeometryIntentionLab navigation={navigation}/>:<CymaticsLab navigation={navigation}/>;
}

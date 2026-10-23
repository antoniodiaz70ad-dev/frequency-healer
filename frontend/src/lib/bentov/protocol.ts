import { BENTOV_PROTOCOL_VERSION, type BentovMode, type BentovProgram } from './types';

export const BENTOV_PHASES = Object.freeze([
  {id:'settle',label:'Respiración natural',durationMs:120_000},
  {id:'practice',label:'Práctica central',durationMs:360_000},
  {id:'observe',label:'Respiración natural y observación',durationMs:120_000},
] as const);
export const BENTOV_TOTAL_MS = 600_000;
export const BENTOV_INHALE_MS = 5_000;
export const BENTOV_EXHALE_MS = 5_000;

const isoDate=(date:Date)=>date.toISOString().slice(0,10);
const shuffled=(values:BentovMode[],random:()=>number)=>{const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;};
export function createBentovProgram(startDate:string,timezone:string,random=Math.random,now=new Date()):BentovProgram{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!timezone)throw new Error('Fecha o zona horaria inválida.');
  const modes=[...shuffled(['paced','paced','paced','paced','natural','natural','natural'],random),...shuffled(['paced','paced','paced','natural','natural','natural','natural'],random)];
  const base=new Date(`${startDate}T12:00:00Z`);
  return {id:crypto.randomUUID(),schemaVersion:1,protocolVersion:BENTOV_PROTOCOL_VERSION,createdAt:now.toISOString(),timezone,startDate,schedule:modes.map((assignedMode,index)=>{const date=new Date(base);date.setUTCDate(base.getUTCDate()+index);return {date:isoDate(date),assignedMode};})};
}
export function phaseAt(activeMs:number,mode:BentovMode){const bounded=Math.max(0,Math.min(activeMs,BENTOV_TOTAL_MS));if(bounded<120_000)return {phase:'settle' as const,label:'Respiración natural',phaseElapsedMs:bounded};if(bounded<480_000)return {phase:'practice' as const,label:mode==='paced'?'Guía 5 s inhalar · 5 s exhalar':'Respiración natural',phaseElapsedMs:bounded-120_000};return {phase:'observe' as const,label:'Respiración natural y observación',phaseElapsedMs:bounded-480_000};}
export function breathingAt(activeMs:number){const guided=Math.max(0,activeMs-120_000),cycle=guided%(BENTOV_INHALE_MS+BENTOV_EXHALE_MS);return cycle<BENTOV_INHALE_MS?{phase:'inhale' as const,label:'Inhala con suavidad',progress:cycle/BENTOV_INHALE_MS}:{phase:'exhale' as const,label:'Exhala con suavidad',progress:(cycle-BENTOV_INHALE_MS)/BENTOV_EXHALE_MS};}


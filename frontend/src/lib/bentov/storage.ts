import type { BentovDraft, BentovProgram, BentovSession } from './types';
import { parsePrograms, parseSessions, validateBentovProgram, validateBentovSession } from './validation';
export const BENTOV_PROGRAMS_KEY='rl:bentov-programs:v1';
export const BENTOV_SESSIONS_KEY='rl:bentov-sessions:v1';
export const BENTOV_DRAFT_KEY='rl:bentov-draft:v1';
export interface BentovStorage {getItem(k:string):string|null;setItem(k:string,v:string):void;removeItem?(k:string):void}
export type SafeRead<T>={status:'absent';data:T}|{status:'valid';data:T}|{status:'invalid';data:T;raw:string;error:string};
const read=<T>(storage:BentovStorage,key:string,empty:T,parser:(raw:string)=>T):SafeRead<T>=>{const raw=storage.getItem(key);if(raw===null)return {status:'absent',data:empty};try{return {status:'valid',data:parser(raw)}}catch(e){return {status:'invalid',data:empty,raw,error:(e as Error).message}}};
export const readBentovPrograms=(s:BentovStorage)=>read(s,BENTOV_PROGRAMS_KEY,[] as BentovProgram[],parsePrograms);
export const readBentovSessions=(s:BentovStorage)=>read(s,BENTOV_SESSIONS_KEY,[] as BentovSession[],parseSessions);
export function saveBentovProgram(storage:BentovStorage,program:BentovProgram){validateBentovProgram(program);const current=readBentovPrograms(storage);if(current.status==='invalid')throw new Error('Los programas guardados están dañados; se conservaron sin sobrescribir.');const existing=current.data.find(x=>x.id===program.id);if(existing){if(JSON.stringify(existing)!==JSON.stringify(program))throw new Error('El calendario iniciado es inmutable.');return existing;}storage.setItem(BENTOV_PROGRAMS_KEY,JSON.stringify([...current.data,program]));return program;}
export function saveBentovSession(storage:BentovStorage,session:BentovSession){validateBentovSession(session);const current=readBentovSessions(storage);if(current.status==='invalid')throw new Error('Las sesiones guardadas están dañadas; se conservaron sin sobrescribir.');const index=current.data.findIndex(x=>x.id===session.id);if(index<0&&session.programId&&session.scheduledDate&&current.data.some(x=>x.programId===session.programId&&x.scheduledDate===session.scheduledDate))throw new Error('Ya existe una sesión programada para esta fecha.');const next=index<0?[...current.data,session]:current.data.map((x,i)=>i===index?session:x);storage.setItem(BENTOV_SESSIONS_KEY,JSON.stringify(next));return session;}
export function saveBentovDraft(storage:BentovStorage,draft:BentovDraft){storage.setItem(BENTOV_DRAFT_KEY,JSON.stringify(draft));}
export function clearBentovDraft(storage:BentovStorage){storage.removeItem?.(BENTOV_DRAFT_KEY);}


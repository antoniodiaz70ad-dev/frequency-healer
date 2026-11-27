import { validateComposition, type ComposerRecipe } from './composer';
export const QUICK_RECORDS_KEY='fh.practice.records.v1';
export type RecipeVersion={id:string;savedAt:string;recipe:ComposerRecipe;volume:number};
export type QuickSession={id:string;versionId?:string;startedAt:string;endedAt:string;status:'completed'|'stopped';elapsedMs:number;recipe:ComposerRecipe;initialVolume:number;volumeChanges:{atMs:number;volume:number}[];experience:string};
export type QuickRecords={schemaVersion:1;versions:RecipeVersion[];sessions:QuickSession[]};
type Store=Pick<Storage,'getItem'|'setItem'>;
const date=(s:string)=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const volume=(n:number)=>Number.isFinite(n)&&n>=0&&n<=.6;
const identity=(s:string)=>typeof s==='string'&&s.length>0&&s.length<=200;
function validate(data:QuickRecords){
 if(!data||data.schemaVersion!==1||!Array.isArray(data.versions)||!Array.isArray(data.sessions))throw Error('Formato inválido.');
 const ids=new Set<string>();
 for(const v of data.versions){validateComposition(v.recipe);if(!identity(v.id)||ids.has(v.id)||!date(v.savedAt)||!volume(v.volume))throw Error('Versión inválida.');ids.add(v.id);}
 const sessions=new Set<string>();
 for(const s of data.sessions){
  validateComposition(s.recipe);
  if(!identity(s.id)||sessions.has(s.id)||!date(s.startedAt)||!date(s.endedAt)||Date.parse(s.endedAt)<Date.parse(s.startedAt)||!['completed','stopped'].includes(s.status)||!Number.isFinite(s.elapsedMs)||s.elapsedMs<0||s.elapsedMs>s.recipe.durationMinutes*60000||!volume(s.initialVolume)||typeof s.experience!=='string'||s.experience.length>6000||!Array.isArray(s.volumeChanges))throw Error('Práctica inválida.');
  if(s.status==='completed'&&s.elapsedMs!==s.recipe.durationMinutes*60000)throw Error('Práctica incompleta.');
  let at=0;for(const c of s.volumeChanges){if(!Number.isFinite(c.atMs)||c.atMs<at||c.atMs>s.elapsedMs||!volume(c.volume))throw Error('Ajuste inválido.');at=c.atMs;}
  if(s.versionId!==undefined){const v=data.versions.find(v=>v.id===s.versionId);if(!v||JSON.stringify(v.recipe)!==JSON.stringify(s.recipe)||v.volume!==s.initialVolume)throw Error('La práctica no coincide con su versión.');}
  sessions.add(s.id);
 }
}
export function readQuickRecords(store:Pick<Storage,'getItem'>):QuickRecords{
 const raw=store.getItem(QUICK_RECORDS_KEY);if(raw===null)return {schemaVersion:1,versions:[],sessions:[]};
 try{const data=JSON.parse(raw);validate(data);return data;}catch{throw Error('No se pudieron leer tus prácticas. El original se conserva; expórtalo antes de continuar.');}
}
/** One atomic document; explicit append only. Existing IDs and payloads never change. */
export function appendQuickRecord(store:Store,kind:'versions',row:RecipeVersion):QuickRecords;
export function appendQuickRecord(store:Store,kind:'sessions',row:QuickSession):QuickRecords;
export function appendQuickRecord(store:Store,kind:'versions'|'sessions',row:RecipeVersion|QuickSession):QuickRecords{
 const data=readQuickRecords(store);if(data[kind].some(v=>v.id===row.id))throw Error('Este identificador ya existe. Guarda una versión nueva.');
 if(kind==='versions')data.versions.push(structuredClone(row as RecipeVersion));else data.sessions.push(structuredClone(row as QuickSession));
 validate(data);store.setItem(QUICK_RECORDS_KEY,JSON.stringify(data));return data;
}
export function restoreQuickRecords(store:Store,raw:string){
 const incoming=readQuickRecords({getItem:()=>raw}),current=readQuickRecords(store);
 for(const kind of ['versions','sessions'] as const){for(const row of incoming[kind]){const existing=current[kind].find(v=>v.id===row.id);if(existing&&JSON.stringify(existing)!==JSON.stringify(row))throw Error('Conflicto de identificadores: no se modificó ningún dato.');if(!existing){if(kind==='versions')current.versions.push(row as RecipeVersion);else current.sessions.push(row as QuickSession);}}}
 validate(current);store.setItem(QUICK_RECORDS_KEY,JSON.stringify(current));return current;
}

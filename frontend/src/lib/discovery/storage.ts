import type { ExperimentStorage } from '../experiments/storage';
import { assert, same, validatePlan, nextAssignment, type ProtocolDiscoveryPlanV1, type DiscoveryExperimentV1 } from './model';
export const DISCOVERY_KEY='fh:protocol-discovery-plans-v1';
export type DiscoveryLock=<T>(operation:()=>Promise<T>)=>Promise<T>;
const lock:DiscoveryLock=async operation=>{if(typeof navigator==='undefined'||!navigator.locks)throw new Error('No hay bloqueo seguro. Exporta sin guardar.');return navigator.locks.request(DISCOVERY_KEY,operation);};
async function parse(raw:string|null){
  if(raw===null)return [];
  try{const values=JSON.parse(raw);assert(Array.isArray(values),'No es una lista.');const rows=await Promise.all(values.map(validatePlan));assert(new Set(rows.map(p=>p.id)).size===rows.length,'IDs repetidos.');return rows;}
  catch{throw new Error('Almacenamiento Discovery inválido; no se sobrescribe ni repara. Exporta el original.');}
}
export type DiscoveryAction={kind:'activate'|'skip'|'interrupt'|'cancel'}|{kind:'reserve';attemptId:string}|{kind:'save';result:DiscoveryExperimentV1};
export class DiscoveryStore {
  constructor(private storage:ExperimentStorage,private locked:DiscoveryLock=lock){}
  load(){return parse(this.storage.getItem(DISCOVERY_KEY));}
  async create(value:unknown){const plan=await validatePlan(value);assert(plan.status==='draft','Solo se crea un plan nuevo en borrador.');return this.write(async rows=>{assert(!rows.some(p=>p.id===plan.id),'Ese ID ya existe; no se reemplaza.');return [plan,...rows];});}
  async act(expected:ProtocolDiscoveryPlanV1,action:DiscoveryAction,at=new Date().toISOString()){
    return this.write(async rows=>{
      const index=rows.findIndex(p=>p.id===expected.id);assert(index>=0&&same(rows[index],expected),'El plan cambió. Recarga y vuelve a revisar.');
      const p=structuredClone(rows[index]);const a=nextAssignment(p);
      if(action.kind==='activate'){assert(p.status==='draft','Ya activado.');p.status='active';}
      else {
        assert(p.status==='active','El plan no está activo.');assert(a,'Sin asignaciones pendientes.');
        if(action.kind==='cancel'){assert(a.status!=='reserved','Resuelve primero la asignación reservada.');p.status='cancelled';}
        if(action.kind==='skip'){assert(a.status==='pending','Ya reservada.');a.status='skipped';a.resolvedAt=at;}
        if(action.kind==='reserve'){assert(a.status==='pending','Ya reservada.');a.status='reserved';a.attemptId=action.attemptId;a.reservedAt=at;}
        if(action.kind==='interrupt'){assert(a.status==='reserved','No hay reserva.');a.status='interrupted';a.resolvedAt=at;}
        if(action.kind==='save'){assert(a.status==='reserved'&&action.result.experiment.id===a.attemptId,'Reserva distinta.');a.result=structuredClone(action.result);a.status=action.result.experiment.status==='prepared'?'interrupted':action.result.experiment.status as 'completed'|'cancelled'|'interrupted';a.resolvedAt=at;}
        if(p.status==='active'&&!nextAssignment(p))p.status='completed';
      }
      const checked=await validatePlan(p);return rows.map((row,i)=>i===index?checked:row);
    });
  }
  private write(operation:(rows:ProtocolDiscoveryPlanV1[])=>Promise<ProtocolDiscoveryPlanV1[]>){return this.locked(async()=>{
    const raw=this.storage.getItem(DISCOVERY_KEY);const rows=await parse(raw);const next=await operation(rows);
    assert(this.storage.getItem(DISCOVERY_KEY)===raw,'Los datos cambiaron durante la validación. Reintenta sin sobrescribir.');
    this.storage.setItem(DISCOVERY_KEY,JSON.stringify(next));return next;
  });}
}

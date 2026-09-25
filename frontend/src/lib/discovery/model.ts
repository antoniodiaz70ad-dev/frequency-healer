import { buildProposal } from '../voice/rules';
import { recommendGuided, type GuidedInterpretationV1 } from '../guided/recommendations';
import { protocolRationale, type ProtocolRationaleV1 } from '../guided/rationale';
import { buildSchedule, type HarmonicConfig } from '../harmonic/math';
import { planConstellationPlayback } from '../harmonic/constellationPlayback';
import type { HarmonicConstellationV1 } from '../harmonic/constellations';
import { validateExperimentV2, type ExperimentRecordV2 } from '../experiments/v2';
import { STATE_FIELDS, type ExperimentState } from '../experiments/types';

export type TargetMetric = typeof STATE_FIELDS[number];
export type Strategy = 'balanced' | 'randomized-balanced';
export interface ProtocolCandidateV1 {
  schemaVersion: 1; id: string; label: string;
  type: 'legacy-harmonic-config' | 'harmonic-constellation';
  ruleId?: string; ruleVersion?: string;
  constellation?: HarmonicConstellationV1;
  config: HarmonicConfig;
  rationale: ProtocolRationaleV1;
  metadata: { seedFrequencyHz: number; ratios: string[]; octaveOffsets: number[]; playbackMode: string; memberCount: number; durationSeconds: number; uiVolume: number; evidenceBasis: ['protocol-design','mathematical','exploratory']; seedBasis: 'explicit-user-choice' | 'saved-constellation' };
}
export interface DiscoveryContextV1 { tags?: string[]; device?: string; timeOfDay?: string }
export interface DiscoveryExperimentV1 {
  schemaVersion: 1; planId: string; candidateId: string; assignmentIndex: number;
  context: DiscoveryContextV1;
  experiment: ExperimentRecordV2;
}
export interface AssignmentV1 {
  index: number; candidateId: string; status: 'pending' | 'reserved' | 'skipped' | 'completed' | 'cancelled' | 'interrupted';
  attemptId?: string; reservedAt?: string; resolvedAt?: string; result?: DiscoveryExperimentV1;
}
export interface ProtocolDiscoveryPlanV1 {
  schemaVersion: 1; id: string; createdAt: string; intent: GuidedInterpretationV1;
  primaryMetric: TargetMetric; candidates: ProtocolCandidateV1[];
  assignmentStrategy: Strategy; randomSeed: number; minimumSessionsPerCandidate: number;
  comparabilityPolicy: { schemaVersion: 1; durationSeconds: number; uiVolume: number; mode: HarmonicConfig['mode']; contextPolicy: 'exact-recorded-stratum'; scale: 'optional-0-10' };
  assignments: AssignmentV1[];
  status: 'draft' | 'active' | 'completed' | 'cancelled';
}
export function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
export const same = (a: unknown,b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const id = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 200;
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function freeze<T>(value:T):T { if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; }
function keys(value:object, allowed:string[]) { assert(Object.keys(value).every(key=>allowed.includes(key)), 'Campo de descubrimiento desconocido.'); }
export function assignmentOrder(ids: string[], rounds: number, strategy: Strategy, seed: number): string[] {
  assert(ids.length>=2&&ids.length<=3&&new Set(ids).size===ids.length,'Se requieren 2–3 candidatos distintos.');
  assert(Number.isInteger(rounds)&&rounds>=3&&rounds<=10,'Usa 3–10 asignaciones por candidato.');
  assert(['balanced','randomized-balanced'].includes(strategy)&&Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff,'Estrategia o semilla aleatoria inválida.');
  let state=seed>>>0;
  const random=()=>{state=(state+0x6D2B79F5)>>>0;let n=state;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
  return Array.from({length:rounds},()=>{const block=[...ids];if(strategy==='randomized-balanced')for(let i=block.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[block[i],block[j]]=[block[j],block[i]];}return block;}).flat();
}
export async function candidate(intent:GuidedInterpretationV1, candidateId:string, label:string, config:HarmonicConfig, constellation?:HarmonicConstellationV1):Promise<ProtocolCandidateV1> {
  assert(id(candidateId)&&id(label),'ID o etiqueta inválida.');recommendGuided(intent);
  let exact: HarmonicConfig;let rationale:ProtocolRationaleV1;let ruleId:string|undefined;let ruleVersion:string|undefined;
  let snapshot:HarmonicConstellationV1|undefined;
  if(constellation){const plan=await planConstellationPlayback(constellation,config);assert(plan.config.mode===config.mode,'La constelación no usa el modo controlado.');exact=plan.config;snapshot=plan.constellation;
    rationale={schemaVersion:1,purpose:'Comparar una arquitectura guardada elegida explícitamente, sin presuponer un efecto.',components:[{componentType:'constellation',value:snapshot.signature,role:'Definición exacta del candidato',basis:'mathematical',explanation:'Se conserva cada miembro, su orden y multiplicidad. Se reproduce el snapshot del plan, no una fuente que pueda cambiar.'},{componentType:'mode',value:exact.mode,role:'Organización temporal',basis:'acoustic',explanation:'Secuencia separa tonos; simultáneo los presenta juntos.'},{componentType:'duration',value:`${exact.durationSeconds} s`,role:'Tiempo controlado',basis:'protocol-design',explanation:'Misma duración para todos los candidatos.'},{componentType:'volume',value:`${exact.uiVolume}/100`,role:'Nivel controlado',basis:'protocol-design',explanation:'Mismo control de volumen; no mide decibelios. Usa un nivel cómodo.'}],limitations:['Diseño exploratorio; no establece eficacia ni causalidad.']};
  }else{const p=buildProposal(intent.intent,{baseHz:config.baseHz,mode:config.mode,uiVolume:config.uiVolume});exact=p.harmonicConfig;ruleId=p.ruleId;ruleVersion=p.ruleVersion;rationale=protocolRationale(p);}
  const schedule=buildSchedule(exact);
  return freeze({schemaVersion:1,id:candidateId,label,type:snapshot?'harmonic-constellation':'legacy-harmonic-config',...(snapshot?{constellation:snapshot}:{ruleId,ruleVersion}),config:structuredClone(exact),rationale,metadata:{seedFrequencyHz:exact.baseHz,ratios:schedule.steps.flatMap(s=>s.ratios),octaveOffsets:snapshot?.members.flatMap(m=>m.relationshipType==='octave'?[m.octaveOffset]:[])??[],playbackMode:exact.mode,memberCount:schedule.steps.flatMap(s=>s.frequencies).length,durationSeconds:exact.durationSeconds,uiVolume:exact.uiVolume,evidenceBasis:['protocol-design','mathematical','exploratory'],seedBasis:snapshot?'saved-constellation':'explicit-user-choice'}});
}
export async function validateCandidate(value:ProtocolCandidateV1,intent:GuidedInterpretationV1){
  const rebuilt=await candidate(intent,value.id,value.label,value.config,value.constellation);
  assert(same(value,rebuilt),'Candidato, regla, identidad o configuración alterados.');return rebuilt;
}
export function validateContext(value:DiscoveryContextV1){
  assert(value&&typeof value==='object'&&!Array.isArray(value),'Contexto inválido.');keys(value,['tags','device','timeOfDay']);
  if(value.tags!==undefined)assert(Array.isArray(value.tags)&&value.tags.length<=8&&value.tags.every(v=>typeof v==='string'&&v.length>0&&v.length<=80),'Etiquetas de contexto inválidas.');
  for(const key of ['device','timeOfDay'] as const)if(value[key]!==undefined)assert(typeof value[key]==='string'&&value[key]!.length>0&&value[key]!.length<=200,'Contexto inválido.');
  return value;
}
export async function createPlan(input:Pick<ProtocolDiscoveryPlanV1,'intent'|'primaryMetric'|'candidates'|'assignmentStrategy'|'randomSeed'|'minimumSessionsPerCandidate'>,planId=crypto.randomUUID(),createdAt=new Date().toISOString()){
  const config=input.candidates[0]?.config;assert(config,'Sin candidatos.');
  return validatePlan({...input,schemaVersion:1,id:planId,createdAt,status:'draft',comparabilityPolicy:{schemaVersion:1,durationSeconds:config.durationSeconds,uiVolume:config.uiVolume,mode:config.mode,contextPolicy:'exact-recorded-stratum',scale:'optional-0-10'},assignments:assignmentOrder(input.candidates.map(c=>c.id),input.minimumSessionsPerCandidate,input.assignmentStrategy,input.randomSeed).map((candidateId,index)=>({index,candidateId,status:'pending'}))});
}
export async function validatePlan(input:unknown):Promise<ProtocolDiscoveryPlanV1>{
  const p=structuredClone(input) as ProtocolDiscoveryPlanV1;
  assert(p&&typeof p==='object'&&!Array.isArray(p),'Plan inválido.');
  keys(p,['schemaVersion','id','createdAt','intent','primaryMetric','candidates','assignmentStrategy','randomSeed','minimumSessionsPerCandidate','comparabilityPolicy','assignments','status']);
  assert(p.schemaVersion===1&&id(p.id)&&date(p.createdAt)&&STATE_FIELDS.includes(p.primaryMetric)&&['draft','active','completed','cancelled'].includes(p.status),'Contrato de plan inválido.');
  recommendGuided(p.intent);assert(Array.isArray(p.candidates)&&p.candidates.length>=2&&p.candidates.length<=3,'Se requieren 2–3 candidatos.');
  p.candidates=await Promise.all(p.candidates.map(c=>validateCandidate(c,p.intent)));
  const acoustic=p.candidates.map(c=>JSON.stringify([buildSchedule(c.config),c.config.uiVolume,c.config.waveform]));assert(new Set(acoustic).size===acoustic.length,'No compares candidatos acústicamente idénticos.');
  const first=p.candidates[0].config;
  assert(same(p.comparabilityPolicy,{schemaVersion:1,durationSeconds:first.durationSeconds,uiVolume:first.uiVolume,mode:first.mode,contextPolicy:'exact-recorded-stratum',scale:'optional-0-10'}),'Política de comparación inválida.');
  assert(p.candidates.every(c=>c.config.durationSeconds===first.durationSeconds&&c.config.uiVolume===first.uiVolume&&c.config.mode===first.mode),'Duración, volumen y modo deben ser iguales.');
  const order=assignmentOrder(p.candidates.map(c=>c.id),p.minimumSessionsPerCandidate,p.assignmentStrategy,p.randomSeed);
  assert(Array.isArray(p.assignments)&&p.assignments.length===order.length,'Asignaciones inválidas.');
  let unresolved=false;const attempts=new Set<string>();const experiments=new Set<string>();
  for(let i=0;i<order.length;i++){
    const a=p.assignments[i];keys(a,['index','candidateId','status','attemptId','reservedAt','resolvedAt','result']);
    assert(a.index===i&&a.candidateId===order[i]&&['pending','reserved','skipped','completed','cancelled','interrupted'].includes(a.status),'Orden o asignación alterados.');
    if(unresolved)assert(a.status==='pending','No se salta una asignación pendiente.');
    if(a.status==='pending'||a.status==='reserved')unresolved=true;
    if(a.status==='pending')assert(a.attemptId===undefined&&a.reservedAt===undefined&&a.resolvedAt===undefined&&a.result===undefined,'Pendiente con datos ejecutados.');
    else if(a.status==='skipped')assert(date(a.resolvedAt)&&a.attemptId===undefined&&a.reservedAt===undefined&&a.result===undefined,'Omisión inválida.');
    else {
      assert(id(a.attemptId)&&date(a.reservedAt)&&!attempts.has(a.attemptId!),'Reserva inválida.');attempts.add(a.attemptId!);
      if(a.status==='reserved')assert(a.result===undefined&&a.resolvedAt===undefined,'Reserva ya resuelta.');
      else assert(date(a.resolvedAt)&&Date.parse(a.resolvedAt!)>=Date.parse(a.reservedAt!),'Cierre inválido.');
      if(a.result){const r=a.result;keys(r,['schemaVersion','planId','candidateId','assignmentIndex','context','experiment']);assert(r.schemaVersion===1&&r.planId===p.id&&r.candidateId===a.candidateId&&r.assignmentIndex===i,'Vínculo de ejecución inválido.');validateContext(r.context);
        const e=await validateExperimentV2(r.experiment),c=p.candidates.find(c=>c.id===a.candidateId)!;
        assert(e.id===a.attemptId&&!experiments.has(e.id),'Experimento duplicado.');experiments.add(e.id);
        assert(same(e.configurationSnapshot,c.config)&&same(e.constellation?.snapshot,c.constellation),'Snapshot distinto al candidato.');
        assert(e.intention===p.intent.intent.intention&&e.expectationScore!==undefined,'Intención/expectativa no registradas.');
        assert(a.status===(e.status==='prepared'?'interrupted':e.status)&&e.status!=='started','Estado terminal incoherente.');
        r.experiment=e;
      }else if(a.status!=='reserved')assert(a.status==='interrupted','Falta resultado explícito.');
    }
  }
  if(p.status==='draft')assert(p.assignments.every(a=>a.status==='pending'),'Borrador ejecutado.');
  if(p.status==='completed')assert(!unresolved,'Plan completado con asignaciones pendientes.');
  if(p.status==='active')assert(unresolved,'Plan activo sin asignaciones pendientes.');
  return freeze(p);
}
export const nextAssignment=(p:ProtocolDiscoveryPlanV1)=>p.assignments.find(a=>a.status==='pending'||a.status==='reserved');
export function stateInput(values:Record<string,string>):ExperimentState { return Object.fromEntries(Object.entries(values).filter(([,v])=>v!=='').map(([k,v])=>[k,Number(v)])); }

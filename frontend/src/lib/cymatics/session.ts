export const GUIDED_CYMATICS_STEPS = [
  { id:'preparation', name:'Preparación', durationSeconds:60 },
  { id:'anchor', name:'Anclaje', durationSeconds:120 },
  { id:'sweep', name:'Barrido', durationSeconds:180 },
  { id:'stillness', name:'Quietud', durationSeconds:120 },
  { id:'record', name:'Registro', durationSeconds:60 },
  { id:'close', name:'Cierre', durationSeconds:60 },
] as const;

export type GuidedCymaticsStatus='idle'|'running'|'paused'|'complete';
export interface GuidedCymaticsSession {sessionId:string;status:GuidedCymaticsStatus;stepIndex:number;elapsedInStep:number;}

export function idleGuidedCymaticsSession():GuidedCymaticsSession{return {sessionId:'',status:'idle',stepIndex:0,elapsedInStep:0};}
export function startGuidedCymaticsSession(sessionId:string):GuidedCymaticsSession{if(!sessionId)throw new Error('La sesión requiere identidad.');return {sessionId,status:'running',stepIndex:0,elapsedInStep:0};}
export function pauseGuidedCymaticsSession(state:GuidedCymaticsSession):GuidedCymaticsSession{return state.status==='running'?{...state,status:'paused'}:state;}
export function resumeGuidedCymaticsSession(state:GuidedCymaticsSession):GuidedCymaticsSession{return state.status==='paused'?{...state,status:'running'}:state;}
export function endGuidedCymaticsSession(state:GuidedCymaticsSession):GuidedCymaticsSession{return state.status==='idle'?state:{...state,status:'complete',stepIndex:GUIDED_CYMATICS_STEPS.length-1,elapsedInStep:GUIDED_CYMATICS_STEPS.at(-1)!.durationSeconds};}
export function skipGuidedCymaticsStep(state:GuidedCymaticsSession):GuidedCymaticsSession{if(state.status!=='running'&&state.status!=='paused')return state;if(state.stepIndex>=GUIDED_CYMATICS_STEPS.length-1)return endGuidedCymaticsSession(state);return {...state,status:'running',stepIndex:state.stepIndex+1,elapsedInStep:0};}
export function advanceGuidedCymaticsSession(state:GuidedCymaticsSession,seconds:number):GuidedCymaticsSession{if(state.status!=='running'||!Number.isFinite(seconds)||seconds<=0)return state;let next={...state},remaining=seconds;while(remaining>0&&next.status==='running'){const duration=GUIDED_CYMATICS_STEPS[next.stepIndex].durationSeconds,available=duration-next.elapsedInStep;if(remaining<available){next.elapsedInStep+=remaining;remaining=0;}else{remaining-=available;if(next.stepIndex===GUIDED_CYMATICS_STEPS.length-1)next=endGuidedCymaticsSession(next);else next={...next,stepIndex:next.stepIndex+1,elapsedInStep:0};}}return next;}
export function guidedRemainingSeconds(state:GuidedCymaticsSession){return Math.max(0,GUIDED_CYMATICS_STEPS[state.stepIndex].durationSeconds-state.elapsedInStep);}

/// <reference lib="webworker" />
import {stepParticles,type CymaticsParticle} from './particles';
import type {ModalField,SurfaceType} from './types';

/**
 * Persistent sand worker. It is created once per interactive canvas and receives
 * only deltas: a new field when frequency/excitation changes, a full replacement
 * on scatter, or new grains on pour. Grains are never reset by a field change.
 */
export type SandWorkerMessage=
  |{type:'init';particles:CymaticsParticle[];field:ModalField;surface:SurfaceType;force:number;stepSeconds:number}
  |{type:'field';field:ModalField;surface:SurfaceType;force:number}
  |{type:'replace';particles:CymaticsParticle[]}
  |{type:'pour';grains:CymaticsParticle[];cap:number}
  |{type:'stop'};
export interface SandWorkerFrame{positions:Float32Array;count:number;generation:number;}

const scope=self as DedicatedWorkerGlobalScope;
let particles:CymaticsParticle[]=[],field:ModalField|null=null,surface:SurfaceType='square-plate',force=1,stepSeconds=.1,timer:number|null=null,generation=0;

function publish(){const positions=new Float32Array(particles.length*2);for(let i=0;i<particles.length;i++){positions[i*2]=particles[i].x;positions[i*2+1]=particles[i].y;}scope.postMessage({positions,count:particles.length,generation} satisfies SandWorkerFrame,[positions.buffer]);}
function tick(){if(!field)return;stepParticles(particles,field,surface,stepSeconds,{force});publish();}

scope.onmessage=(event:MessageEvent<SandWorkerMessage>)=>{
  const message=event.data;
  if(message.type==='stop'){if(timer!==null)clearInterval(timer);scope.close();return;}
  if(message.type==='init'){particles=message.particles;field=message.field;surface=message.surface;force=message.force;stepSeconds=message.stepSeconds;if(timer!==null)clearInterval(timer);timer=setInterval(tick,stepSeconds*1000) as unknown as number;publish();return;}
  if(message.type==='field'){field=message.field;surface=message.surface;force=message.force;return;}
  if(message.type==='replace'){particles=message.particles;generation++;publish();return;}
  if(message.type==='pour'){const overflow=particles.length+message.grains.length-message.cap;if(overflow>0)particles.splice(0,overflow);particles.push(...message.grains);generation++;publish();}
};

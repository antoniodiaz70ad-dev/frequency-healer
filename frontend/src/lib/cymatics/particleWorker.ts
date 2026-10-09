/// <reference lib="webworker" />
import {stepParticles,type CymaticsParticle} from './particles';
import type {ModalField,SurfaceType} from './types';

type Init={particles:CymaticsParticle[];field:ModalField;surface:SurfaceType;force:number};
const scope=self as DedicatedWorkerGlobalScope;let state:Init|null=null,timer:number|null=null;
scope.onmessage=(event:MessageEvent<Init|{type:'stop'}>)=>{if('type' in event.data){if(timer!==null)clearInterval(timer);scope.close();return;}state=event.data;if(timer!==null)clearInterval(timer);timer=setInterval(()=>{if(!state)return;stepParticles(state.particles,state.field,state.surface,.1,{force:state.force});const positions=new Float32Array(state.particles.length*2);for(let i=0;i<state.particles.length;i++){positions[i*2]=state.particles[i].x;positions[i*2+1]=state.particles[i].y;}scope.postMessage(positions,[positions.buffer]);},100) as unknown as number;};

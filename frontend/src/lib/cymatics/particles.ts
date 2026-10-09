import type { ModalField, SurfaceType } from './types';

export interface CymaticsParticle { x:number; y:number; vx:number; vy:number; flight:number; rngState:number; tone:number; size:number; }
export interface ParticleStepOptions { attraction?:number; damping?:number; maxSpeed?:number; boundaryMargin?:number; force?:number; threshold?:number; kickScale?:number; }

export function rng(seed:number){let state=seed>>>0;return()=>((state=Math.imul(1664525,state)+1013904223>>>0)/4294967296);}
const nextRandom=(particle:CymaticsParticle)=>{particle.rngState=(Math.imul(1664525,particle.rngState)+1013904223)>>>0;return particle.rngState/4294967296;};
function isInside(x:number,y:number,surface:SurfaceType,margin=.025){return surface==='square-plate'?x>=margin&&x<=1-margin&&y>=margin&&y<=1-margin:Math.hypot(x-.5,y-.5)<=.5-margin;}

export function createParticles(seed:number,count:number,surface:SurfaceType):CymaticsParticle[]{
  const random=rng(seed),particles:CymaticsParticle[]=[];
  while(particles.length<count){const x=random(),y=random();if(isInside(x,y,surface,.035))particles.push({x,y,vx:0,vy:0,flight:0,rngState:(random()*0xffffffff)>>>0,tone:random(),size:.72+random()*.56});}
  return particles;
}

export function sampleField(field:ModalField,x:number,y:number):number {
  const s=field.size,px=Math.max(0,Math.min(s-1,x*s-.5)),py=Math.max(0,Math.min(s-1,y*s-.5)),x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(s-1,x0+1),y1=Math.min(s-1,y0+1),tx=px-x0,ty=py-y0;
  const a=field.values[y0*s+x0]*(1-tx)+field.values[y0*s+x1]*tx,b=field.values[y1*s+x0]*(1-tx)+field.values[y1*s+x1]*tx;
  return (a*(1-ty)+b*ty)/Math.max(field.maxAmplitude,1e-20);
}
function potential(field:ModalField,x:number,y:number){const amplitude=sampleField(field,x,y);return amplitude*amplitude;}
function constrain(p:CymaticsParticle,surface:SurfaceType,margin:number){
  if(surface==='square-plate'){
    if(p.x<margin||p.x>1-margin){p.x=Math.max(margin,Math.min(1-margin,p.x));p.vx*=-.18;}
    if(p.y<margin||p.y>1-margin){p.y=Math.max(margin,Math.min(1-margin,p.y));p.vy*=-.18;}
  }else{const dx=p.x-.5,dy=p.y-.5,r=Math.hypot(dx,dy),limit=.5-margin;if(r>limit){p.x=.5+dx/r*limit;p.y=.5+dy/r*limit;const radial=p.vx*dx/r+p.vy*dy/r;p.vx-=1.15*radial*dx/r;p.vy-=1.15*radial*dy/r;}}
}

/** Legacy smooth gradient descent retained for historical tests and comparisons. */
export function stepParticlesLegacy(particles:CymaticsParticle[],field:ModalField,surface:SurfaceType,dt:number,options:ParticleStepOptions={}):void {
  const attraction=options.attraction??2.8,damping=options.damping??3.8,maxSpeed=options.maxSpeed??.32,margin=options.boundaryMargin??.035,epsilon=Math.max(.004,1/field.size),decay=Math.exp(-damping*dt);
  for(const p of particles){const gx=(potential(field,p.x+epsilon,p.y)-potential(field,p.x-epsilon,p.y))/(2*epsilon),gy=(potential(field,p.x,p.y+epsilon)-potential(field,p.x,p.y-epsilon))/(2*epsilon);p.vx=(p.vx-attraction*gx*dt)*decay;p.vy=(p.vy-attraction*gy*dt)*decay;const speed=Math.hypot(p.vx,p.vy);if(speed>maxSpeed){p.vx*=maxSpeed/speed;p.vy*=maxSpeed/speed;}p.x+=p.vx*dt;p.y+=p.vy*dt;constrain(p,surface,margin);}
}

/** Stochastic kick model: grains freeze below threshold and hop at antinodes. */
export function stepParticles(particles:CymaticsParticle[],field:ModalField,surface:SurfaceType,dt:number,options:ParticleStepOptions={}):void {
  const force=options.force??1,threshold=options.threshold??.075,kickScale=options.kickScale??.19,margin=options.boundaryMargin??.035,epsilon=Math.max(.004,1/field.size),friction=Math.exp(-(options.damping??13)*dt),maxSpeed=options.maxSpeed??.85;
  for(const p of particles){
    const acceleration=sampleField(field,p.x,p.y)*force;
    if(p.flight<=0&&acceleration>=threshold){
      const excess=Math.min(1.5,acceleration-threshold),angle=nextRandom(p)*Math.PI*2,jump=kickScale*excess*(.65+.7*nextRandom(p));
      const gx=(potential(field,p.x+epsilon,p.y)-potential(field,p.x-epsilon,p.y))/(2*epsilon),gy=(potential(field,p.x,p.y+epsilon)-potential(field,p.x,p.y-epsilon))/(2*epsilon),g=Math.hypot(gx,gy)||1;
      p.vx=Math.cos(angle)*jump-gx/g*jump*.1;p.vy=Math.sin(angle)*jump-gy/g*jump*.1;p.flight=1+Math.floor(nextRandom(p)*3);
    }
    if(p.flight>0){p.x+=p.vx*dt*7.5;p.y+=p.vy*dt*7.5;p.flight--;if(p.flight===0){p.vx*=.22;p.vy*=.22;}}
    else if(acceleration>=threshold){p.vx*=friction;p.vy*=friction;p.x+=p.vx*dt;p.y+=p.vy*dt;}
    else {p.vx=0;p.vy=0;}
    const speed=Math.hypot(p.vx,p.vy);if(speed>maxSpeed){p.vx*=maxSpeed/speed;p.vy*=maxSpeed/speed;}constrain(p,surface,margin);
  }
}

export function meanParticlePotential(particles:CymaticsParticle[],field:ModalField){return particles.reduce((sum,p)=>sum+potential(field,p.x,p.y),0)/Math.max(1,particles.length);}
export function particleOrganization(particles:CymaticsParticle[],field:ModalField,limit=.14){return particles.reduce((sum,p)=>sum+(sampleField(field,p.x,p.y)<=limit?1:0),0)/Math.max(1,particles.length);}
export function particlesInBounds(particles:CymaticsParticle[],surface:SurfaceType){return particles.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.vx)&&Number.isFinite(p.vy)&&isInside(p.x,p.y,surface,.02));}

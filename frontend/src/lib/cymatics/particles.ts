import type { ModalField, SurfaceType } from './types';

export interface CymaticsParticle { x:number; y:number; vx:number; vy:number; }

export interface ParticleStepOptions {
  attraction?:number;
  damping?:number;
  maxSpeed?:number;
  boundaryMargin?:number;
}

function rng(seed:number){let state=seed>>>0;return()=>((state=Math.imul(1664525,state)+1013904223>>>0)/4294967296);}

function isInside(x:number,y:number,surface:SurfaceType,margin=.025){
  if(surface==='square-plate')return x>=margin&&x<=1-margin&&y>=margin&&y<=1-margin;
  return Math.hypot(x-.5,y-.5)<=.5-margin;
}

export function createParticles(seed:number,count:number,surface:SurfaceType):CymaticsParticle[]{
  const random=rng(seed),particles:CymaticsParticle[]=[];
  while(particles.length<count){const x=random(),y=random();if(isInside(x,y,surface,.035))particles.push({x,y,vx:0,vy:0});}
  return particles;
}

export function sampleField(field:ModalField,x:number,y:number):number {
  const s=field.size,px=Math.max(0,Math.min(s-1,x*s-.5)),py=Math.max(0,Math.min(s-1,y*s-.5));
  const x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(s-1,x0+1),y1=Math.min(s-1,y0+1),tx=px-x0,ty=py-y0;
  const a=field.values[y0*s+x0]*(1-tx)+field.values[y0*s+x1]*tx;
  const b=field.values[y1*s+x0]*(1-tx)+field.values[y1*s+x1]*tx;
  return (a*(1-ty)+b*ty)/Math.max(field.maxAmplitude,1e-20);
}

function potential(field:ModalField,x:number,y:number){const amplitude=sampleField(field,x,y);return amplitude*amplitude;}

export function stepParticles(particles:CymaticsParticle[],field:ModalField,surface:SurfaceType,dt:number,options:ParticleStepOptions={}):void {
  const attraction=options.attraction??2.8,damping=options.damping??3.8,maxSpeed=options.maxSpeed??.32,margin=options.boundaryMargin??.035,epsilon=Math.max(.004,1/field.size);
  const decay=Math.exp(-damping*dt);
  for(const particle of particles){
    const gx=(potential(field,particle.x+epsilon,particle.y)-potential(field,particle.x-epsilon,particle.y))/(2*epsilon);
    const gy=(potential(field,particle.x,particle.y+epsilon)-potential(field,particle.x,particle.y-epsilon))/(2*epsilon);
    let ax=-attraction*gx,ay=-attraction*gy;
    if(surface==='square-plate'){
      const repel=.09;
      if(particle.x<repel)ax+=attraction*(repel-particle.x)/repel;
      if(particle.x>1-repel)ax-=attraction*(particle.x-(1-repel))/repel;
      if(particle.y<repel)ay+=attraction*(repel-particle.y)/repel;
      if(particle.y>1-repel)ay-=attraction*(particle.y-(1-repel))/repel;
    }else{
      const dx=particle.x-.5,dy=particle.y-.5,r=Math.hypot(dx,dy),repelStart=.41;
      if(r>repelStart&&r>0){const force=attraction*(r-repelStart)/(.5-repelStart);ax-=force*dx/r;ay-=force*dy/r;}
    }
    particle.vx=(particle.vx+ax*dt)*decay;particle.vy=(particle.vy+ay*dt)*decay;
    const speed=Math.hypot(particle.vx,particle.vy);if(speed>maxSpeed){particle.vx*=maxSpeed/speed;particle.vy*=maxSpeed/speed;}
    particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;
    if(surface==='square-plate'){
      if(particle.x<margin||particle.x>1-margin){particle.x=Math.max(margin,Math.min(1-margin,particle.x));particle.vx*=-.2;}
      if(particle.y<margin||particle.y>1-margin){particle.y=Math.max(margin,Math.min(1-margin,particle.y));particle.vy*=-.2;}
    }else{
      const dx=particle.x-.5,dy=particle.y-.5,r=Math.hypot(dx,dy),limit=.5-margin;
      if(r>limit){particle.x=.5+dx/r*limit;particle.y=.5+dy/r*limit;const radial=particle.vx*dx/r+particle.vy*dy/r;particle.vx-=1.2*radial*dx/r;particle.vy-=1.2*radial*dy/r;}
    }
  }
}

export function meanParticlePotential(particles:CymaticsParticle[],field:ModalField){return particles.reduce((sum,p)=>sum+potential(field,p.x,p.y),0)/Math.max(1,particles.length);}

export function particlesInBounds(particles:CymaticsParticle[],surface:SurfaceType){return particles.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.vx)&&Number.isFinite(p.vy)&&isInside(p.x,p.y,surface,.02));}

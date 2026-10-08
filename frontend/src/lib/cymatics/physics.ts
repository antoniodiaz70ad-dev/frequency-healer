import type { CymaticsConfigV1, ModalField, SurfaceType } from './types';

export const CYMATICS_MODEL_VERSION = 'cymatics-modal-v1' as const;
export const AUDIO_MIN_HZ = 0.1;
export const AUDIO_MAX_HZ = 2000;

// Positive zeros j_mn from NIST DLMF §10.21, rounded to 9 decimals.
export const BESSEL_ROOTS: Readonly<Record<number, readonly number[]>> = {
  0: [2.404825558, 5.520078110, 8.653727913, 11.791534439, 14.930917708],
  1: [3.831705970, 7.015586670, 10.173468136, 13.323691936, 16.470630051],
  2: [5.135622302, 8.417244140, 11.619841173, 14.795951782, 17.959819495],
  3: [6.380161896, 9.761023130, 13.015200722, 16.223466160, 19.409415226],
  4: [7.588342435, 11.064709489, 14.372536672, 17.615966050, 20.826932957],
};

export interface Mode { frequencyHz: number; shape(x: number, y: number): number; coupling: number; modalMass: number; modeId: string; modeLabel: string; }

export interface ResonanceExample {
  id: string;
  title: string;
  description: string;
  config: CymaticsConfigV1;
  frequencyHz: number;
  modeId: string;
  modeLabel: string;
}

export function squarePlateFrequencyHz(m:number,n:number,c:CymaticsConfigV1):number {
  const {youngModulusPa:E,poissonRatio:nu,densityKgM3:rho}=c.materialSI;
  const {widthM:a,heightM:b,thicknessM:h}=c.dimensionsSI;
  const D=E*h**3/(12*(1-nu**2));
  return Math.PI/2*Math.sqrt(D/(rho*h))*((m/a)**2+(n/b)**2);
}

export function membraneFrequencyHz(m:number,n:number,c:CymaticsConfigV1):number {
  const root=BESSEL_ROOTS[m]?.[n-1]; if(!root) throw new Error('Modo de membrana fuera de la tabla verificada.');
  return root/(2*Math.PI*c.dimensionsSI.radiusM)*Math.sqrt(c.materialSI.tensionNm/c.materialSI.surfaceDensityKgM2);
}

// Stable series for the small integer orders and arguments used by the model.
export function besselJ(order:number,x:number):number {
  let sum=0, factorialM=1, factorialMO=1;
  for(let k=0;k<36;k++) {
    if(k>0){factorialM*=k;factorialMO*=k+order;}
    else for(let i=2;i<=order;i++)factorialMO*=i;
    const term=(k%2?-1:1)*(x/2)**(2*k+order)/(factorialM*factorialMO);
    sum+=term;if(Math.abs(term)<1e-13)break;
  }
  return sum;
}

export function buildModes(c:CymaticsConfigV1):Mode[] {
  const modes:Mode[]=[]; const ex=c.excitationPosition;
  if(c.surfaceType==='square-plate') {
    for(let m=1;m<=c.modeCutoff;m++)for(let n=1;n<=c.modeCutoff;n++){
      const shape=(x:number,y:number)=>Math.sin(m*Math.PI*x)*Math.sin(n*Math.PI*y);
      modes.push({frequencyHz:squarePlateFrequencyHz(m,n,c),shape,coupling:shape(ex.x,ex.y),modalMass:c.materialSI.densityKgM3*c.dimensionsSI.thicknessM*c.dimensionsSI.widthM*c.dimensionsSI.heightM/4,modeId:`plate-${m}-${n}`,modeLabel:`Placa (${m}, ${n})`});
    }
  } else {
    for(let m=0;m<=Math.min(4,c.modeCutoff-1);m++)for(let n=1;n<=Math.min(5,c.modeCutoff);n++){
      const root=BESSEL_ROOTS[m][n-1];
      for(const orientation of (m===0?[0]:[0,Math.PI/2])){
        const shape=(x:number,y:number)=>{const dx=2*x-1,dy=2*y-1,r=Math.hypot(dx,dy);if(r>1)return 0;const theta=Math.atan2(dy,dx);return besselJ(m,root*r)*Math.cos(m*theta-orientation);};
        const orientationLabel=orientation===0?'cos':'sen';
        modes.push({frequencyHz:membraneFrequencyHz(m,n,c),shape,coupling:shape(ex.x,ex.y),modalMass:c.materialSI.surfaceDensityKgM2*Math.PI*c.dimensionsSI.radiusM**2/2,modeId:`membrane-${m}-${n}-${orientationLabel}`,modeLabel:`Membrana (${m}, ${n}) · ${orientationLabel}`});
      }
    }
  }
  return modes.sort((a,b)=>a.frequencyHz-b.frequencyHz);
}

export function nearestMode(c:CymaticsConfigV1,frequencyHz:number):Mode {
  const modes=buildModes(c);
  if(!modes.length)throw new Error('No hay modos calculados para esta superficie.');
  return modes.reduce((best,mode)=>Math.abs(mode.frequencyHz-frequencyHz)<Math.abs(best.frequencyHz-frequencyHz)?mode:best);
}

function exampleConfig(surfaceType:CymaticsConfigV1['surfaceType'],modeId:string,excitation:{x:number;y:number},seed:number):ResonanceExample {
  const config=defaultCymaticsConfig();
  config.surfaceType=surfaceType;
  config.boundaryCondition=surfaceType==='square-plate'?'simply-supported':'fixed-edge';
  config.excitationPosition=excitation;
  config.damping=.012;
  config.particleSeed=seed;
  config.view='particles';
  const mode=buildModes(config).find(candidate=>candidate.modeId===modeId);
  if(!mode||Math.abs(mode.coupling)<.08)throw new Error(`El ejemplo ${modeId} no tiene acoplamiento suficiente.`);
  config.channelFrequenciesHz=[mode.frequencyHz];
  config.modeledComponents=[mode.frequencyHz];
  const definitions:Record<string,[string,string]>={
    'plate-2-2':['Cuatro regiones interiores','Placa cuadrada con dos divisiones en cada eje.'],
    'membrane-0-2-cos':['Anillo concéntrico','Membrana circular con una región nodal interior.'],
    'membrane-3-1-cos':['Seis sectores','Membrana circular con estructura angular interior.'],
  };
  const [title,description]=definitions[modeId]??[mode.modeLabel,'Modo propio calculado.'];
  config.title=title;
  return {id:modeId,title,description,config,frequencyHz:mode.frequencyHz,modeId,modeLabel:mode.modeLabel};
}

export function buildResonanceExamples():ResonanceExample[] {
  return [
    exampleConfig('square-plate','plate-2-2',{x:.31,y:.37},22022),
    exampleConfig('circular-membrane','membrane-0-2-cos',{x:.67,y:.50},22023),
    exampleConfig('circular-membrane','membrane-3-1-cos',{x:.75,y:.55},22024),
  ];
}

export function computeModalField(c:CymaticsConfigV1,frequencyHz:number,size=64):ModalField {
  if(!Number.isFinite(frequencyHz)||frequencyHz<AUDIO_MIN_HZ||frequencyHz>AUDIO_MAX_HZ)throw new Error('Frecuencia fuera del rango de audio admitido (0.1–2000 Hz).');
  const modes=buildModes(c), values=new Float32Array(size*size),realValues=new Float32Array(size*size),imaginaryValues=new Float32Array(size*size),omega=2*Math.PI*frequencyHz,zeta=c.damping;
  let max=0,sumSq=0;const significant=modes.filter(mode=>Math.abs(frequencyHz-mode.frequencyHz)/mode.frequencyHz<Math.max(.02,zeta*3)).length;
  for(let iy=0;iy<size;iy++)for(let ix=0;ix<size;ix++){
    const x=(ix+.5)/size,y=(iy+.5)/size;let re=0,im=0;
    for(const mode of modes){const wj=2*Math.PI*mode.frequencyHz;const a=wj*wj-omega*omega,b=2*zeta*wj*omega,den=a*a+b*b;const force=c.excitationRelativeStrength*mode.coupling/mode.modalMass;const phi=mode.shape(x,y);re+=force*a/den*phi;im-=force*b/den*phi;}
    const index=iy*size+ix,amplitude=Math.hypot(re,im);values[index]=amplitude;realValues[index]=re;imaginaryValues[index]=im;max=Math.max(max,amplitude);sumSq+=amplitude*amplitude;
  }
  const nearest=modes.reduce((best,m)=>Math.abs(m.frequencyHz-frequencyHz)<Math.abs(best-frequencyHz)?m.frequencyHz:best,modes[0]?.frequencyHz??0);
  const min=modes[0]?.frequencyHz??0,maxMode=modes.at(-1)?.frequencyHz??0,rms=Math.sqrt(sumSq/values.length);
  const outside=frequencyHz<min*.75||frequencyHz>maxMode*1.25;
  return {size,values,realValues,imaginaryValues,maxAmplitude:max,rmsAmplitude:rms,nearestResonanceHz:nearest,modeledMinHz:min,modeledMaxHz:maxMode,status:outside?'outside-modeled-range':significant>2?'mixed':Math.abs(nearest-frequencyHz)/Math.max(nearest,1)<.02?'resonant':'weak'};
}

export interface ResponsePoint { frequencyHz:number; rmsAmplitude:number; }
export function computeResponseCurve(c:CymaticsConfigV1,startHz:number,endHz:number,count=81):ResponsePoint[]{
  if(!Number.isFinite(startHz)||!Number.isFinite(endHz)||startHz<AUDIO_MIN_HZ||endHz>AUDIO_MAX_HZ||endHz<=startHz||!Number.isInteger(count)||count<3||count>241)throw new Error('Rango de respuesta inválido.');
  return Array.from({length:count},(_,index)=>{const frequencyHz=startHz+(endHz-startHz)*index/(count-1);return {frequencyHz,rmsAmplitude:computeModalField(c,frequencyHz,24).rmsAmplitude};});
}

export function computeCircularIdealMode(c:CymaticsConfigV1,m:number,n:number,rotationRadians=0,size=96):ModalField{
  if(c.surfaceType!=='circular-membrane'||c.boundaryCondition!=='fixed-edge')throw new Error('El modo ideal requiere una membrana circular con borde fijo.');
  if(!Number.isInteger(m)||m<0||m>4||!Number.isInteger(n)||n<1||n>5||!Number.isFinite(rotationRadians))throw new Error('Índices de modo circular inválidos.');
  const root=BESSEL_ROOTS[m][n-1],frequencyHz=membraneFrequencyHz(m,n,c),values=new Float32Array(size*size),realValues=new Float32Array(size*size),imaginaryValues=new Float32Array(size*size);let max=0,sumSq=0;
  for(let iy=0;iy<size;iy++)for(let ix=0;ix<size;ix++){const x=(ix+.5)/size,y=(iy+.5)/size,dx=2*x-1,dy=2*y-1,r=Math.hypot(dx,dy),index=iy*size+ix;if(r>1)continue;const theta=Math.atan2(dy,dx)-rotationRadians,displacement=besselJ(m,root*r)*(m===0?1:Math.cos(m*theta)),amplitude=Math.abs(displacement);realValues[index]=displacement;values[index]=amplitude;max=Math.max(max,amplitude);sumSq+=amplitude*amplitude;}
  return {size,values,realValues,imaginaryValues,maxAmplitude:max,rmsAmplitude:Math.sqrt(sumSq/values.length),nearestResonanceHz:frequencyHz,modeledMinHz:frequencyHz,modeledMaxHz:frequencyHz,status:'resonant'};
}

export function surfaceLabel(surface:SurfaceType){return surface==='square-plate'?'Placa cuadrada, bordes simplemente apoyados':'Membrana circular, borde fijo';}

export function defaultCymaticsConfig():CymaticsConfigV1 {return {
  schemaVersion:1,modelVersion:CYMATICS_MODEL_VERSION,id:crypto.randomUUID(),createdAt:new Date().toISOString(),title:'Figura sin nombre',surfaceType:'square-plate',boundaryCondition:'simply-supported',
  dimensionsSI:{widthM:.32,heightM:.32,thicknessM:.001,radiusM:.16},materialSI:{youngModulusPa:69e9,poissonRatio:.33,densityKgM3:2700,tensionNm:900,surfaceDensityKgM2:.45},
  excitationPosition:{x:.37,y:.43},excitationRelativeStrength:1,damping:.025,audioMode:'mono',channelFrequenciesHz:[432],waveform:'sine',modeledComponents:[432],responseMethod:'steady-state-modal-rms',modeCutoff:5,visualScale:'fixed',autoExposure:false,particleSeed:43201,simulationTimeSeconds:0,renderQuality:'medium',view:'particles'};}

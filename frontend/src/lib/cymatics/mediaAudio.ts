import type { CymaticsConfigV1 } from './types';

// iOS inserts a decoder gap when a short WAV loops. A one-minute segment keeps
// that boundary outside normal live adjustments while remaining small (~2.6 MB).
const SAMPLE_RATE=11025,DURATION_SECONDS=60,EDGE_FADE_SECONDS=.006;
function sample(wave:CymaticsConfigV1['waveform'],phase:number){const cycle=phase/(Math.PI*2);if(wave==='square')return Math.sin(phase)>=0?1:-1;if(wave==='triangle')return 2*Math.abs(2*(cycle-Math.floor(cycle+.5)))-1;if(wave==='sawtooth')return 2*(cycle-Math.floor(cycle+.5));return Math.sin(phase);}
function ascii(view:DataView,offset:number,value:string){for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));}

export function renderCymaticsWav(config:CymaticsConfigV1):Blob{
  const frames=SAMPLE_RATE*DURATION_SECONDS,channels=2,bytes=frames*channels*2,buffer=new ArrayBuffer(44+bytes),view=new DataView(buffer),left=config.channelFrequenciesHz[0],right=config.channelFrequenciesHz[1]??left;
  ascii(view,0,'RIFF');view.setUint32(4,36+bytes,true);ascii(view,8,'WAVE');ascii(view,12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,SAMPLE_RATE,true);view.setUint32(28,SAMPLE_RATE*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);ascii(view,36,'data');view.setUint32(40,bytes,true);
  for(let i=0;i<frames;i++){const t=i/SAMPLE_RATE,edge=Math.min(1,i/(SAMPLE_RATE*EDGE_FADE_SECONDS),(frames-i-1)/(SAMPLE_RATE*EDGE_FADE_SECONDS)),gain=.72*Math.max(0,edge);view.setInt16(44+i*4,Math.round(sample(config.waveform,Math.PI*2*left*t)*gain*32767),true);view.setInt16(46+i*4,Math.round(sample(config.waveform,Math.PI*2*right*t)*gain*32767),true);}
  return new Blob([buffer],{type:'audio/wav'});
}

export class CymaticsMediaAudio{
  private audio:HTMLAudioElement|null=null;private url:string|null=null;private config:CymaticsConfigV1|null=null;private volume=.25;
  async play(config:CymaticsConfigV1,volume:number){this.stop();this.config=structuredClone(config);this.volume=volume;const audio=new Audio(),url=URL.createObjectURL(renderCymaticsWav(config));this.audio=audio;this.url=url;audio.src=url;audio.preload='auto';audio.loop=true;audio.volume=volume;try{await audio.play();}catch{this.stop();throw new Error('No se pudo iniciar el audio del iPhone. Revisa el volumen multimedia y vuelve a tocar Escuchar tono.');}}
  async setFrequency(left:number,right?:number){if(!this.audio||!this.config)return;const next=structuredClone(this.config);next.channelFrequenciesHz=right===undefined?[left]:[left,right];next.audioMode=right===undefined?'mono':'binaural';await this.play(next,this.volume);}
  setVolume(volume:number){this.volume=volume;if(this.audio)this.audio.volume=volume;}
  stop(){const audio=this.audio;if(audio){audio.pause();audio.removeAttribute('src');audio.load();}if(this.url)URL.revokeObjectURL(this.url);this.audio=null;this.url=null;this.config=null;}
}

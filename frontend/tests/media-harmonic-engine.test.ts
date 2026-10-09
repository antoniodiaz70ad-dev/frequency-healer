import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSchedule, type HarmonicConfig } from '../src/lib/harmonic/math';
import { IOS_BACKGROUND_MAX_SECONDS, isIOSLike, renderHarmonicConfigToWavBlob } from '../src/lib/voice/mediaHarmonicEngine';
import { CymaticsMediaAudio, renderCymaticsWav } from '../src/lib/cymatics/mediaAudio';
import { defaultCymaticsConfig } from '../src/lib/cymatics/physics';

const config: HarmonicConfig = {
  baseHz: 256,
  ratioId: 'fifth',
  increments: 1,
  direction: 'ascending',
  mode: 'sequence',
  durationSeconds: 2,
  uiVolume: 30,
  waveform: 'sine',
  progression: ['root', 'fifth'],
};

test('detects iOS-like browsers without marking Android as iOS', () => {
  assert.equal(isIOSLike('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'), true);
  assert.equal(isIOSLike('Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36'), false);
});

test('renders guided harmonic config to a WAV blob from the existing schedule', async () => {
  const { blob, schedule } = renderHarmonicConfigToWavBlob(config);
  assert.deepEqual(schedule, buildSchedule(config));
  assert.equal(blob.type, 'audio/wav');
  assert.ok(blob.size > 44);
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  assert.equal(String.fromCharCode(...header.slice(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...header.slice(8, 12)), 'WAVE');
});

test('rejects iPhone media rendering above the V1 background duration limit', () => {
  assert.throws(() => renderHarmonicConfigToWavBlob({ ...config, durationSeconds: IOS_BACKGROUND_MAX_SECONDS + 1 }), /hasta 30 minutos/);
});

test('renders iPhone cymatics audio as stereo WAV with distinct binaural channels',async()=>{
  const config=defaultCymaticsConfig();config.audioMode='binaural';config.channelFrequenciesHz=[220,228];const blob=renderCymaticsWav(config),view=new DataView(await blob.arrayBuffer());assert.equal(blob.type,'audio/wav');assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(24,true),11025);assert.ok(blob.size>2_600_000);let differs=false;for(let offset=44;offset<Math.min(view.byteLength,4000);offset+=4)if(view.getInt16(offset,true)!==view.getInt16(offset+2,true)){differs=true;break;}assert.equal(differs,true);
});

test('iPhone cymatics stop cannot be undone by a pending media play promise',async()=>{
  let resolvePlay!:()=>void;const revoked:string[]=[],instances:FakeAudio[]=[];class FakeAudio{src='';preload='';loop=false;volume=0;paused=false;removed=false;loaded=0;constructor(){instances.push(this);}play(){return new Promise<void>(resolve=>{resolvePlay=resolve;});}pause(){this.paused=true;}removeAttribute(name:string){if(name==='src'){this.src='';this.removed=true;}}load(){this.loaded++;}}
  const scope=globalThis as typeof globalThis&{Audio:typeof Audio};const oldAudio=scope.Audio,create=URL.createObjectURL,revoke=URL.revokeObjectURL;Object.defineProperty(scope,'Audio',{configurable:true,value:FakeAudio});Object.defineProperty(URL,'createObjectURL',{configurable:true,value:()=>`blob:test-${instances.length}`});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:(url:string)=>revoked.push(url)});
  try{const media=new CymaticsMediaAudio(),pending=media.play(defaultCymaticsConfig(),.25);media.stop();resolvePlay();assert.equal(await pending,false);assert.equal(instances[0].paused,true);assert.equal(instances[0].removed,true);assert.ok(instances[0].loaded>=1);assert.ok(revoked.includes('blob:test-1'));}finally{Object.defineProperty(scope,'Audio',{configurable:true,value:oldAudio});Object.defineProperty(URL,'createObjectURL',{configurable:true,value:create});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:revoke});}
});

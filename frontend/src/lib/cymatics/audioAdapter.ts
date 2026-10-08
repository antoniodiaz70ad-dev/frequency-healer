import { getAudioEngine } from '@/lib/audioEngine';
import { isIOSLike } from '@/lib/voice/mediaHarmonicEngine';
import { CymaticsMediaAudio } from './mediaAudio';
import type { CymaticsConfigV1 } from './types';

const media=new CymaticsMediaAudio();
export async function playCymaticsAudio(c:CymaticsConfigV1,volume:number){const [left,right]=c.channelFrequenciesHz;if(isIOSLike())return media.play(c,volume);const engine=getAudioEngine();await engine.prepareForPlayback();engine.play(left,c.waveform,volume,{enabled:c.audioMode==='binaural',differenceHz:right===undefined?0:right-left});}
export function setCymaticsFrequency(left:number,right?:number){if(isIOSLike()){void media.setFrequency(left,right).catch(()=>{});return;}getAudioEngine().setFrequency(left,right===undefined?undefined:right-left);}
export function setCymaticsVolume(volume:number){if(isIOSLike()){media.setVolume(volume);return;}getAudioEngine().setVolume(volume);}
export function stopCymaticsAudio(){if(isIOSLike()){media.stop();return;}getAudioEngine().stopWithFade();}

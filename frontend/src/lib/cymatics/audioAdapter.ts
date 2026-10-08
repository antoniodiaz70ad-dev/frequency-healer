import { getAudioEngine } from '@/lib/audioEngine';
import type { CymaticsConfigV1 } from './types';

export function playCymaticsAudio(c:CymaticsConfigV1,volume:number){const [left,right]=c.channelFrequenciesHz;getAudioEngine().play(left,c.waveform,volume,{enabled:c.audioMode==='binaural',differenceHz:right===undefined?0:right-left});}
export function setCymaticsFrequency(left:number,right?:number){getAudioEngine().setFrequency(left,right===undefined?undefined:right-left);}
export function setCymaticsVolume(volume:number){getAudioEngine().setVolume(volume);}
export function stopCymaticsAudio(){getAudioEngine().stopWithFade();}

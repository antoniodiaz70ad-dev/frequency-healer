import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectPitch} from '../src/lib/cymatics/pitch';

const sine=(hz:number,rate=48000,length=4096)=>Float32Array.from({length},(_,i)=>Math.sin(2*Math.PI*hz*i/rate)*.4);
for(const hz of [110,220,440,880])test(`pitch detector resolves ${hz} Hz within one percent`,()=>{const result=detectPitch(sine(hz),48000);assert.ok(result);assert.ok(Math.abs(result.frequencyHz/hz-1)<.01,`${result.frequencyHz}`);assert.ok(result.confidence>.9);});
test('pitch detector rejects silence and uncorrelated noise',()=>{assert.equal(detectPitch(new Float32Array(4096),48000),null);let state=1;const noise=Float32Array.from({length:4096},()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state/4294967296-.5)*.4;});assert.equal(detectPitch(noise,48000),null);});

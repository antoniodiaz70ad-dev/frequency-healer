import assert from 'node:assert/strict';
import test from 'node:test';
import { compileConstellation } from '../src/lib/harmonic/constellations';
import { createHarmonicCymaticsTransfer, selectTransferMembers } from '../src/lib/cymatics/harmonicTransfer';

async function source(){return compileConstellation({id:'bridge-source',name:'Comparación exacta',seedFrequencyHz:432,playbackMode:'sequence',members:[{id:'root',relationshipType:'root'},{id:'fifth',relationshipType:'ratio',ratio:{numerator:3,denominator:2}},{id:'octave',relationshipType:'octave',octaveOffset:1}]});}

test('harmonic transfer preserves exact identity, order, multiplicity and frequencies',async()=>{const constellation=await source(),transfer=await createHarmonicCymaticsTransfer(constellation);assert.equal(transfer.transferVersion,'harmonic-to-cymatics-v1');assert.equal(transfer.constellationId,constellation.id);assert.equal(transfer.constellationSignature,constellation.signature);assert.deepEqual(transfer.playbackOrder,['root','fifth','octave']);assert.deepEqual(transfer.members.map(member=>member.frequencyHz),[432,648,864]);assert.notEqual(transfer.members,constellation.members);});

test('transfer validates the constellation instead of accepting altered derived data',async()=>{const constellation=await source();await assert.rejects(createHarmonicCymaticsTransfer({...constellation,members:constellation.members.map((member,index)=>index?member:{...member,frequencyHz:433})}),/no coincide/);});

test('member selection is explicit, ordered and limited to A/B',async()=>{const transfer=await createHarmonicCymaticsTransfer(await source());assert.deepEqual(selectTransferMembers(transfer,['fifth','root']).map(member=>member.frequencyHz),[648,432]);assert.throws(()=>selectTransferMembers(transfer,[]));assert.throws(()=>selectTransferMembers(transfer,['root','root']));assert.throws(()=>selectTransferMembers(transfer,['missing']));assert.throws(()=>selectTransferMembers(transfer,['root','fifth','octave']));});

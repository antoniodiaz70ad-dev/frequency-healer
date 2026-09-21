import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUnifiedExport, verifyUnifiedExport, FREQUENCY_HEALER_STORAGE_ALLOWLIST, DISCLAIMER_ACCEPTED_KEY, type ReadOnlyStorage } from '../src/lib/dataExport';
import { SESSIONS_KEY } from '../src/lib/voice/storage';
import { buildProposal } from '../src/lib/voice/rules';
import { parseLocalIntent } from '../src/lib/voice/intentParser';

class Memory implements ReadOnlyStorage { constructor(public data=new Map<string,string>()){} reads:string[]=[];getItem(key:string){this.reads.push(key);return this.data.get(key)??null;} }
function voiceRecord(){const proposal=buildProposal(parseLocalIntent('focus 10 minutes'));return {schemaVersion:1,id:'voice-v2',createdAt:'2026-09-20T10:00:00.000Z',completedAt:'2026-09-20T10:10:00.000Z',status:'completed',intent:proposal.intent,proposal,before:{focus:3},after:{focus:5},markers:[],technical:{actualDurationMs:600000}};}

test('explicit allowlist exports every owned namespace and never reads arbitrary storage',async()=>{
  const memory=new Memory(new Map([['unrelated-secret','do-not-read'],[DISCLAIMER_ACCEPTED_KEY,'1']]));const result=await createUnifiedExport(memory,'2026-09-20T12:00:00.000Z');
  assert.deepEqual(result.namespaces.map(x=>x.key),[...FREQUENCY_HEALER_STORAGE_ALLOWLIST]);assert.equal(result.namespaces.length,12);assert.equal(result.namespaces.some(x=>x.raw==='do-not-read'),false);assert.equal(memory.reads.includes('unrelated-secret'),false);await verifyUnifiedExport(result);
});
test('valid voice-rules-v2 export retains mandatory Seed Selection provenance',async()=>{
  const raw=JSON.stringify([voiceRecord()]),result=await createUnifiedExport(new Memory(new Map([[SESSIONS_KEY,raw]])),'2026-09-20T12:00:00.000Z');
  assert.deepEqual(result.seedSelectionProvenance,{requiredForRuleVersion:'voice-rules-v2',seedRegistryVersion:'seed-registry-v1',seedSelectionVersion:'seed-selection-v1',voiceRecordsStatus:'valid',legacyProposalCount:0,v2ProposalCount:1});assert.equal(result.namespaces.find(x=>x.key===SESSIONS_KEY)?.raw,raw);await verifyUnifiedExport(result);
});
test('corrupt owned payload is preserved byte-for-byte and marked invalid',async()=>{
  const raw='{broken',result=await createUnifiedExport(new Memory(new Map([[SESSIONS_KEY,raw]])),'2026-09-20T12:00:00.000Z'),row=result.namespaces.find(x=>x.key===SESSIONS_KEY)!;
  assert.equal(row.raw,raw);assert.equal(row.status,'invalid');assert.equal(result.seedSelectionProvenance.voiceRecordsStatus,'invalid');await verifyUnifiedExport(result);
});
test('verifier rejects content, declared validation, allowlist and provenance tampering',async()=>{
  const valid=await createUnifiedExport(new Memory(),'2026-09-20T12:00:00.000Z');
  const missing=structuredClone(valid);missing.namespaces.pop();await assert.rejects(verifyUnifiedExport(missing));
  const wrongStatus=structuredClone(valid);wrongStatus.namespaces[0].status='valid';await assert.rejects(verifyUnifiedExport(wrongStatus));
  const wrongProvenance=structuredClone(valid) as unknown as {seedSelectionProvenance:{seedSelectionVersion:string}};wrongProvenance.seedSelectionProvenance.seedSelectionVersion='other';await assert.rejects(verifyUnifiedExport(wrongProvenance));
  const changed=structuredClone(valid);changed.exportedAt='2026-09-21T12:00:00.000Z';await assert.rejects(verifyUnifiedExport(changed));
});
test('generation and verification are read-only and export has no import surface',async()=>{
  const memory=new Memory(),result=await createUnifiedExport(memory);await verifyUnifiedExport(result);assert.equal('setItem' in memory,false);const api=await import('../src/lib/dataExport');assert.equal(Object.keys(api).some(name=>/import/i.test(name)),false);
});

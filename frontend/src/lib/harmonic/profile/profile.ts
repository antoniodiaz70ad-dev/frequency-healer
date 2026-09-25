import { buildSchedule, type HarmonicConfig } from '../math';
import { validateConstellation, type HarmonicConstellationV1 } from '../constellations';
import { canonicalRatio } from '../ratios';
import { freeze } from '../../discovery/model';

export const HIP_VERSION = 'harmonic-information-v1' as const;
export const HCI_VERSION = 'harmonic-complexity-v1' as const;
export type StructureSource = { sourceType:'legacy-harmonic-config'; configuration:HarmonicConfig }
  | { sourceType:'harmonic-constellation'; constellation:HarmonicConstellationV1 };
export interface StructuralMemberV1 {
  frequencyHz:number;
  relationshipKey:string;
  declaredType:'root'|'ratio'|'octave'|'cascade-power';
  ratio?:{numerator:number;denominator:number};
  octaveOffset?:number;
  cascadeExponent?:number;
}
export interface HarmonicInformationProfileV1 {
  schemaVersion:1;
  profileVersion:typeof HIP_VERSION;
  sourceType:StructureSource['sourceType'];
  seedFrequencyHz:number;
  memberCount:number;
  uniqueMemberCount:number;
  uniqueFrequencyCount:number;
  uniqueRelationshipCount:number;
  ratioCount:number;
  ratioDiversity:number;
  ratioFamilies:readonly string[];
  octaveCount:number;
  octaveOffsets:readonly number[];
  explicitOctaveOffsetSpan:number|null;
  octaveSpan:number;
  spectralMinHz:number;
  spectralMaxHz:number;
  spectralSpanHz:number;
  duplicateVoiceCount:number;
  frequencyMultiplicity:readonly {frequencyHz:number;count:number}[];
  playbackMode:HarmonicConfig['mode'];
  orderedStructure:boolean;
  generationVersion:string;
  members:readonly StructuralMemberV1[];
}
export interface HarmonicComplexityIndexV1 {
  schemaVersion:1;
  algorithmVersion:typeof HCI_VERSION;
  score:number;
  band:'lower'|'moderate'|'higher';
  terms:{member:number;relationship:number;spectral:number;order:number};
  adjacentChanges:number;
}
export interface HarmonicStructureV1 { schemaVersion:1; hip:HarmonicInformationProfileV1; hci:HarmonicComplexityIndexV1 }
const ratioKey=(numerator:number,denominator:number)=>canonicalRatio({numerator,denominator}).join(':');
// Identity only; derived frequencies always come from the existing compiler/schedule.
const octaveKey=(offset:number)=>offset>=0?`${BigInt(1)<<BigInt(offset)}:1`:`1:${BigInt(1)<<BigInt(-offset)}`;
function describe(members:StructuralMemberV1[], seed:number, mode:HarmonicConfig['mode'], sourceType:StructureSource['sourceType'], generationVersion:string):HarmonicStructureV1 {
  const frequencies=members.map(m=>m.frequencyHz),unique=[...new Set(frequencies)].sort((a,b)=>a-b);
  const count=members.length,relationships=new Set(members.map(m=>m.relationshipKey)).size;
  const ratios=members.filter(m=>m.declaredType==='ratio'||m.declaredType==='cascade-power');
  const octaveOffsets=members.flatMap(m=>m.octaveOffset===undefined?[]:[m.octaveOffset]);
  const min=unique[0],max=unique[unique.length-1],span=Math.log2(max/min);
  const frequencyMultiplicity=unique.map(frequencyHz=>({frequencyHz,count:frequencies.filter(f=>f===frequencyHz).length}));
  const hip:HarmonicInformationProfileV1={schemaVersion:1,profileVersion:HIP_VERSION,sourceType,seedFrequencyHz:seed,
    memberCount:count,uniqueMemberCount:new Set(members.map(m=>JSON.stringify([m.relationshipKey,m.frequencyHz]))).size,
    uniqueFrequencyCount:unique.length,uniqueRelationshipCount:relationships,ratioCount:ratios.length,
    ratioDiversity:new Set(ratios.map(m=>m.relationshipKey)).size,
    ratioFamilies:[...new Set(ratios.map(m=>m.declaredType==='cascade-power'?'cascade-13-12':m.relationshipKey))].sort(),
    octaveCount:octaveOffsets.length,octaveOffsets,explicitOctaveOffsetSpan:octaveOffsets.length?Math.max(...octaveOffsets)-Math.min(...octaveOffsets):null,
    octaveSpan:span,spectralMinHz:min,spectralMaxHz:max,spectralSpanHz:max-min,duplicateVoiceCount:count-unique.length,
    frequencyMultiplicity,playbackMode:mode,orderedStructure:mode==='sequence',generationVersion,members};
  const adjacentChanges=mode==='sequence'?members.slice(1).filter((m,i)=>m.relationshipKey!==members[i].relationshipKey||m.frequencyHz!==members[i].frequencyHz).length:0;
  const terms={member:1-1/count,relationship:1-1/relationships,spectral:span/Math.log2(2000/40),order:count>1?adjacentChanges/(count-1):0};
  const score=25*(terms.member+terms.relationship+terms.spectral+terms.order);
  return freeze({schemaVersion:1,hip,hci:{schemaVersion:1,algorithmVersion:HCI_VERSION,score,band:score<100/3?'lower':score<200/3?'moderate':'higher',terms,adjacentChanges}});
}
/** Pure derived data. No audio, persistence, outcomes, candidate ranking or mutable source references. */
export async function describeHarmonics(input:StructureSource):Promise<HarmonicStructureV1> {
  const source=structuredClone(input);
  if(source?.sourceType==='harmonic-constellation') {
    const c=await validateConstellation(source.constellation);
    const members=c.members.map((m):StructuralMemberV1=>{
      const common={frequencyHz:m.frequencyHz,declaredType:m.relationshipType};
      if(m.relationshipType==='root')return {...common,relationshipKey:'1:1'};
      if(m.relationshipType==='octave')return {...common,relationshipKey:octaveKey(m.octaveOffset),octaveOffset:m.octaveOffset};
      return {...common,relationshipKey:ratioKey(m.ratio.numerator,m.ratio.denominator),ratio:{numerator:m.ratio.numerator,denominator:m.ratio.denominator}};
    });
    return describe(members,c.seedFrequencyHz,c.playbackMode,source.sourceType,c.generationVersion);
  }
  if(source?.sourceType!=='legacy-harmonic-config')throw new Error('Fuente estructural no compatible.');
  const c=source.configuration,schedule=buildSchedule(c);
  const members=schedule.steps.flatMap(step=>step.frequencies.map((frequencyHz,i):StructuralMemberV1=>{
    const label=step.ratios[i];
    if(schedule.family==='cascade-13-12') {
      const match=/^\(13\/12\)\^(-?\d+)$/.exec(label);
      if(!match)throw new Error('Relación de cascada no disponible; no se infiere.');
      const cascadeExponent=Number(match[1]);
      return {frequencyHz,relationshipKey:cascadeExponent===0?'1:1':label,declaredType:cascadeExponent===0?'root':'cascade-power',cascadeExponent};
    }
    const match=/^(\d+):(\d+)$/.exec(label);
    if(!match)throw new Error('Relación no disponible; no se infiere.');
    const numerator=Number(match[1]),denominator=Number(match[2]);
    return {frequencyHz,relationshipKey:ratioKey(numerator,denominator),declaredType:numerator===denominator?'root':'ratio',...(numerator===denominator?{}:{ratio:{numerator,denominator}})};
  }));
  return describe(members,c.baseHz,c.mode,source.sourceType,'legacy-buildSchedule-v1');
}

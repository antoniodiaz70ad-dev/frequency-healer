export type Selection = { observation:boolean; interpretation:boolean; action:boolean; scores:boolean };
export type Summary = {
 schemaVersion:1; source:'frequency-healer'; practice:'bentov'; sessionId:string;
 protocolVersion:'bentov-respiration-v1.1'; startedAt:string; endedAt:string;
 elapsedActiveMs:number; status:'completed'|'stopped'|'interrupted'; mode:'paced'|'natural'|'mixed';
 interruptionCount:number; shared:Selection; observation:string|null; interpretation:string|null; action:string|null;
 scores:null|{tensionPre:number|null;tensionPost:number|null;clarityPre:number|null;clarityPost:number|null};
};
export type Followup = {expectedRevision:number;status:'pending'|'done'|'changed';observation:string|null;nextAction:string|null};
export const VERSION:1;
export const MAX_BYTES:number;
export function validateSummary(input:unknown):Summary;
export function selectSummary(session:unknown,shared:Selection):Summary;
export function validateFollowup(input:unknown):Followup;
export function classifyReplay(existing:unknown,incoming:unknown):'same'|'conflict';
export function acceptSummaryEvent(event:{source:unknown;origin:string;data:unknown},expected:{window:unknown;origin:string;flowId:string;channel:string;expiresAt:number;now:number}):Summary;

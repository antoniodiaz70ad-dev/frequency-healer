export const BENTOV_PROTOCOL_VERSION = 'bentov-respiration-v1.1' as const;
export const BENTOV_SCHEMA_VERSION = 1 as const;

export type BentovMode = 'paced' | 'natural';
export type BentovActualMode = BentovMode | 'mixed';
export type BentovStatus = 'completed' | 'stopped' | 'interrupted';
export type BentovComfort = 'comfortable' | 'neutral' | 'uncomfortable';
export type BentovFollowupStatus = 'pending' | 'recorded' | 'not-checked';

export interface BentovScheduleDay { date:string; assignedMode:BentovMode; omission?:{recordedAt:string;reason?:string} }
export interface BentovProgram { id:string; schemaVersion:1; protocolVersion:typeof BENTOV_PROTOCOL_VERSION; createdAt:string; timezone:string; startDate:string; schedule:BentovScheduleDay[] }
export interface BentovInterruption { kind:'manual-pause'|'tab-hidden'|'navigation'|'mode-change'; at:string; detail?:string }
export interface BentovSession {
  id:string; schemaVersion:1; programId:string|null; scheduledDate:string|null; assignedMode:BentovMode|null; actualMode:BentovActualMode;
  status:BentovStatus; startedAt:string; endedAt:string; elapsedActiveMs:number; elapsedWallMs:number; protocolVersion:typeof BENTOV_PROTOCOL_VERSION;
  targetInhaleMs:number|null; targetExhaleMs:number|null; guidedActiveMs:number|null;
  tensionPre:number|null; tensionPost:number|null; clarityPre:number|null; clarityPost:number|null; preRecordedAt:string|null; postRecordedAt:string|null;
  comfort:BentovComfort|null; interruptions:BentovInterruption[]; deviations:string[]; stopReason:string|null;
  observation:string; interpretation:string; action:string; followup:{status:BentovFollowupStatus;text:string;recordedAt:string|null};
  perceivedDurationCategory:'short'|'medium'|'long'|null;
}

export interface BentovDraft { schemaVersion:1; session:Partial<BentovSession>; updatedAt:string }


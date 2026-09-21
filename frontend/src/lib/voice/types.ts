import type { HarmonicConfig, HarmonicSchedule } from '../harmonic/math';
import type { SeedSelectionV1 } from './seedSelection';
export const GOALS = ['clarity', 'focus', 'relaxation', 'reflection', 'creative_exploration', 'sleep_preparation', 'custom'] as const;
export const DESIRED_STATES = ['calm', 'focus', 'openness', 'grounded', 'creative', 'restful'] as const;
export type VoiceGoal = typeof GOALS[number];
export type DesiredState = typeof DESIRED_STATES[number];
export interface ParsedIntentionV1 {
  schemaVersion: 1; intention: string; goal: VoiceGoal; customGoal?: string;
  desiredStates: DesiredState[]; durationMinutes: number; intensity: 'gentle' | 'deep' | 'experimental';
  sessionKind: 'exploratory'; language: string; confidence: Record<string, number>; requiresReview: string[];
}
export interface VoiceSessionProposalV1 {
  schemaVersion: 1; proposalId: string; ruleId: string; ruleVersion: 'voice-rules-v1'|'voice-rules-v2';
  source: 'local-rule' | 'user-customized'; intent: ParsedIntentionV1;
  harmonicConfig: HarmonicConfig; schedule: HarmonicSchedule; rationale: string[]; warnings: string[];
  requiresExplicitExperimentalConsent: boolean;
  seedSelection?: SeedSelectionV1;
  proposalIdentity?: { ruleVersion:'voice-rules-v2';seedRegistryVersion:'seed-registry-v1';seedSelectionVersion:'seed-selection-v1';intent:ParsedIntentionV1;effectiveProgression:readonly string[];selectedSeed:number;finalHarmonicConfig:HarmonicConfig };
}
export interface SelfRatingV1 { clarity: number; stress: number; focus: number }
export interface SessionMarkerV1 {
  id: string; offsetMs: number; wallClockCreatedAt: string; kind: 'insight' | 'observation' | 'command' | 'custom';
  transcript?: string; note?: string;
  harmonicSnapshot: { stepIndex: number | null; baseHz: number; activeHz: number[]; ratioId: string };
}
export interface VoiceSessionRecordV1 {
  schemaVersion: 1; id: string; createdAt: string; completedAt?: string; status: 'completed' | 'stopped' | 'error';
  intent: ParsedIntentionV1; proposal: VoiceSessionProposalV1;
  before?: Partial<SelfRatingV1>; after?: Partial<SelfRatingV1>; markers: SessionMarkerV1[]; reflection?: string;
  originalWords?: string;
  technical: { appVersion?: string; actualDurationMs: number; stopReason?: string };
}

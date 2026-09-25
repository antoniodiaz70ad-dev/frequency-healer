import type { HarmonicConfig } from '../harmonic/math';

export const STATE_FIELDS = ['clarity', 'tension', 'focus', 'energy', 'mood'] as const;
export type ExperimentState = Readonly<Partial<Record<typeof STATE_FIELDS[number], number>>>;
export type ExperimentStatus = 'prepared' | 'started' | 'completed' | 'cancelled' | 'interrupted';
export type ConfigurationSnapshot = Readonly<Omit<HarmonicConfig, 'progression'>> & {
  readonly progression?: readonly NonNullable<HarmonicConfig['progression']>[number][];
};
export interface ExperimentInput {
  readonly intention?: string;
  readonly expectationScore?: number;
  readonly context?: string;
  readonly preState: ExperimentState;
}
export interface ExperimentRecordV1 extends ExperimentInput {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly completedAt?: string;
  readonly source: 'harmonic-lab';
  readonly status: ExperimentStatus;
  readonly configurationSnapshot: ConfigurationSnapshot;
  readonly postState: ExperimentState;
  readonly reflection?: string;
}

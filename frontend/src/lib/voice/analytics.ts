import type { SelfRatingV1, VoiceSessionRecordV1 } from './types';
export interface N1Metric { metric: keyof SelfRatingV1; n: number; mean: number; median: number; first: string; last: string; label: 'señal preliminar' | 'patrón observado' }
export interface N1Group { key: string; goal: string; ratio: string; mode: string; baseHz: number; minutesBand: string; metrics: N1Metric[] }
export function n1Summary(records: VoiceSessionRecordV1[]): N1Group[] {
  const groups = new Map<string, VoiceSessionRecordV1[]>();
  for (const record of records) {
    if (record.status !== 'completed') continue;
    const p = record.proposal, c = p.harmonicConfig;
    const band = record.intent.durationMinutes <= 15 ? '5–15 min' : record.intent.durationMinutes <= 30 ? '16–30 min' : '31–60 min';
    const key = JSON.stringify([p.ruleVersion, p.ruleId, p.schedule.family, c.ratioId, c.mode, record.intent.goal, band, c.baseHz, c.progression ?? null, c.direction, c.increments]);
    const rows = groups.get(key) ?? []; rows.push(record); groups.set(key, rows);
  }
  const result: N1Group[] = [];
  for (const [key, rows] of groups) {
    const metrics: N1Metric[] = [];
    for (const metric of ['clarity', 'stress', 'focus'] as const) {
      const paired = rows.filter(r => Number.isInteger(r.before?.[metric]) && Number.isInteger(r.after?.[metric]));
      if (paired.length < 5) continue;
      const delta = paired.map(r => r.after![metric]! - r.before![metric]!).sort((a, b) => a - b), n = delta.length;
      const dates = paired.map(r => r.createdAt).sort();
      metrics.push({ metric, n, mean: delta.reduce((a, b) => a + b, 0) / n, median: n % 2 ? delta[(n - 1) / 2] : (delta[n / 2 - 1] + delta[n / 2]) / 2, first: dates[0], last: dates[n - 1], label: n < 10 ? 'señal preliminar' : 'patrón observado' });
    }
    if (metrics.length) result.push({ key, goal: rows[0].intent.goal, ratio: rows[0].proposal.harmonicConfig.ratioId, mode: rows[0].proposal.harmonicConfig.mode, baseHz: rows[0].proposal.harmonicConfig.baseHz, minutesBand: JSON.parse(key)[6], metrics });
  }
  return result;
}

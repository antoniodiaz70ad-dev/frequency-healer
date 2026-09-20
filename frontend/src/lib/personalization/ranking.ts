import { assert, freeze, same, validateContext, validatePlan, type ProtocolCandidateV1, type ProtocolDiscoveryPlanV1, type DiscoveryContextV1, type TargetMetric } from '../discovery/model';
import { contextKey, statistics } from '../discovery/analysis';

export const ALGORITHM_VERSION = 'personalization-v1' as const;
export const METRIC_DIRECTION = { clarity: 1, tension: -1, focus: 1, energy: 1, mood: 1 } as const;
export const EXPECTATION_GAP = 2;
export type EvidenceLevel = 'NONE' | 'PRELIMINARY' | 'DESCRIPTIVE';
export const evidenceLevel = (n: number): EvidenceLevel => n < 5 ? 'NONE' : n < 10 ? 'PRELIMINARY' : 'DESCRIPTIVE';
export interface PersonalObservationV1 {
  planId: string; experimentId: string; assignmentIndex: number;
  pre: number; post: number; change: number; favorableChange: number; expectation: number;
}
export interface PersonalizedRecommendationV1 {
  schemaVersion: 1; algorithmVersion: typeof ALGORITHM_VERSION;
  candidateId: string; candidate: ProtocolCandidateV1; defaultIndex: number;
  targetMetric: TargetMetric; direction: 1 | -1; evidenceLevel: EvidenceLevel; comparableN: number;
  descriptiveMetrics: { change: ReturnType<typeof statistics>; favorableChange: ReturnType<typeof statistics>; baseline: ReturnType<typeof statistics>; expectation: ReturnType<typeof statistics> };
  terms: { outcomeSignal: number; evidenceWeight: number; consistencyWeight: number; improvingSessions: number };
  personalizationScore: number;
  provenance: PersonalObservationV1[];
}
export interface PersonalizedRecommendationSetV1 {
  schemaVersion: 1; algorithmVersion: typeof ALGORITHM_VERSION; anchorPlanId: string;
  intent: ProtocolDiscoveryPlanV1['intent']; targetMetric: TargetMetric;
  context: DiscoveryContextV1; sourcePlans: ProtocolDiscoveryPlanV1[];
  recommendations: PersonalizedRecommendationV1[];
  defaultOrder: string[]; orderedCandidateIds: string[];
  evidenceLevel: EvidenceLevel; expectationDifference: number | null; expectationConfound: boolean;
  orderingApplied: boolean;
  reason: 'insufficient' | 'preliminary-retain-exploration' | 'expectation-confound' | 'no-positive-signal' | 'descriptive-order';
}
/** Only validated completed Discovery plans can supply evidence; no writes or audio. */
export async function personalize(values: readonly unknown[], anchorPlanId: string, context: DiscoveryContextV1): Promise<PersonalizedRecommendationSetV1> {
  const captured = structuredClone(values), stratum = validateContext(structuredClone(context));
  const plans = await Promise.all(captured.map(validatePlan));
  assert(new Set(plans.map(p => p.id)).size === plans.length, 'IDs de plan repetidos; evidencia no disponible.');
  const anchor = plans.find(p => p.id === anchorPlanId);
  assert(anchor?.status === 'completed', 'Selecciona un plan Discovery completado; no se alteran planes activos.');
  const sourcePlans = plans.filter(p => p.status === 'completed' && same(p.intent, anchor.intent) && p.primaryMetric === anchor.primaryMetric && same(p.comparabilityPolicy, anchor.comparabilityPolicy) && same(p.candidates, anchor.candidates)).sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const seen = new Set<string>();
  for (const plan of sourcePlans) for (const assignment of plan.assignments) if (assignment.result) {
    const id = assignment.result.experiment.id;
    assert(!seen.has(id), 'Experimento repetido entre planes; no se duplica N.'); seen.add(id);
  }
  const targetMetric = anchor.primaryMetric, direction = METRIC_DIRECTION[targetMetric];
  const recommendations = anchor.candidates.map((candidate, defaultIndex): PersonalizedRecommendationV1 => {
    const provenance: PersonalObservationV1[] = [];
    for (const plan of sourcePlans) for (const assignment of plan.assignments) {
      const result = assignment.result;
      if (!result || assignment.candidateId !== candidate.id || result.experiment.status !== 'completed' || contextKey(result.context) !== contextKey(stratum)) continue;
      const e = result.experiment, pre = e.preState[targetMetric], post = e.postState[targetMetric];
      if (pre === undefined || post === undefined) continue;
      provenance.push({ planId: plan.id, experimentId: e.id, assignmentIndex: assignment.index, pre, post, change: post - pre, favorableChange: direction * (post - pre), expectation: e.expectationScore! });
    }
    const n = provenance.length;
    const descriptiveMetrics = { change: statistics(provenance.map(p => p.change)), favorableChange: statistics(provenance.map(p => p.favorableChange)), baseline: statistics(provenance.map(p => p.pre)), expectation: statistics(provenance.map(p => p.expectation)) };
    const outcomeSignal = Math.max(0, descriptiveMetrics.favorableChange.median ?? 0);
    const evidenceWeight = n < 5 ? 0 : Math.min(n, 10) / 10;
    const improvingSessions = provenance.filter(p => p.favorableChange > 0).length;
    const consistencyWeight = n ? improvingSessions / n : 0;
    return { schemaVersion: 1, algorithmVersion: ALGORITHM_VERSION, candidateId: candidate.id, candidate, defaultIndex, targetMetric, direction,
      evidenceLevel: evidenceLevel(n), comparableN: n, descriptiveMetrics, terms: { outcomeSignal, evidenceWeight, consistencyWeight, improvingSessions }, personalizationScore: outcomeSignal * evidenceWeight * consistencyWeight, provenance };
  });
  const level = evidenceLevel(Math.min(...recommendations.map(r => r.comparableN)));
  const expectations = recommendations.flatMap(r => r.descriptiveMetrics.expectation.mean === null ? [] : [r.descriptiveMetrics.expectation.mean]);
  const expectationDifference = expectations.length === recommendations.length ? Math.max(...expectations) - Math.min(...expectations) : null;
  const expectationConfound = expectationDifference !== null && expectationDifference >= EXPECTATION_GAP;
  const orderingApplied = level === 'DESCRIPTIVE' && !expectationConfound && recommendations.some(r => r.personalizationScore > 0);
  const ordered = orderingApplied ? [...recommendations].sort((a,b) => b.personalizationScore - a.personalizationScore || a.defaultIndex - b.defaultIndex) : recommendations;
  const reason = level === 'NONE' ? 'insufficient' : level === 'PRELIMINARY' ? 'preliminary-retain-exploration' : expectationConfound ? 'expectation-confound' : orderingApplied ? 'descriptive-order' : 'no-positive-signal';
  return freeze({ schemaVersion: 1, algorithmVersion: ALGORITHM_VERSION, anchorPlanId, intent: anchor.intent, targetMetric, context: stratum, sourcePlans, recommendations: ordered, defaultOrder: anchor.candidates.map(c => c.id), orderedCandidateIds: ordered.map(r => r.candidateId), evidenceLevel: level, expectationDifference, expectationConfound, orderingApplied, reason });
}
export async function validatePersonalization(value: PersonalizedRecommendationSetV1) {
  const copy = structuredClone(value);
  assert(copy?.schemaVersion === 1 && copy.algorithmVersion === ALGORITHM_VERSION, 'Versión de personalización inválida.');
  const rebuilt = await personalize(copy.sourcePlans, copy.anchorPlanId, copy.context);
  assert(same(copy, rebuilt), 'La evidencia, puntuación o procedencia no coincide; genera otra recomendación.');
  return rebuilt;
}

import { AlertLevelValue } from '../../domain/value-objects/AlertLevel';
import { AggregatedEvidence } from './EvidenceAggregationService';

export interface PriorityScore {
  evidence: AggregatedEvidence;
  score: number;
  rationale: string;
}

/**
 * PriorityCalculationService — scores clinical findings by urgency for display ordering.
 * Uses a multi-factor weighted model: alert level, recency, and patient safety impact.
 */
export class PriorityCalculationService {
  private static readonly WEIGHTS = {
    alertLevel: 0.5,
    recency: 0.3,
    type: 0.2,
  };

  private static readonly TYPE_WEIGHTS: Record<string, number> = {
    allergy: 1.0,
    contradiction: 0.9,
    finding: 0.8,
    pattern: 0.6,
  };

  prioritize(evidenceList: AggregatedEvidence[]): PriorityScore[] {
    const now = Date.now();

    return evidenceList
      .map((evidence) => {
        const alertScore = this.scoreAlertLevel(evidence.alertLevel);
        const recencyScore = this.scoreRecency(evidence.timestamp, now);
        const typeScore = PriorityCalculationService.TYPE_WEIGHTS[evidence.type] ?? 0.5;

        const score =
          alertScore * PriorityCalculationService.WEIGHTS.alertLevel +
          recencyScore * PriorityCalculationService.WEIGHTS.recency +
          typeScore * PriorityCalculationService.WEIGHTS.type;

        return {
          evidence,
          score: Math.round(score * 100) / 100,
          rationale: this.buildRationale(alertScore, recencyScore, typeScore),
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  topN(evidenceList: AggregatedEvidence[], n: number): PriorityScore[] {
    return this.prioritize(evidenceList).slice(0, n);
  }

  private scoreAlertLevel(level: AlertLevelValue): number {
    const map: Record<AlertLevelValue, number> = {
      [AlertLevelValue.CRITICAL]: 1.0,
      [AlertLevelValue.WARNING]: 0.6,
      [AlertLevelValue.INFO]: 0.2,
    };
    return map[level] ?? 0.2;
  }

  private scoreRecency(timestamp: Date, now: number): number {
    const ageDays = (now - timestamp.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays <= 7) return 1.0;
    if (ageDays <= 30) return 0.8;
    if (ageDays <= 90) return 0.6;
    if (ageDays <= 365) return 0.4;
    return 0.2;
  }

  private buildRationale(
    alertScore: number,
    recencyScore: number,
    typeScore: number
  ): string {
    const parts: string[] = [];
    if (alertScore >= 1.0) parts.push('critical alert');
    else if (alertScore >= 0.6) parts.push('warning-level alert');
    if (recencyScore >= 0.8) parts.push('recent occurrence');
    if (typeScore >= 0.9) parts.push('high-impact type');
    return parts.join(', ') || 'standard priority';
  }
}

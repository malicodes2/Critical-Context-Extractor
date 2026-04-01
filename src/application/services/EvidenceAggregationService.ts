import { Finding } from '../../domain/entities/Finding';
import { Allergy } from '../../domain/entities/Allergy';
import { Evidence } from '../../domain/entities/Evidence';
import { AlertLevelValue } from '../../domain/value-objects/AlertLevel';

export interface AggregatedEvidence {
  id: string;
  type: 'allergy' | 'finding' | 'contradiction' | 'pattern';
  description: string;
  alertLevel: AlertLevelValue;
  sources: Evidence[];
  timestamp: Date;
}

/**
 * EvidenceAggregationService — deduplicate and merge evidence from multiple sources.
 * Ensures the same clinical event doesn't appear multiple times in the final brief.
 */
export class EvidenceAggregationService {
  aggregateFindings(findings: Finding[]): AggregatedEvidence[] {
    const seen = new Map<string, AggregatedEvidence>();

    for (const finding of findings) {
      const normalizedKey = `${finding.type}:${finding.test.toLowerCase().trim()}`;

      if (seen.has(normalizedKey)) {
        const existing = seen.get(normalizedKey)!;
        // Escalate alert level if a duplicate is more severe
        if (
          this.alertPriority(finding.alertLevel as AlertLevelValue) >
          this.alertPriority(existing.alertLevel)
        ) {
          existing.alertLevel = finding.alertLevel as AlertLevelValue;
          existing.description = finding.alertMessage;
        }
        continue;
      }

      seen.set(normalizedKey, {
        id: finding.id,
        type: 'finding',
        description: finding.alertMessage,
        alertLevel: finding.alertLevel as AlertLevelValue,
        sources: [],
        timestamp: finding.date,
      });
    }

    return Array.from(seen.values());
  }

  aggregateAllergies(allergies: Allergy[]): AggregatedEvidence[] {
    const seen = new Map<string, AggregatedEvidence>();

    for (const allergy of allergies) {
      const normalizedKey = allergy.substance.toLowerCase().replace(/\s+/g, '-');

      if (seen.has(normalizedKey)) {
        // Escalate if undocumented version found
        const existing = seen.get(normalizedKey)!;
        if (allergy.source !== 'allergy-list') {
          existing.alertLevel = AlertLevelValue.CRITICAL;
          existing.description = `${allergy.substance} allergy in notes but not in allergy list`;
        }
        continue;
      }

      seen.set(normalizedKey, {
        id: normalizedKey,
        type: 'allergy',
        description: `${allergy.substance}: ${allergy.reaction} (${allergy.severity})`,
        alertLevel: allergy.alertLevel,
        sources: [],
        timestamp: allergy.dateRecorded ?? new Date(),
      });
    }

    return Array.from(seen.values());
  }

  mergeAndDeduplicate(
    findings: AggregatedEvidence[],
    allergies: AggregatedEvidence[]
  ): AggregatedEvidence[] {
    return [...findings, ...allergies].sort(
      (a, b) =>
        this.alertPriority(b.alertLevel) - this.alertPriority(a.alertLevel) ||
        b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  private alertPriority(level: AlertLevelValue): number {
    const map: Record<AlertLevelValue, number> = {
      [AlertLevelValue.CRITICAL]: 3,
      [AlertLevelValue.WARNING]: 2,
      [AlertLevelValue.INFO]: 1,
    };
    return map[level] ?? 0;
  }
}

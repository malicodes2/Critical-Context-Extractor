import { daysBetween } from '../../shared/utils/DateUtils';

export interface SymptomOccurrence {
  symptom: string;
  date: Date;
  noteId: string;
}

export type PatternFrequency = 'daily' | 'weekly' | 'monthly' | 'irregular';

export interface SymptomPattern {
  symptom: string;
  occurrences: SymptomOccurrence[];
  frequency: PatternFrequency;
  averageIntervalDays: number;
  stdDeviationDays: number;
  isRecurring: boolean;
}

/**
 * TemporalAnalysisService — domain service for detecting recurring clinical patterns.
 */
export class TemporalAnalysisService {
  detectPatterns(
    occurrences: SymptomOccurrence[],
    minimumOccurrences: number = 3
  ): SymptomPattern[] {
    const grouped = this.groupBySymptom(occurrences);
    const patterns: SymptomPattern[] = [];

    for (const [symptom, symptomOccurrences] of grouped.entries()) {
      if (symptomOccurrences.length < minimumOccurrences) continue;
      patterns.push(this.analyzePattern(symptom, symptomOccurrences));
    }

    return patterns.sort((a, b) => b.occurrences.length - a.occurrences.length);
  }

  private groupBySymptom(
    occurrences: SymptomOccurrence[]
  ): Map<string, SymptomOccurrence[]> {
    const grouped = new Map<string, SymptomOccurrence[]>();

    for (const occurrence of occurrences) {
      const key = occurrence.symptom.toLowerCase().trim();
      const existing = grouped.get(key) ?? [];
      existing.push(occurrence);
      grouped.set(key, existing);
    }

    return grouped;
  }

  private analyzePattern(
    symptom: string,
    occurrences: SymptomOccurrence[]
  ): SymptomPattern {
    const sorted = occurrences
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const intervals = this.calculateIntervals(sorted);
    const avgInterval = this.mean(intervals);
    const stdDev = this.stdDeviation(intervals, avgInterval);

    return {
      symptom,
      occurrences: sorted,
      frequency: this.classifyFrequency(avgInterval),
      averageIntervalDays: Math.round(avgInterval),
      stdDeviationDays: Math.round(stdDev),
      isRecurring: sorted.length >= 3,
    };
  }

  private calculateIntervals(sorted: SymptomOccurrence[]): number[] {
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(daysBetween(sorted[i - 1].date, sorted[i].date));
    }
    return intervals;
  }

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private stdDeviation(values: number[], mean: number): number {
    if (values.length < 2) return 0;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return Math.sqrt(this.mean(squaredDiffs));
  }

  private classifyFrequency(avgIntervalDays: number): PatternFrequency {
    if (avgIntervalDays <= 2) return 'daily';
    if (avgIntervalDays <= 10) return 'weekly';
    if (avgIntervalDays <= 45) return 'monthly';
    return 'irregular';
  }
}

import { AlertLevelValue } from '../../../domain/value-objects/AlertLevel';
import { PatternFrequency } from '../../../domain/services/TemporalAnalysisService';

export interface SymptomPatternResult {
  symptom: string;
  occurrenceCount: number;
  firstSeen: string;
  lastSeen: string;
  frequency: PatternFrequency;
  averageIntervalDays: number;
  noteIds: string[];
  alertLevel: AlertLevelValue;
  clinicalSignificance: string;
}

export interface DetectPatternAnomaliesResponse {
  patterns: SymptomPatternResult[];
  metadata: {
    notesAnalyzed: number;
    uniqueSymptomsFound: number;
    recurringPatterns: number;
    processingTimeMs: number;
  };
}

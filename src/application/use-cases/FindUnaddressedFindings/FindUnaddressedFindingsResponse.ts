import { UrgencyLevel, FindingType } from '../../../domain/entities/Finding';
import { AlertLevelValue } from '../../../domain/value-objects/AlertLevel';

export interface UnaddressedFinding {
  id: string;
  type: FindingType;
  test: string;
  value: string;
  referenceRange?: string;
  date: string;
  abnormal: boolean;
  followUpDocumented: boolean;
  daysSinceResult: number;
  urgency: UrgencyLevel;
  alertLevel: AlertLevelValue;
  clinicalSignificance: string;
  alertMessage: string;
  evidence: {
    resultNoteId: string;
    searchedNotesCount: number;
    lastReviewDate?: string;
  };
}

export interface FindUnaddressedFindingsResponse {
  findings: UnaddressedFinding[];
  prioritized: UnaddressedFinding[];
  metadata: {
    totalFindingsReviewed: number;
    unaddressedCount: number;
    processingTimeMs: number;
  };
}

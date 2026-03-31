import { AlertLevelValue } from '../../../domain/value-objects/AlertLevel';

export interface AllergyListItem {
  substance: string;
  reaction: string;
  severity: string;
  source: 'allergy-list';
}

export interface AllergyMention {
  substance: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  date?: string;
  noteExcerpt: string;
  noteId: string;
  inAllergyList: boolean;
  alertLevel: AlertLevelValue;
  confidenceScore: number;
}

export interface ExtractHiddenAllergiesResponse {
  documentedAllergies: AllergyListItem[];
  noteMentions: AllergyMention[];
  criticalFindings: AllergyMention[];
  metadata: {
    notesAnalyzed: number;
    processingTimeMs: number;
    confidenceScore: number;
  };
}

import { Allergy } from '../entities/Allergy';
import { AlertLevelValue } from '../value-objects/AlertLevel';

export interface HiddenAllergyResult {
  substance: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  inAllergyList: boolean;
  alertLevel: AlertLevelValue;
  noteId?: string;
  noteExcerpt?: string;
  confidenceScore: number;
}

/**
 * AllergyDomainService — cross-reference documented allergies against note mentions.
 * This is a domain service because the logic spans multiple entities (Patient + Allergy).
 */
export class AllergyDomainService {
  crossReference(
    documentedAllergies: readonly Allergy[],
    noteMentions: Allergy[]
  ): HiddenAllergyResult[] {
    return noteMentions.map((mention) => ({
      substance: mention.substance,
      reaction: mention.reaction,
      severity: mention.severity,
      inAllergyList: this.isDocumented(documentedAllergies, mention),
      alertLevel: mention.alertLevel,
      noteId: mention.noteId,
      noteExcerpt: mention.noteExcerpt,
      confidenceScore: mention.confidenceScore,
    }));
  }

  filterCritical(results: HiddenAllergyResult[]): HiddenAllergyResult[] {
    return results.filter(
      (r) => !r.inAllergyList && r.alertLevel === AlertLevelValue.CRITICAL
    );
  }

  private isDocumented(
    documented: readonly Allergy[],
    mention: Allergy
  ): boolean {
    const normalizedMention = mention.getSubstanceNormalized();
    return documented.some(
      (a) => a.getSubstanceNormalized() === normalizedMention
    );
  }
}

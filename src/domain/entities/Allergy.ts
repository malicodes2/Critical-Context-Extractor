import { ValidationError } from '../../shared/errors/ValidationError';
import { AlertLevelValue } from '../value-objects/AlertLevel';

export interface AllergyProps {
  substance: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  dateRecorded?: Date;
  source?: 'allergy-list' | 'clinical-note';
  noteId?: string;
  noteExcerpt?: string;
  confidenceScore?: number;
}

/**
 * Allergy — immutable value object (no independent identity).
 * Represents an allergic reaction, either from the official list or extracted from notes.
 */
export class Allergy {
  public readonly substance: string;
  public readonly reaction: string;
  public readonly severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  public readonly dateRecorded?: Date;
  public readonly source: 'allergy-list' | 'clinical-note';
  public readonly noteId?: string;
  public readonly noteExcerpt?: string;
  public readonly confidenceScore: number;

  constructor(props: AllergyProps) {
    if (!props.substance || props.substance.trim().length === 0) {
      throw new ValidationError('Allergy substance is required', 'substance');
    }
    if (!props.reaction || props.reaction.trim().length === 0) {
      throw new ValidationError('Allergy reaction is required', 'reaction');
    }

    this.substance = props.substance.trim();
    this.reaction = props.reaction.trim();
    this.severity = props.severity;
    this.dateRecorded = props.dateRecorded;
    this.source = props.source ?? 'allergy-list';
    this.noteId = props.noteId;
    this.noteExcerpt = props.noteExcerpt;
    this.confidenceScore = props.confidenceScore ?? 1.0;
  }

  get alertLevel(): AlertLevelValue {
    if (this.severity === 'life-threatening' || this.severity === 'severe') {
      return AlertLevelValue.CRITICAL;
    }
    if (this.severity === 'moderate') {
      return AlertLevelValue.WARNING;
    }
    return AlertLevelValue.INFO;
  }

  getSubstanceNormalized(): string {
    return this.substance.toLowerCase().trim();
  }

  withSeverity(
    newSeverity: 'mild' | 'moderate' | 'severe' | 'life-threatening'
  ): Allergy {
    return new Allergy({ ...this.toProps(), severity: newSeverity });
  }

  toProps(): AllergyProps {
    return {
      substance: this.substance,
      reaction: this.reaction,
      severity: this.severity,
      dateRecorded: this.dateRecorded,
      source: this.source,
      noteId: this.noteId,
      noteExcerpt: this.noteExcerpt,
      confidenceScore: this.confidenceScore,
    };
  }

  isSameSubstanceAs(other: Allergy): boolean {
    return this.getSubstanceNormalized() === other.getSubstanceNormalized();
  }
}

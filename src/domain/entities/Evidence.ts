import { ValidationError } from '../../shared/errors/ValidationError';
import { AlertLevelValue } from '../value-objects/AlertLevel';

export type EvidenceType =
  | 'hidden_allergy'
  | 'unaddressed_finding'
  | 'pattern_anomaly'
  | 'family_history'
  | 'contradiction'
  | 'specialist_recommendation';

export interface EvidenceSource {
  noteId: string;
  excerpt: string;
  date: Date;
}

export interface EvidenceProps {
  id: string;
  type: EvidenceType;
  title: string;
  description: string;
  alertLevel: AlertLevelValue;
  sources: EvidenceSource[];
  confidenceScore: number;
  metadata?: Record<string, unknown>;
}

/**
 * Evidence — entity representing a piece of critical clinical evidence extracted by AI.
 */
export class Evidence {
  public readonly id: string;
  public readonly type: EvidenceType;
  public readonly title: string;
  public readonly description: string;
  public readonly alertLevel: AlertLevelValue;
  public readonly sources: readonly EvidenceSource[];
  public readonly confidenceScore: number;
  public readonly metadata: Record<string, unknown>;

  constructor(props: EvidenceProps) {
    if (!props.id) throw new ValidationError('Evidence ID is required', 'id');
    if (!props.title) throw new ValidationError('Evidence title is required', 'title');
    if (props.confidenceScore < 0 || props.confidenceScore > 1) {
      throw new ValidationError(
        'Confidence score must be between 0 and 1',
        'confidenceScore',
        props.confidenceScore
      );
    }

    this.id = props.id;
    this.type = props.type;
    this.title = props.title;
    this.description = props.description;
    this.alertLevel = props.alertLevel;
    this.sources = Object.freeze([...props.sources]);
    this.confidenceScore = props.confidenceScore;
    this.metadata = props.metadata ?? {};
  }

  isCritical(): boolean {
    return this.alertLevel === AlertLevelValue.CRITICAL;
  }

  isHighConfidence(): boolean {
    return this.confidenceScore >= 0.8;
  }

  primarySource(): EvidenceSource | undefined {
    return this.sources[0];
  }
}

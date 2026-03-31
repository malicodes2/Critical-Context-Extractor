import { ValidationError } from '../../shared/errors/ValidationError';
import { AlertLevelValue } from '../value-objects/AlertLevel';
import { daysBetween, today } from '../../shared/utils/DateUtils';

export type FindingType = 'Lab Result' | 'Imaging' | 'Pathology' | 'Vital Sign';
export type UrgencyLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

const CRITICAL_TESTS = [
  'PSA', 'CA-125', 'CEA', 'Troponin', 'D-Dimer', 'BNP',
  'Hemoglobin A1c', 'Creatinine', 'eGFR',
];

export interface FindingProps {
  id: string;
  type: FindingType;
  test: string;
  value: string;
  referenceRange?: string;
  date: Date;
  abnormal: boolean;
  followUpDocumented: boolean;
  clinicalSignificance?: string;
  noteId: string;
  searchedNotesCount?: number;
  lastReviewDate?: Date;
}

/**
 * Finding — entity representing an abnormal diagnostic result.
 */
export class Finding {
  public readonly id: string;
  public readonly type: FindingType;
  public readonly test: string;
  public readonly value: string;
  public readonly referenceRange?: string;
  public readonly date: Date;
  public readonly abnormal: boolean;
  public readonly followUpDocumented: boolean;
  public readonly clinicalSignificance: string;
  public readonly noteId: string;
  public readonly searchedNotesCount: number;
  public readonly lastReviewDate?: Date;

  constructor(props: FindingProps) {
    if (!props.id) throw new ValidationError('Finding ID is required', 'id');
    if (!props.test) throw new ValidationError('Test name is required', 'test');

    this.id = props.id;
    this.type = props.type;
    this.test = props.test;
    this.value = props.value;
    this.referenceRange = props.referenceRange;
    this.date = props.date;
    this.abnormal = props.abnormal;
    this.followUpDocumented = props.followUpDocumented;
    this.clinicalSignificance = props.clinicalSignificance ?? '';
    this.noteId = props.noteId;
    this.searchedNotesCount = props.searchedNotesCount ?? 0;
    this.lastReviewDate = props.lastReviewDate;
  }

  get daysSinceResult(): number {
    return daysBetween(this.date, today());
  }

  get alertLevel(): AlertLevelValue {
    if (this.urgency === 'CRITICAL') return AlertLevelValue.CRITICAL;
    if (this.urgency === 'HIGH') return AlertLevelValue.WARNING;
    return AlertLevelValue.INFO;
  }

  get urgency(): UrgencyLevel {
    const days = this.daysSinceResult;
    const isCriticalTest = CRITICAL_TESTS.some(
      (t) => this.test.toUpperCase().includes(t.toUpperCase())
    );

    if (isCriticalTest && !this.followUpDocumented && days > 90) return 'CRITICAL';
    if (this.abnormal && !this.followUpDocumented && days > 180) return 'HIGH';
    if (this.abnormal && !this.followUpDocumented && days > 30) return 'MEDIUM';
    return 'LOW';
  }

  get alertMessage(): string {
    const days = this.daysSinceResult;
    return (
      `${this.test} (${this.value}) was abnormal ${days} days ago ` +
      (this.followUpDocumented ? 'and has been addressed.' : 'with no documented follow-up.')
    );
  }
}

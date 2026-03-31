import { parseISODate } from '../../shared/utils/DateUtils';
import { ValidationError } from '../../shared/errors/ValidationError';

export interface ClinicalNoteProps {
  id: string;
  patientId: string;
  text: string;
  date: Date;
  noteType?: string;
  authorRole?: string;
  sourceResourceId?: string;
}

/**
 * ClinicalNote — domain entity representing an unstructured clinical document.
 */
export class ClinicalNote {
  private readonly _id: string;
  private readonly _patientId: string;
  private readonly _text: string;
  private readonly _date: Date;
  private readonly _noteType: string;
  private readonly _authorRole: string;
  private readonly _sourceResourceId?: string;

  constructor(props: ClinicalNoteProps) {
    if (!props.id) throw new ValidationError('Note ID is required', 'id');
    if (!props.patientId) throw new ValidationError('Patient ID is required', 'patientId');
    if (!props.text || props.text.trim().length === 0) {
      throw new ValidationError('Note text cannot be empty', 'text');
    }

    this._id = props.id;
    this._patientId = props.patientId;
    this._text = props.text;
    this._date = props.date;
    this._noteType = props.noteType ?? 'clinical-note';
    this._authorRole = props.authorRole ?? 'unknown';
    this._sourceResourceId = props.sourceResourceId;
  }

  get id(): string { return this._id; }
  get patientId(): string { return this._patientId; }
  get text(): string { return this._text; }
  get date(): Date { return new Date(this._date); }
  get noteType(): string { return this._noteType; }
  get authorRole(): string { return this._authorRole; }
  get sourceResourceId(): string | undefined { return this._sourceResourceId; }

  get wordCount(): number {
    return this._text.split(/\s+/).filter(Boolean).length;
  }

  containsKeyword(keyword: string): boolean {
    return this._text.toLowerCase().includes(keyword.toLowerCase());
  }

  static fromFHIR(id: string, patientId: string, text: string, dateStr: string): ClinicalNote {
    const date = parseISODate(dateStr) ?? new Date();
    return new ClinicalNote({ id, patientId, text, date });
  }
}

import { ValidationError } from '../../shared/errors/ValidationError';
import { PatientId } from '../value-objects/PatientId';
import { ClinicalNote } from './ClinicalNote';
import { Allergy } from './Allergy';
import { Finding } from './Finding';

export interface PatientDemographics {
  givenName?: string;
  familyName?: string;
  birthDate?: Date;
  gender?: string;
}

export interface PatientProps {
  id: PatientId;
  demographics?: PatientDemographics;
  notes?: ClinicalNote[];
  allergies?: Allergy[];
  findings?: Finding[];
}

/**
 * Patient — aggregate root.
 * Encapsulates all clinical data and enforces business invariants.
 */
export class Patient {
  private readonly _id: PatientId;
  private readonly _demographics: PatientDemographics;
  private _notes: ClinicalNote[];
  private _allergies: Allergy[];
  private _findings: Finding[];

  constructor(props: PatientProps) {
    if (!props.id) throw new ValidationError('Patient ID is required', 'id');

    this._id = props.id;
    this._demographics = props.demographics ?? {};
    this._notes = [...(props.notes ?? [])];
    this._allergies = [...(props.allergies ?? [])];
    this._findings = [...(props.findings ?? [])];
  }

  get id(): PatientId { return this._id; }
  get demographics(): PatientDemographics { return { ...this._demographics }; }

  getNotes(): readonly ClinicalNote[] {
    return Object.freeze([...this._notes]);
  }

  getAllergies(): readonly Allergy[] {
    return Object.freeze([...this._allergies]);
  }

  getFindings(): readonly Finding[] {
    return Object.freeze([...this._findings]);
  }

  addNote(note: ClinicalNote): void {
    if (note.patientId !== this._id.value) {
      throw new ValidationError('Note does not belong to this patient', 'patientId');
    }
    this._notes.push(note);
  }

  addAllergy(allergy: Allergy): void {
    this._allergies.push(allergy);
  }

  addFinding(finding: Finding): void {
    this._findings.push(finding);
  }

  hasDocumentedAllergy(substanceName: string): boolean {
    const normalized = substanceName.toLowerCase().trim();
    return this._allergies.some(
      (a) =>
        a.source === 'allergy-list' &&
        a.getSubstanceNormalized() === normalized
    );
  }

  get noteCount(): number { return this._notes.length; }
  get allergyCount(): number { return this._allergies.length; }
  get findingCount(): number { return this._findings.length; }

  getAgeYears(): number | undefined {
    if (!this._demographics.birthDate) return undefined;
    const today = new Date();
    const birth = this._demographics.birthDate;
    const age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      return age - 1;
    }
    return age;
  }

  static create(id: string, demographics?: PatientDemographics): Patient {
    return new Patient({ id: PatientId.create(id), demographics });
  }
}

import { DomainError } from './DomainError';

export class PatientNotFoundError extends DomainError {
  public readonly patientId: string;

  constructor(patientId: string) {
    super(`Patient not found: ${patientId}`, 'PATIENT_NOT_FOUND', true);
    this.patientId = patientId;
  }
}

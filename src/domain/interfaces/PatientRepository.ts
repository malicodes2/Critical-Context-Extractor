import { Patient } from '../entities/Patient';
import { PatientId } from '../value-objects/PatientId';

/**
 * PatientRepository — port interface for patient data access.
 * Implemented by infrastructure layer (FHIR, mock, etc.)
 */
export interface PatientRepository {
  findById(id: PatientId, fhirToken?: string): Promise<Patient | null>;
  findByNaturalId(naturalId: string, fhirToken?: string): Promise<Patient | null>;
}

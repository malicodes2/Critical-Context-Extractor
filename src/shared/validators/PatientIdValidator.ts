import { z } from 'zod';
import { ValidationError } from '../errors/ValidationError';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PatientIdSchema = z.string().regex(UUID_REGEX, 'Invalid UUID format');

export interface PatientIdValidationResult {
  isValid: boolean;
  error?: string;
}

export function validatePatientId(id: string): PatientIdValidationResult {
  const result = PatientIdSchema.safeParse(id);
  if (!result.success) {
    return { isValid: false, error: result.error.message };
  }
  return { isValid: true };
}

export function assertValidPatientId(id: string): void {
  const result = validatePatientId(id);
  if (!result.isValid) {
    throw new ValidationError(
      `Invalid patient ID: ${result.error ?? 'Unknown validation error'}`,
      'patientId',
      id
    );
  }
}

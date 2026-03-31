import { ValidationError } from '../../shared/errors/ValidationError';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PatientId — immutable value object wrapping a validated UUID.
 */
export class PatientId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || !UUID_REGEX.test(value)) {
      throw new ValidationError(`Invalid patient ID format: "${value}"`, 'patientId', value);
    }
    this._value = value.toLowerCase();
  }

  get value(): string {
    return this._value;
  }

  equals(other: PatientId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  static create(value: string): PatientId {
    return new PatientId(value);
  }
}

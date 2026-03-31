import { DomainError } from './DomainError';

export class ValidationError extends DomainError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super(message, 'VALIDATION_ERROR', true);
    this.field = field;
    this.value = value;
  }
}

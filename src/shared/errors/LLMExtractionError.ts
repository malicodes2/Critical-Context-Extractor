import { DomainError } from './DomainError';

export class LLMExtractionError extends DomainError {
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message, 'LLM_EXTRACTION_FAILED', true);
    this.cause = cause;
  }
}

import { DomainError } from './DomainError';

export class FHIRResourceError extends DomainError {
  public readonly resourceType?: string;
  public readonly statusCode?: number;

  constructor(message: string, resourceType?: string, statusCode?: number) {
    super(message, 'FHIR_RESOURCE_ERROR', true);
    this.resourceType = resourceType;
    this.statusCode = statusCode;
  }
}

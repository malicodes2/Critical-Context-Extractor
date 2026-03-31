import { ServerResponse } from 'http';
import { DomainError } from '../../shared/errors/DomainError';
import { ValidationError } from '../../shared/errors/ValidationError';
import { PatientNotFoundError } from '../../shared/errors/PatientNotFoundError';
import { ILogger } from '../../domain/interfaces/ILogger';

/**
 * ErrorHandlingMiddleware — converts errors to structured HTTP responses.
 * Maps domain errors to appropriate HTTP status codes.
 */
export class ErrorHandlingMiddleware {
  constructor(private readonly _logger: ILogger) {}

  handle(err: unknown, res: ServerResponse): void {
    if (err instanceof PatientNotFoundError) {
      this.send(res, 404, err.code, err.message);
      return;
    }

    if (err instanceof ValidationError) {
      this.send(res, 400, err.code, err.message);
      return;
    }

    if (err instanceof DomainError && err.isOperational) {
      this.send(res, 422, err.code, err.message);
      return;
    }

    // Unexpected error — log full details, send generic message
    const message = err instanceof Error ? err.message : 'Internal server error';
    const error = err instanceof Error ? err : undefined;
    this._logger.error('Unhandled error', error, { path: 'unknown' });
    this.send(res, 500, 'INTERNAL_ERROR', message);
  }

  private send(
    res: ServerResponse,
    status: number,
    code: string,
    message: string
  ): void {
    if (res.headersSent) return;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: code, message, timestamp: new Date().toISOString() }));
  }
}

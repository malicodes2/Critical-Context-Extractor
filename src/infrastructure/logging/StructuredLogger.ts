import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import { ILogger, LogMetadata } from '../../domain/interfaces/ILogger';
import { hashPatientId, sanitizeForLogging } from '../../shared/utils/StringUtils';

const SERVICE_NAME = 'critical-context-extractor';

/**
 * StructuredLogger — Winston-based JSON logger.
 * PHI-safe: automatically hashes patient IDs and sanitizes sensitive data.
 */
export class StructuredLogger implements ILogger {
  private readonly _winston: WinstonLogger;
  private readonly _correlationId: string;

  constructor(correlationId: string = 'no-correlation-id') {
    this._correlationId = correlationId;
    this._winston = createLogger({
      level: process.env['LOG_LEVEL'] ?? 'info',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
        format.errors({ stack: true }),
        format.json()
      ),
      defaultMeta: {
        service: SERVICE_NAME,
        correlationId: this._correlationId,
      },
      transports: [new transports.Console()],
    });
  }

  debug(message: string, metadata?: LogMetadata): void {
    this._winston.debug(message, this.sanitize(metadata));
  }

  info(message: string, metadata?: LogMetadata): void {
    this._winston.info(message, this.sanitize(metadata));
  }

  warn(message: string, metadata?: LogMetadata): void {
    this._winston.warn(message, this.sanitize(metadata));
  }

  error(message: string, err?: Error, metadata?: LogMetadata): void {
    this._winston.error(message, {
      ...this.sanitize(metadata),
      error: err
        ? {
            message: err.message,
            name: err.name,
            stack: process.env['NODE_ENV'] !== 'production' ? err.stack : undefined,
          }
        : undefined,
    });
  }

  withCorrelationId(correlationId: string): StructuredLogger {
    return new StructuredLogger(correlationId);
  }

  private sanitize(metadata?: LogMetadata): LogMetadata {
    if (!metadata) return {};

    const result: LogMetadata = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (key.toLowerCase().includes('patientid') && typeof value === 'string') {
        result[key] = hashPatientId(value);
      } else if (typeof value === 'string') {
        result[key] = sanitizeForLogging(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}

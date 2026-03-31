/**
 * ILogger — port interface for structured logging (PHI-safe).
 */
export interface LogMetadata {
  [key: string]: unknown;
}

export interface ILogger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, error?: Error, metadata?: LogMetadata): void;
}

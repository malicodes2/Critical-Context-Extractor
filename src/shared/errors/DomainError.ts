/**
 * Abstract base class for all domain errors.
 * Provides structured error handling with operational vs programming error distinction.
 */
export abstract class DomainError extends Error {
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, code: string, isOperational: boolean = true) {
    super(message);
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    const errCtor = Error as { captureStackTrace?: (t: object, c: unknown) => void };
    if (errCtor.captureStackTrace) {
      errCtor.captureStackTrace(this, this.constructor);
    }
    this.name = this.constructor.name;
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      isOperational: this.isOperational,
    };
  }
}

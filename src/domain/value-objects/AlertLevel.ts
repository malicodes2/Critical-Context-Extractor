import { ValidationError } from '../../shared/errors/ValidationError';

export enum AlertLevelValue {
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

const ALERT_PRIORITY: Record<AlertLevelValue, number> = {
  [AlertLevelValue.CRITICAL]: 3,
  [AlertLevelValue.WARNING]: 2,
  [AlertLevelValue.INFO]: 1,
};

/**
 * AlertLevel — immutable value object for clinical alert prioritization.
 */
export class AlertLevel {
  private readonly _level: AlertLevelValue;

  constructor(level: string) {
    const normalized = level.toUpperCase().trim();
    const valid = Object.values(AlertLevelValue).find((v) => v === normalized);
    if (!valid) {
      throw new ValidationError(
        `Invalid alert level: "${level}". Valid: CRITICAL, WARNING, INFO`,
        'alertLevel',
        level
      );
    }
    this._level = valid;
  }

  get level(): AlertLevelValue {
    return this._level;
  }

  get value(): string {
    return this._level;
  }

  get priority(): number {
    return ALERT_PRIORITY[this._level];
  }

  isCritical(): boolean {
    return this._level === AlertLevelValue.CRITICAL;
  }

  isHigherThan(other: AlertLevel): boolean {
    return this.priority > other.priority;
  }

  equals(other: AlertLevel): boolean {
    return this._level === other._level;
  }

  toString(): string {
    return this._level;
  }

  static critical(): AlertLevel {
    return new AlertLevel(AlertLevelValue.CRITICAL);
  }

  static warning(): AlertLevel {
    return new AlertLevel(AlertLevelValue.WARNING);
  }

  static info(): AlertLevel {
    return new AlertLevel(AlertLevelValue.INFO);
  }
}

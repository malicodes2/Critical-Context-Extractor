import { ValidationError } from '../../shared/errors/ValidationError';

export enum SeverityLevel {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  LIFE_THREATENING = 'life-threatening',
}

const SEVERITY_PRIORITY: Record<SeverityLevel, number> = {
  [SeverityLevel.MILD]: 1,
  [SeverityLevel.MODERATE]: 2,
  [SeverityLevel.SEVERE]: 3,
  [SeverityLevel.LIFE_THREATENING]: 4,
};

/**
 * Severity — immutable value object for clinical severity classification.
 */
export class Severity {
  private readonly _level: SeverityLevel;

  constructor(level: string) {
    const normalized = level.toLowerCase().trim();
    const valid = Object.values(SeverityLevel).find((v) => v === normalized);
    if (!valid) {
      throw new ValidationError(
        `Invalid severity level: "${level}". ` +
          `Valid values: ${Object.values(SeverityLevel).join(', ')}`,
        'severity',
        level
      );
    }
    this._level = valid;
  }

  get level(): SeverityLevel {
    return this._level;
  }

  get value(): string {
    return this._level;
  }

  get priority(): number {
    return SEVERITY_PRIORITY[this._level];
  }

  isHigherThan(other: Severity): boolean {
    return this.priority > other.priority;
  }

  isLifeThreatening(): boolean {
    return this._level === SeverityLevel.LIFE_THREATENING;
  }

  equals(other: Severity): boolean {
    return this._level === other._level;
  }

  toString(): string {
    return this._level;
  }

  static mild(): Severity {
    return new Severity(SeverityLevel.MILD);
  }

  static moderate(): Severity {
    return new Severity(SeverityLevel.MODERATE);
  }

  static severe(): Severity {
    return new Severity(SeverityLevel.SEVERE);
  }

  static lifeThreateningValue(): Severity {
    return new Severity(SeverityLevel.LIFE_THREATENING);
  }
}

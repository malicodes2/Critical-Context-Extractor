import { PatientId } from '../../../src/domain/value-objects/PatientId';
import { Severity } from '../../../src/domain/value-objects/Severity';
import { AlertLevel } from '../../../src/domain/value-objects/AlertLevel';
import { DateRange } from '../../../src/domain/value-objects/DateRange';
import { ValidationError } from '../../../src/shared/errors/ValidationError';

describe('PatientId', () => {
  it('should create valid PatientId from UUID', () => {
    const id = PatientId.create('550e8400-e29b-41d4-a716-446655440000');
    expect(id.value).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should throw ValidationError for non-UUID string', () => {
    expect(() => PatientId.create('not-a-uuid')).toThrow(ValidationError);
  });

  it('should throw ValidationError for empty string', () => {
    expect(() => PatientId.create('')).toThrow(ValidationError);
  });

  it('should report equality correctly', () => {
    const id1 = PatientId.create('550e8400-e29b-41d4-a716-446655440000');
    const id2 = PatientId.create('550e8400-e29b-41d4-a716-446655440000');
    const id3 = PatientId.create('660e8400-e29b-41d4-a716-446655440001');
    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
  });
});

describe('Severity', () => {
  it('should create valid severity levels', () => {
    expect(Severity.mild().level).toBe('mild');
    expect(Severity.severe().level).toBe('severe');
    expect(Severity.lifeThreateningValue().level).toBe('life-threatening');
  });

  it('should correctly determine isLifeThreatening', () => {
    expect(Severity.lifeThreateningValue().isLifeThreatening()).toBe(true);
    expect(Severity.severe().isLifeThreatening()).toBe(false);
  });

  it('should correctly compare priority order', () => {
    expect(Severity.severe().isHigherThan(Severity.mild())).toBe(true);
    expect(Severity.mild().isHigherThan(Severity.severe())).toBe(false);
  });

  it('should throw for invalid severity', () => {
    expect(() => new Severity('unknown')).toThrow(ValidationError);
  });
});

describe('AlertLevel', () => {
  it('should create alert levels', () => {
    expect(AlertLevel.critical().level).toBe('CRITICAL');
    expect(AlertLevel.warning().level).toBe('WARNING');
    expect(AlertLevel.info().level).toBe('INFO');
  });

  it('should identify critical correctly', () => {
    expect(AlertLevel.critical().isCritical()).toBe(true);
    expect(AlertLevel.warning().isCritical()).toBe(false);
  });

  it('should compare priorities', () => {
    expect(AlertLevel.critical().isHigherThan(AlertLevel.warning())).toBe(true);
    expect(AlertLevel.info().isHigherThan(AlertLevel.critical())).toBe(false);
  });
});

describe('DateRange', () => {
  it('should create valid date ranges', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-12-31');
    const range = new DateRange(start, end);
    expect(range.durationDays).toBe(365);
  });

  it('should throw when start > end', () => {
    expect(
      () => new DateRange(new Date('2024-12-31'), new Date('2024-01-01'))
    ).toThrow(ValidationError);
  });

  it('should detect if date is contained', () => {
    const range = new DateRange(new Date('2024-01-01'), new Date('2024-12-31'));
    expect(range.contains(new Date('2024-06-15'))).toBe(true);
    expect(range.contains(new Date('2025-01-01'))).toBe(false);
  });

  it('should create last N months ranges', () => {
    const range = DateRange.lastMonths(6);
    expect(range.durationDays).toBeLessThan(185);
    expect(range.durationDays).toBeGreaterThan(175);
  });
});

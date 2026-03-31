import { assertValidDateRange } from '../../shared/validators/DateRangeValidator';
import { daysBetween } from '../../shared/utils/DateUtils';

/**
 * DateRange — immutable value object representing a clinical time window.
 */
export class DateRange {
  private readonly _start: Date;
  private readonly _end: Date;

  constructor(start: Date, end: Date) {
    assertValidDateRange(start, end);
    this._start = new Date(start);
    this._end = new Date(end);
  }

  get start(): Date {
    return new Date(this._start);
  }

  get end(): Date {
    return new Date(this._end);
  }

  get durationDays(): number {
    return daysBetween(this._start, this._end);
  }

  contains(date: Date): boolean {
    return date >= this._start && date <= this._end;
  }

  overlaps(other: DateRange): boolean {
    return this._start <= other._end && this._end >= other._start;
  }

  equals(other: DateRange): boolean {
    return (
      this._start.getTime() === other._start.getTime() &&
      this._end.getTime() === other._end.getTime()
    );
  }

  static lastMonths(months: number): DateRange {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    return new DateRange(start, end);
  }

  static lastYears(years: number): DateRange {
    return DateRange.lastMonths(years * 12);
  }
}

import { ValidationError } from '../errors/ValidationError';

export interface DateRangeValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateDateRange(
  startDate: Date,
  endDate: Date
): DateRangeValidationResult {
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    return { isValid: false, error: 'Start date is invalid' };
  }
  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    return { isValid: false, error: 'End date is invalid' };
  }
  if (startDate > endDate) {
    return { isValid: false, error: 'Start date must be before or equal to end date' };
  }
  return { isValid: true };
}

export function assertValidDateRange(startDate: Date, endDate: Date): void {
  const result = validateDateRange(startDate, endDate);
  if (!result.isValid) {
    throw new ValidationError(
      `Invalid date range: ${result.error ?? 'Unknown error'}`,
      'dateRange'
    );
  }
}

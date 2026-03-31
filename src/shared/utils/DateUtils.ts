/**
 * Utility functions for date manipulation in clinical contexts.
 */

/** Return ISO 8601 string for a date */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/** Calculate number of days between two dates */
export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(Math.abs(to.getTime() - from.getTime()) / msPerDay);
}

/** Return today's date (start of day, UTC) */
export function today(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Parse an ISO date string safely — returns null if invalid */
export function parseISODate(isoString: string): Date | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  return isNaN(d.getTime()) ? null : d;
}

/** Format a date for display in clinical context */
export function formatClinicalDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Check if a date is within the past N months */
export function isWithinMonths(date: Date, months: number): boolean {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return date >= cutoff;
}

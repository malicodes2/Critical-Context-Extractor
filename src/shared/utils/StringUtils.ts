/**
 * Utility functions for string manipulation in clinical contexts.
 */

/** Truncate a string to a max length and append ellipsis */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/** Normalize whitespace in clinical text */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Extract a contextual excerpt around a keyword */
export function extractExcerpt(
  text: string,
  keyword: string,
  contextChars: number = 100
): string {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const idx = lowerText.indexOf(lowerKeyword);
  if (idx === -1) return truncate(text, contextChars * 2);

  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + keyword.length + contextChars);
  const excerpt = text.slice(start, end);
  return truncate(normalizeWhitespace(excerpt), 200);
}

/** Hash a patient ID for PHI-safe logging */
export function hashPatientId(patientId: string): string {
  let hash = 0;
  for (let i = 0; i < patientId.length; i++) {
    const char = patientId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `pid_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/** Sanitize text to remove potential PII patterns */
export function sanitizeForLogging(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b\d{10,}\b/g, '[ID]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]');
}

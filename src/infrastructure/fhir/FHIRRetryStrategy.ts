/**
 * Exponential backoff retry strategy with jitter for FHIR API calls.
 */
const MAX_RETRY_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 10000;

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? MAX_RETRY_ATTEMPTS;
  const baseDelay = options.baseDelayMs ?? BASE_DELAY_MS;
  const maxDelay = options.maxDelayMs ?? MAX_DELAY_MS;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === maxAttempts) break;

      const delay = calculateDelay(attempt, baseDelay, maxDelay);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Operation failed after retries');
}

function calculateDelay(attempt: number, base: number, max: number): number {
  const exponential = base * Math.pow(2, attempt - 1);
  const jitter = Math.random() * base;
  return Math.min(exponential + jitter, max);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

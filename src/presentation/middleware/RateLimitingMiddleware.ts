import { IncomingMessage, ServerResponse } from 'http';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,   // 1 minute
  maxRequests: 60,    // 60 req/min
};

/**
 * RateLimitingMiddleware — sliding window rate limiter keyed by IP.
 * No external dependencies — pure in-memory implementation.
 */
export class RateLimitingMiddleware {
  private readonly _store = new Map<string, WindowEntry>();
  private readonly _config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    // Periodic cleanup to avoid memory leaks
    setInterval(() => this.cleanup(), this._config.windowMs * 2);
  }

  /**
   * Returns true if the request is ALLOWED, false if rate-limited.
   * Writes 429 response automatically when limited.
   */
  check(req: IncomingMessage, res: ServerResponse): boolean {
    const ip = this.extractIP(req);
    const now = Date.now();
    const entry = this._store.get(ip);

    if (!entry || now >= entry.resetAt) {
      this._store.set(ip, { count: 1, resetAt: now + this._config.windowMs });
      this.setHeaders(res, this._config.maxRequests - 1, this._config.windowMs);
      return true;
    }

    entry.count += 1;
    const remaining = Math.max(0, this._config.maxRequests - entry.count);
    this.setHeaders(res, remaining, entry.resetAt - now);

    if (entry.count > this._config.maxRequests) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Try again in ${Math.ceil((entry.resetAt - now) / 1000)}s.`,
          retryAfterMs: entry.resetAt - now,
        })
      );
      return false;
    }

    return true;
  }

  private extractIP(req: IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return req.socket?.remoteAddress ?? 'unknown';
  }

  private setHeaders(res: ServerResponse, remaining: number, resetMs: number): void {
    res.setHeader('X-RateLimit-Limit', this._config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetMs / 1000));
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this._store) {
      if (now >= entry.resetAt) this._store.delete(key);
    }
  }
}

import { IncomingMessage, ServerResponse } from 'http';

const ALLOWED_API_KEYS = new Set(
  (process.env['API_KEYS'] ?? '').split(',').filter(Boolean)
);

/**
 * AuthenticationMiddleware — validates Bearer token / API key.
 * Prompt Opinion injects the FHIR token separately; this guards the MCP endpoint itself.
 * Disabled in development if no API_KEYS env var is set.
 */
export class AuthenticationMiddleware {
  private readonly _bypassInDev: boolean;

  constructor() {
    this._bypassInDev =
      process.env['NODE_ENV'] !== 'production' && ALLOWED_API_KEYS.size === 0;
  }

  /**
   * Returns true if the request is AUTHENTICATED, false (and writes 401) if not.
   */
  check(req: IncomingMessage, res: ServerResponse): boolean {
    if (this._bypassInDev) return true;

    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';

    if (!token || !ALLOWED_API_KEYS.has(token)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Valid Bearer token required.',
        })
      );
      return false;
    }

    return true;
  }
}

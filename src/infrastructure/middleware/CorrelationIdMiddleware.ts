import { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * CorrelationIdMiddleware — extracts or generates a correlation ID per request.
 * Attaches it to the response header and returns it for logger context.
 */
export function correlationIdMiddleware(
  req: IncomingMessage,
  res: ServerResponse
): string {
  const existing = req.headers[CORRELATION_ID_HEADER];
  const correlationId =
    typeof existing === 'string' && existing.length > 0
      ? existing
      : randomUUID();

  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  return correlationId;
}

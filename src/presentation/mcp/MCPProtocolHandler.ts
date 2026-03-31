import { IncomingMessage, ServerResponse } from 'http';
import { ILogger } from '../../domain/interfaces/ILogger';

/**
 * MCPProtocolHandler — validates MCP JSON-RPC 2.0 message structure
 * before routing to the SDK transport.
 */
export class MCPProtocolHandler {
  constructor(private readonly _logger: ILogger) {}

  /**
   * Validates that the incoming payload is a valid JSON-RPC 2.0 request.
   * Returns the parsed payload or writes a 400 and returns null.
   */
  validate(
    rawBody: string,
    res: ServerResponse
  ): Record<string, unknown> | null {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      this.respond400(res, 'PARSE_ERROR', 'Request body is not valid JSON');
      return null;
    }

    if (payload['jsonrpc'] !== '2.0') {
      this.respond400(res, 'INVALID_REQUEST', 'jsonrpc must be "2.0"');
      return null;
    }

    if (typeof payload['method'] !== 'string' || !payload['method']) {
      this.respond400(res, 'INVALID_REQUEST', 'method is required');
      return null;
    }

    this._logger.debug('MCP request received', { method: payload['method'] as string });
    return payload;
  }

  private respond400(res: ServerResponse, code: string, message: string): void {
    if (res.headersSent) return;
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32600, message: `${code}: ${message}` },
        id: null,
      })
    );
  }
}

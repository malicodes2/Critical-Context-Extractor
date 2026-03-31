import { z, ZodSchema } from 'zod';
import { IncomingMessage, ServerResponse } from 'http';
import { ValidationError } from '../../shared/errors/ValidationError';

/**
 * ValidationMiddleware — runs Zod schema validation on MCP tool arguments.
 * Throws ValidationError for invalid inputs so MCPServer can format a clean 400.
 */
export class ValidationMiddleware {
  validate<T>(schema: ZodSchema<T>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      throw new ValidationError(`Invalid tool arguments: ${issues}`);
    }
    return result.data;
  }

  /**
   * Parses JSON body from HTTP request.
   */
  async parseBody(req: IncomingMessage, res: ServerResponse): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf-8');
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_JSON', message: 'Request body is not valid JSON.' }));
          reject(new ValidationError('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }
}

// Re-export Zod for convenience
export { z };

import 'dotenv/config';
import http from 'http';
import { MCPServer } from './presentation/mcp/MCPServer';
import { FHIRClient } from './infrastructure/fhir/FHIRClient';
import { FHIRPatientRepository } from './infrastructure/fhir/FHIRPatientRepository';
import { FHIRResourceMapper } from './infrastructure/fhir/FHIRResourceMapper';
import { GeminiClient } from './infrastructure/llm/GeminiClient';
import { StructuredLogger } from './infrastructure/logging/StructuredLogger';

const PORT = parseInt(process.env['MCP_SERVER_PORT'] ?? '3000', 10);
const FHIR_BASE_URL = process.env['FHIR_BASE_URL'] ?? 'https://hapi.fhir.org/baseR4';
const GEMINI_API_KEY = process.env['GEMINI_API_KEY'] ?? '';
const GEMINI_MODEL = process.env['GEMINI_MODEL'];

if (!GEMINI_API_KEY) {
  // eslint-disable-next-line no-console
  console.error('GEMINI_API_KEY is required. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

async function main(): Promise<void> {
  const logger = new StructuredLogger('startup');

  // Wire up infrastructure
  const fhirClient = new FHIRClient({ baseUrl: FHIR_BASE_URL });
  const mapper = new FHIRResourceMapper();
  const patientRepo = new FHIRPatientRepository(fhirClient, mapper, logger);
  const llmClient = new GeminiClient(GEMINI_API_KEY, logger, GEMINI_MODEL);

  // Build MCP server
  const mcpServer = new MCPServer(
    {
      name: 'critical-context-extractor',
      version: '1.0.0',
      port: PORT,
    },
    patientRepo,
    llmClient,
    logger
  );

  const server = mcpServer.getMcpServer();

  // HTTP server — Prompt Opinion uses streamable HTTP transport
  const httpServer = http.createServer(async (req, res) => {
    const url = req.url ?? '/';

    if (url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
      return;
    }

    if (url === '/mcp' || url.startsWith('/mcp/')) {
      const transport = mcpServer.getTransport();

      // Extract FHIR token from Authorization header (injected by Prompt Opinion)
      const authHeader = req.headers['authorization'];
      const fhirToken = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : undefined;

      if (fhirToken) {
        transport.onmessage = () => undefined; // handled by SDK
      }

      await server.connect(transport);

      const body: Buffer[] = [];
      req.on('data', (chunk: Buffer) => body.push(chunk));
      req.on('end', async () => {
        try {
          const rawBody = Buffer.concat(body).toString('utf-8');
          await transport.handleRequest(req, res, rawBody ? JSON.parse(rawBody) : undefined);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Bad Request' }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  httpServer.listen(PORT, () => {
    logger.info(`Critical Context Extractor MCP Server running`, { port: PORT });
    logger.info('Register at Prompt Opinion: <ngrok-url>/mcp');
    logger.info('Health check: http://localhost:' + String(PORT) + '/health');
  });

  const shutdown = (): void => {
    logger.info('Shutting down...');
    httpServer.close(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});

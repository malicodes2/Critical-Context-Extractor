export interface AppConfig {
  server: {
    port: number;
    host: string;
    requestTimeoutMs: number;
  };
  fhir: {
    baseUrl: string;
    timeoutMs: number;
    retryAttempts: number;
  };
  gemini: {
    apiKey: string;
    model: string;
    temperature: number;
  };
  cache: {
    strategy: 'memory' | 'redis';
    ttlSeconds: number;
    redisUrl?: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
  security: {
    apiKeys: string[];
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
}

export function loadConfig(): AppConfig {
  return {
    server: {
      port: parseInt(process.env['MCP_SERVER_PORT'] ?? '3000', 10),
      host: process.env['HOST'] ?? '0.0.0.0',
      requestTimeoutMs: parseInt(process.env['REQUEST_TIMEOUT_MS'] ?? '30000', 10),
    },
    fhir: {
      baseUrl: process.env['FHIR_BASE_URL'] ?? 'https://hapi.fhir.org/baseR4',
      timeoutMs: parseInt(process.env['FHIR_TIMEOUT_MS'] ?? '30000', 10),
      retryAttempts: parseInt(process.env['FHIR_RETRY_ATTEMPTS'] ?? '3', 10),
    },
    gemini: {
      apiKey: process.env['GEMINI_API_KEY'] ?? '',
      model: process.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash-preview-04-17',
      temperature: parseFloat(process.env['GEMINI_TEMPERATURE'] ?? '0.1'),
    },
    cache: {
      strategy: (process.env['CACHE_STRATEGY'] as 'memory' | 'redis') ?? 'memory',
      ttlSeconds: parseInt(process.env['CACHE_TTL_SECONDS'] ?? '3600', 10),
      redisUrl: process.env['REDIS_URL'],
    },
    logging: {
      level: (process.env['LOG_LEVEL'] as AppConfig['logging']['level']) ?? 'info',
    },
    security: {
      apiKeys: (process.env['API_KEYS'] ?? '').split(',').filter(Boolean),
      rateLimitWindowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] ?? '60000', 10),
      rateLimitMaxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] ?? '60', 10),
    },
  };
}

export function validateConfig(config: AppConfig): void {
  if (!config.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY is required. Copy .env.example to .env and set your key.');
  }
  if (config.server.port < 1 || config.server.port > 65535) {
    throw new Error(`Invalid port: ${config.server.port}`);
  }
}

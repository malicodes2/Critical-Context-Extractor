import { AppConfig } from './config';

export const developmentConfig: Partial<AppConfig> = {
  logging: { level: 'debug' },
  cache: { strategy: 'memory', ttlSeconds: 300 },
  security: {
    apiKeys: [],                  // bypass auth in dev
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 1000,   // relaxed for dev
  },
};

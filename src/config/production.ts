import { AppConfig } from './config';

export const productionConfig: Partial<AppConfig> = {
  logging: { level: 'warn' },
  cache: { strategy: 'redis', ttlSeconds: 3600 },
  security: {
    apiKeys: [],                  // loaded from API_KEYS env
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 60,
  },
};

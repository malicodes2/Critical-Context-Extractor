import { AppConfig } from './config';

export const testConfig: Partial<AppConfig> = {
  logging: { level: 'error' },   // silent in tests
  cache: { strategy: 'memory', ttlSeconds: 60 },
  security: {
    apiKeys: ['test-api-key'],
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 10000, // effectively unlimited for tests
  },
};

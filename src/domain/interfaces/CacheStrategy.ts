/**
 * CacheStrategy — port interface for caching (Redis, in-memory, etc.)
 */
export interface CacheStrategy {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

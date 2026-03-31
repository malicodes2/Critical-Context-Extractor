import { CacheStrategy } from '../../domain/interfaces/CacheStrategy';

/**
 * RedisCacheStrategy — production cache using Redis via TCP.
 * Falls back gracefully if Redis is unavailable.
 * Requires `redis` package: npm install redis
 */
export class RedisCacheStrategy implements CacheStrategy {
  private _client: RedisClientLike | null = null;

  constructor(private readonly _url: string = 'redis://localhost:6379') {}

  async connect(): Promise<void> {
    try {
      // Dynamically import to avoid hard dependency when Redis is unused
      const { createClient } = await import('redis' as string) as { createClient: (opts: object) => RedisClientLike };
      this._client = createClient({ url: this._url });
      await this._client.connect();
    } catch {
      // Redis unavailable — will fall through to cache miss on every get()
      this._client = null;
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this._client) return null;
    try {
      const raw = await this._client.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds = 3600): Promise<void> {
    if (!this._client) return;
    try {
      await this._client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch {
      // Silent fail — caching is best-effort
    }
  }

  async delete(key: string): Promise<void> {
    if (!this._client) return;
    try {
      await this._client.del(key);
    } catch {
      // Silent fail
    }
  }

  async clear(): Promise<void> {
    if (!this._client) return;
    try {
      await this._client.flushDb();
    } catch {
      // Silent fail
    }
  }

  async disconnect(): Promise<void> {
    if (!this._client) return;
    await this._client.disconnect();
  }
}

interface RedisClientLike {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { EX?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  flushDb(): Promise<unknown>;
}

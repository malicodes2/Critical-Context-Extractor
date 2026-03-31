import { CacheStrategy } from '../../domain/interfaces/CacheStrategy';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * InMemoryCacheStrategy — Map-backed TTL cache.
 * Used in development/testing; no external dependencies.
 */
export class InMemoryCacheStrategy implements CacheStrategy {
  private readonly _store = new Map<string, CacheEntry<unknown>>();

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this._store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T = unknown>(
    key: string,
    value: T,
    ttlSeconds: number = 3600
  ): Promise<void> {
    this._store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this._store.delete(key);
  }

  async clear(): Promise<void> {
    this._store.clear();
  }

  get size(): number {
    return this._store.size;
  }
}

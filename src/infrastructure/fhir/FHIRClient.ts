import { FHIRResourceError } from '../../shared/errors/FHIRResourceError';
import { withRetry } from './FHIRRetryStrategy';

export interface FHIRBundle<T> {
  resourceType: string;
  entry?: Array<{ resource?: T }>;
  total?: number;
  link?: Array<{ relation: string; url: string }>;
}

export interface FHIRClientOptions {
  baseUrl: string;
  token?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * FHIRClient — HTTP client for FHIR R4 API.
 * Supports Bearer token auth (injected per-request by Prompt Opinion).
 */
export class FHIRClient {
  private readonly _baseUrl: string;
  private readonly _timeoutMs: number;
  private _token?: string;

  constructor(options: FHIRClientOptions) {
    this._baseUrl = options.baseUrl.replace(/\/$/, '');
    this._token = options.token;
    this._timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  setToken(token: string): void {
    this._token = token;
  }

  async getResource<T>(resourceType: string, id: string): Promise<T> {
    const url = `${this._baseUrl}/${resourceType}/${id}`;
    return withRetry(() => this.fetchJSON<T>(url));
  }

  async searchResources<T>(
    resourceType: string,
    params: Record<string, string>
  ): Promise<FHIRBundle<T>> {
    const queryString = new URLSearchParams(params).toString();
    const url = `${this._baseUrl}/${resourceType}?${queryString}`;
    return withRetry(() => this.fetchJSON<FHIRBundle<T>>(url));
  }

  async *paginatedSearch<T>(
    resourceType: string,
    params: Record<string, string>
  ): AsyncGenerator<T> {
    let nextUrl: string | undefined =
      `${this._baseUrl}/${resourceType}?${new URLSearchParams(params).toString()}`;

    while (nextUrl) {
      const bundle = await withRetry(
        () => this.fetchJSON<FHIRBundle<T>>(nextUrl as string)
      );

      for (const entry of bundle.entry ?? []) {
        if (entry.resource) yield entry.resource;
      }

      const nextLink = bundle.link?.find((l) => l.relation === 'next');
      nextUrl = nextLink?.url;
    }
  }

  private async fetchJSON<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this._timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/fhir+json',
        Accept: 'application/fhir+json',
      };

      if (this._token) {
        headers['Authorization'] = `Bearer ${this._token}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new FHIRResourceError(
          `FHIR request failed: ${response.status} ${response.statusText} — ${url}`,
          undefined,
          response.status
        );
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof FHIRResourceError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new FHIRResourceError(`FHIR network error: ${message}`, undefined);
    } finally {
      clearTimeout(timeout);
    }
  }
}

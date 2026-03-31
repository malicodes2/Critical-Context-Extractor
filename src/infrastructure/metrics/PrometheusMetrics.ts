/**
 * PrometheusMetrics — lightweight metrics collection.
 * Exposes /metrics endpoint compatible with Prometheus scraping.
 * No external runtime dependency — uses plain counters/gauges.
 */
export class PrometheusMetrics {
  private readonly _counters = new Map<string, number>();
  private readonly _histograms = new Map<string, number[]>();
  private readonly _gauges = new Map<string, number>();
  private static _instance: PrometheusMetrics;

  static getInstance(): PrometheusMetrics {
    if (!PrometheusMetrics._instance) {
      PrometheusMetrics._instance = new PrometheusMetrics();
    }
    return PrometheusMetrics._instance;
  }

  increment(name: string, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    this._counters.set(key, (this._counters.get(key) ?? 0) + 1);
  }

  gauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    this._gauges.set(key, value);
  }

  observeDuration(name: string, durationMs: number, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    const values = this._histograms.get(key) ?? [];
    values.push(durationMs);
    this._histograms.set(key, values);
  }

  /** Returns Prometheus text format for /metrics endpoint */
  toPrometheusFormat(): string {
    const lines: string[] = [];

    for (const [key, value] of this._counters) {
      lines.push(`# TYPE ${key.split('{')[0]} counter`);
      lines.push(`${key} ${value}`);
    }

    for (const [key, value] of this._gauges) {
      lines.push(`# TYPE ${key.split('{')[0]} gauge`);
      lines.push(`${key} ${value}`);
    }

    for (const [key, values] of this._histograms) {
      const base = key.split('{')[0];
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;
      const p50 = this.percentile(values, 0.5);
      const p95 = this.percentile(values, 0.95);
      const p99 = this.percentile(values, 0.99);
      lines.push(`# TYPE ${base} summary`);
      lines.push(`${base}{quantile="0.5"} ${p50}`);
      lines.push(`${base}{quantile="0.95"} ${p95}`);
      lines.push(`${base}{quantile="0.99"} ${p99}`);
      lines.push(`${base}_sum ${sum}`);
      lines.push(`${base}_count ${count}`);
    }

    return lines.join('\n');
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, idx)];
  }

  private buildKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  reset(): void {
    this._counters.clear();
    this._histograms.clear();
    this._gauges.clear();
  }
}

/** Convenience singleton accessor */
export const metrics = PrometheusMetrics.getInstance();

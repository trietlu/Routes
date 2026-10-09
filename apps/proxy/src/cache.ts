/** Milliseconds since an arbitrary epoch; injectable so tests control time. */
export type Clock = () => number;

/**
 * In-memory LRU cache with a fixed TTL per entry. Per instance only; there
 * is no shared store in v1. A `Map` keeps insertion order, so re-inserting on
 * read makes the first key the least recently used.
 */
export class TtlLruCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
    private readonly now: Clock,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.expiresAt <= this.now()) return undefined;
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.ttlMs <= 0) return; // a zero TTL turns caching off
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value!);
    }
  }
}

const round = (value: number, decimals: number): string => value.toFixed(decimals);

/** Routes: origin to 4 decimals (~11 m), plus destination place ID or rounded latLng. */
export function routesCacheKey(request: {
  origin: { lat: number; lng: number };
  destination: { placeId?: string; lat: number; lng: number };
}): string {
  const { origin, destination } = request;
  const to = destination.placeId
    ? `place:${destination.placeId}`
    : `${round(destination.lat, 4)},${round(destination.lng, 4)}`;
  return `${round(origin.lat, 4)},${round(origin.lng, 4)}|${to}`;
}

/** Autocomplete: lower-cased trimmed query plus origin to 2 decimals. */
export function autocompleteCacheKey(query: { q: string; lat?: number; lng?: number }): string {
  const origin =
    query.lat !== undefined && query.lng !== undefined
      ? `${round(query.lat, 2)},${round(query.lng, 2)}`
      : 'none';
  return `${query.q.trim().toLowerCase()}|${origin}`;
}

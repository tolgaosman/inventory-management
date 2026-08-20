/**
 * Simple in-memory API response cache.
 *
 * Works as a shared singleton — every component that calls the same API
 * endpoint with the same arguments within the TTL window gets the cached
 * Promise (deduplication) and then the cached value (stale-while-revalidate).
 *
 * Design constraints:
 *  - Only for GET-style "reference" data (warehouses, categories, suppliers, etc.)
 *    where staleness of 30s is acceptable.
 *  - Mutations MUST call `invalidateCache(prefix)` to bust related entries.
 *  - No persistence — survives only within a browser tab session.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  promise?: Promise<T>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL_MS = 30_000; // 30 seconds

/**
 * Wrap an async factory with caching.
 *
 * @param key     - Unique cache key, include all query params.
 * @param factory - The async function that fetches the data.
 * @param ttlMs   - How long to cache (default 30 s).
 */
export async function cachedFetch<T>(
  key: string,
  factory: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;

  // Return cached value if still fresh
  if (entry && entry.expiresAt > now) {
    return entry.value;
  }

  // If a request is already in-flight, piggyback on it (deduplication)
  if (entry?.promise) {
    return entry.promise;
  }

  const promise = factory().then((value) => {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  });

  // Store the in-flight promise immediately so parallel calls piggyback
  store.set(key, { value: entry?.value as T, expiresAt: entry?.expiresAt ?? 0, promise });

  return promise;
}

/**
 * Invalidate all cache entries whose key starts with `prefix`.
 * Call this after any mutation that affects the cached data.
 */
export function invalidateCache(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/** Clear the entire cache (e.g. on logout). */
export function clearCache(): void {
  store.clear();
}

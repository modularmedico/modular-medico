/**
 * Small localStorage-backed cache used to make repeat loads of MCQs, lectures,
 * modules, study notes, etc. feel instant instead of waiting on Firestore again.
 *
 * Pattern used across the services:
 *  - `cacheGet` / `cacheSet` — simple TTL cache for one-off fetches (e.g. an MCQ practice set).
 *  - `cacheFirstSnapshot` — wraps a Firestore `onSnapshot`-based subscribe function so any
 *    previously-cached value is delivered to the UI immediately (no spinner wait), while the
 *    live Firestore listener still runs in the background and refreshes both the cache and
 *    the UI the moment fresh data arrives.
 *
 * None of this touches correctness: Firestore is still the source of truth and every call
 * still hits the network — cached data is just shown first so the first paint isn't blocked
 * on it.
 */

const PREFIX = "mm_cache_";
export const ONE_HOUR = 60 * 60 * 1000;
export const ONE_DAY = 24 * ONE_HOUR;

interface CacheEnvelope<T> {
  value: T;
  expiresAt: number;
}

/** Reads a cached value, or null if missing/expired/corrupt. */
export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

/** Writes a value to the cache with a TTL (defaults to 1 day). */
export function cacheSet<T>(key: string, value: T, ttlMs: number = ONE_DAY): void {
  try {
    const envelope: CacheEnvelope<T> = { value, expiresAt: Date.now() + ttlMs };
    localStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // localStorage full/unavailable (e.g. private browsing) — fail silently, cache is best-effort.
  }
}

/**
 * Wraps a one-off async fetch (like fetchPublishedBlock) with a TTL cache.
 * On a cache hit within the TTL window, returns instantly without touching Firestore.
 * On a miss (or expiry), calls `fetcher`, caches the result, and returns it.
 */
export async function cacheFirstFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = ONE_HOUR
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;
  const fresh = await fetcher();
  cacheSet(key, fresh, ttlMs);
  return fresh;
}

/**
 * Wraps a Firestore-style subscribe function (one that takes a callback and returns an
 * unsubscribe function) so that any cached value for `key` is delivered to `cb` immediately,
 * before the live listener has had a chance to respond. Every value the live listener
 * produces afterwards refreshes the cache and is also forwarded to `cb`.
 */
export function cacheFirstSnapshot<T>(
  key: string,
  subscribe: (cb: (data: T) => void) => () => void,
  cb: (data: T) => void,
  ttlMs: number = ONE_DAY
): () => void {
  const cached = cacheGet<T>(key);
  if (cached !== null) cb(cached);
  return subscribe((data) => {
    cacheSet(key, data, ttlMs);
    cb(data);
  });
}

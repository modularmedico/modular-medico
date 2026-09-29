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
/** How long past its TTL an entry may still be shown instantly while it refreshes in the background. */
const MAX_STALE = 7 * ONE_DAY;

interface CacheEnvelope<T> {
  value: T;
  expiresAt: number;
}

// In-memory tier: survives route changes within a session, needs no JSON parse, and
// keeps working when localStorage is full (large question sets easily exceed its ~5 MB quota).
const mem = new Map<string, CacheEnvelope<unknown>>();
// Concurrent callers asking for the same key share one network request.
const inflight = new Map<string, Promise<unknown>>();

function readEnvelope<T>(key: string): CacheEnvelope<T> | null {
  const m = mem.get(key) as CacheEnvelope<T> | undefined;
  if (m) return m;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    mem.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

/** Reads a cached value, or null if missing/expired/corrupt. */
export function cacheGet<T>(key: string): T | null {
  const env = readEnvelope<T>(key);
  if (!env) return null;
  if (env.expiresAt && Date.now() > env.expiresAt) {
    mem.delete(key);
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
    return null;
  }
  return env.value;
}

/** Writes a value to the cache with a TTL (defaults to 1 day). */
export function cacheSet<T>(key: string, value: T, ttlMs: number = ONE_DAY): void {
  const envelope: CacheEnvelope<T> = { value, expiresAt: Date.now() + ttlMs };
  mem.set(key, envelope);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // localStorage full/unavailable (e.g. private browsing) — the in-memory copy still works.
  }
}

/** Removes every cache entry whose key starts with one of `prefixes` (used to retire renamed keys). */
export function cachePurgePrefix(prefixes: string[]): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && prefixes.some((pre) => k.startsWith(PREFIX + pre))) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

function dedupedFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fetcher()
    .then((fresh) => {
      cacheSet(key, fresh, ttlMs);
      return fresh;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

/**
 * Wraps a one-off async fetch (like fetchPublishedBlock) with a stale-while-revalidate cache.
 *  - Fresh hit (within TTL): returned instantly.
 *  - Stale hit (past TTL, under MAX_STALE): returned instantly, refreshed in the background
 *    so the *next* load is current — instead of blocking the student on the network again.
 *  - Miss: awaits the fetch. Concurrent callers for the same key share one request.
 * If `fetcher` throws, nothing is cached and the error propagates to the caller.
 */
export async function cacheFirstFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = ONE_HOUR
): Promise<T> {
  const env = readEnvelope<T>(key);
  if (env) {
    const now = Date.now();
    if (!env.expiresAt || now <= env.expiresAt) return env.value;
    if (now <= env.expiresAt + MAX_STALE) {
      dedupedFetch(key, fetcher, ttlMs).catch(() => {
        /* keep serving the stale copy if the refresh fails */
      });
      return env.value;
    }
  }
  return dedupedFetch(key, fetcher, ttlMs);
}

/**
 * Wraps a Firestore-style subscribe function (one that takes a callback and returns an
 * unsubscribe function) so that any cached value for `key` is delivered to `cb` immediately,
 * before the live listener has had a chance to respond. Every value the live listener
 * produces afterwards refreshes the cache and is also forwarded to `cb`.
 *
 * `toCache` lets a caller persist a slimmed-down copy (e.g. drop question text/explanations
 * for views that only need counts) so big collections don't blow the localStorage quota.
 * `cb` always receives the full live value.
 */
export function cacheFirstSnapshot<T>(
  key: string,
  subscribe: (cb: (data: T) => void) => () => void,
  cb: (data: T) => void,
  ttlMs: number = ONE_DAY,
  toCache: (data: T) => T = (d) => d
): () => void {
  const cached = cacheGet<T>(key);
  if (cached !== null) cb(cached);
  return subscribe((data) => {
    cacheSet(key, toCache(data), ttlMs);
    cb(data);
  });
}

/**
 * Cache-then-network helper for lightweight index data (counts, outlines).
 *  - If a cached value exists it is delivered to `cb` immediately (no spinner).
 *  - The fetcher then runs (concurrent callers share one request) and its fresh result is
 *    cached and delivered to `cb` too, so the UI corrects itself a moment later.
 *  - If the fetch fails, nothing is cached; `fallback` (if given) is shown only when there
 *    was no cached value to keep showing.
 * Returns an unsubscribe function that stops any further `cb` calls.
 */
export function cacheThenFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  cb: (data: T) => void,
  fallback?: () => T,
  ttlMs: number = 7 * ONE_DAY
): () => void {
  let cancelled = false;
  const cached = cacheGet<T>(key);
  if (cached !== null) cb(cached);
  dedupedFetch(key, fetcher, ttlMs)
    .then((fresh) => {
      if (!cancelled) cb(fresh);
    })
    .catch((err) => {
      console.warn(`cacheThenFetch(${key}) failed:`, err);
      if (!cancelled && cached === null && fallback) cb(fallback());
    });
  return () => {
    cancelled = true;
  };
}

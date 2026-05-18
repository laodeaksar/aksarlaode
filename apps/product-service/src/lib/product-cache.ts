// FIX PRD-05: In-process TTL cache for product lookups.
// Invalidated on every update or delete so stale price/stock data
// is never served after a change.
//
// Uses a plain Map — no extra dependencies, no Redis round-trip.
// Trade-off: cache is local to this process instance; in a multi-
// replica deployment each instance maintains its own cache and
// invalidation is per-process.  This is acceptable for a small
// catalogue; for large-scale use, replace with a Redis SETEX + DEL.

const CACHE_TTL_MS = 60_000; // 60 seconds

type CacheEntry<T> = { value: T; expiresAt: number };

class ProductCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs = CACHE_TTL_MS): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  // Invalidate all keys that could be associated with this product ID.
  // A product is cacheable under its UUID and its slug.
  invalidate(id: string, slug?: string): void {
    this.del(`product:id:${id}`);
    if (slug) this.del(`product:slug:${slug}`);
  }
}

export const productCache = new ProductCache();

export const cacheKey = {
  byId: (id: string) => `product:id:${id}`,
  bySlug: (slug: string) => `product:slug:${slug}`,
};

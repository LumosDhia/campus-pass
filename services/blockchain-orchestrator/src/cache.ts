import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

// HLD §7: "The Resolver must implement a caching layer (Redis) for Blockchain
// verification to handle high traffic." In this architecture the actual
// on-chain verification call lives in the orchestrator (the resolver only
// redirects), so the cache sits here — same requirement, correct layer.
const TTL_SECONDS = 30;

export const redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
redis.on("error", (err: Error) => {
  // Local dev: don't crash the service if Redis isn't up yet — just skip caching.
  console.warn("[cache] redis error (falling back to uncached reads):", err.message);
});

let connected = false;
async function ensureConnected() {
  if (connected) return true;
  try {
    await redis.connect();
    connected = true;
    return true;
  } catch {
    return false;
  }
}

export interface CacheStats {
  hit: boolean;
}

/** Cache-aside read: returns the cached value plus whether it was a hit, or computes+caches it. */
export async function cached<T>(key: string, compute: () => Promise<T>): Promise<T & { _cache?: CacheStats }> {
  if (await ensureConnected()) {
    try {
      const hit = await redis.get(key);
      if (hit !== null) {
        return { ...(JSON.parse(hit) as T), _cache: { hit: true } };
      }
    } catch {
      // fall through to compute
    }
  }

  const value = await compute();

  if (connected) {
    try {
      await redis.set(key, JSON.stringify(value), "EX", TTL_SECONDS);
    } catch {
      // caching is best-effort — never fail the request over it
    }
  }

  return { ...value, _cache: { hit: false } };
}

/** Explicit invalidation on writes (revoke, claim added) so cached reads don't lag behind mutations. */
export async function invalidate(...keys: string[]) {
  if (!(await ensureConnected())) return;
  try {
    await redis.del(...keys);
  } catch {
    // best-effort
  }
}

export function statusCacheKey(gtin: string, serial: string) {
  return `sbt:status:${gtin}:${serial}`;
}

export function recordCacheKey(gtin: string, serial: string) {
  return `sbt:record:${gtin}:${serial}`;
}

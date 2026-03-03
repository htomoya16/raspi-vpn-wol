type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const cacheStore = new Map<string, CacheEntry<unknown>>()
const inFlightStore = new Map<string, Promise<unknown>>()
const CACHE_DEBUG_STORAGE_KEY = 'wol:cache-debug'
export const CACHE_MAX_ENTRIES = 300
export const CACHE_EXPIRED_SWEEP_INTERVAL_MS = 60_000
let nextSweepAtMs = 0

function nowMs(): number {
  return Date.now()
}

function isDebugEnabled(): boolean {
  if (!import.meta.env.DEV) {
    return false
  }
  if (typeof window === 'undefined') {
    return false
  }
  return window.localStorage.getItem(CACHE_DEBUG_STORAGE_KEY) === '1'
}

export function logCacheDebug(event: string, detail: Record<string, unknown>): void {
  if (!isDebugEnabled()) {
    return
  }
  console.info(`[cache] ${event}`, detail)
}

export function getCachedValue<T>(key: string): T | null {
  const currentTime = nowMs()
  maybeSweepExpiredEntries(currentTime)
  const entry = cacheStore.get(key)
  if (!entry) {
    logCacheDebug('miss', { key })
    return null
  }
  if (entry.expiresAt <= currentTime) {
    cacheStore.delete(key)
    logCacheDebug('expired', { key })
    return null
  }
  logCacheDebug('hit', { key })
  return structuredClone(entry.value) as T
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number): void {
  if (ttlMs <= 0) {
    cacheStore.delete(key)
    logCacheDebug('skip-set-ttl', { key, ttlMs })
    return
  }
  const currentTime = nowMs()
  maybeSweepExpiredEntries(currentTime)
  if (cacheStore.has(key)) {
    cacheStore.delete(key)
  }
  cacheStore.set(key, {
    value: structuredClone(value),
    expiresAt: currentTime + ttlMs,
  })
  trimCacheEntries()
  logCacheDebug('set', { key, ttlMs })
}

export function invalidateCache(key: string): boolean {
  const removed = cacheStore.delete(key)
  logCacheDebug('invalidate-key', { key, removed })
  return removed
}

export function invalidateCacheByPrefix(prefix: string): number {
  const matched = [...cacheStore.keys()].filter((key) => key.startsWith(prefix))
  matched.forEach((key) => {
    cacheStore.delete(key)
  })
  logCacheDebug('invalidate-prefix', { prefix, removed: matched.length })
  return matched.length
}

export function getInFlight<T>(key: string): Promise<T> | null {
  const pending = inFlightStore.get(key)
  if (pending) {
    logCacheDebug('inflight-hit', { key })
  }
  return pending ? (pending as Promise<T>) : null
}

export function setInFlight<T>(key: string, promise: Promise<T>): void {
  inFlightStore.set(key, promise)
  logCacheDebug('inflight-set', { key })
}

export function clearInFlight(key: string): void {
  inFlightStore.delete(key)
  logCacheDebug('inflight-clear', { key })
}

export function clearApiCacheForTest(): void {
  cacheStore.clear()
  inFlightStore.clear()
  nextSweepAtMs = 0
}

function maybeSweepExpiredEntries(currentTime: number): void {
  if (currentTime < nextSweepAtMs) {
    return
  }
  nextSweepAtMs = currentTime + CACHE_EXPIRED_SWEEP_INTERVAL_MS
  let removed = 0
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expiresAt <= currentTime) {
      cacheStore.delete(key)
      removed += 1
    }
  }
  if (removed > 0) {
    logCacheDebug('sweep-expired', { removed })
  }
}

function trimCacheEntries(): void {
  let removed = 0
  while (cacheStore.size > CACHE_MAX_ENTRIES) {
    const oldest = cacheStore.keys().next()
    if (oldest.done) {
      break
    }
    cacheStore.delete(oldest.value)
    removed += 1
  }
  if (removed > 0) {
    logCacheDebug('trim-over-capacity', { removed, max: CACHE_MAX_ENTRIES })
  }
}

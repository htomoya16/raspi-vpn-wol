type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const cacheStore = new Map<string, CacheEntry<unknown>>()
const inFlightStore = new Map<string, Promise<unknown>>()

function nowMs(): number {
  return Date.now()
}

export function getCachedValue<T>(key: string): T | null {
  const entry = cacheStore.get(key)
  if (!entry) {
    return null
  }
  if (entry.expiresAt <= nowMs()) {
    cacheStore.delete(key)
    return null
  }
  return structuredClone(entry.value) as T
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number): void {
  if (ttlMs <= 0) {
    cacheStore.delete(key)
    return
  }
  cacheStore.set(key, {
    value: structuredClone(value),
    expiresAt: nowMs() + ttlMs,
  })
}

export function invalidateCache(key: string): boolean {
  return cacheStore.delete(key)
}

export function invalidateCacheByPrefix(prefix: string): number {
  const matched = [...cacheStore.keys()].filter((key) => key.startsWith(prefix))
  matched.forEach((key) => {
    cacheStore.delete(key)
  })
  return matched.length
}

export function getInFlight<T>(key: string): Promise<T> | null {
  const pending = inFlightStore.get(key)
  return pending ? (pending as Promise<T>) : null
}

export function setInFlight<T>(key: string, promise: Promise<T>): void {
  inFlightStore.set(key, promise)
}

export function clearInFlight(key: string): void {
  inFlightStore.delete(key)
}

export function clearApiCacheForTest(): void {
  cacheStore.clear()
  inFlightStore.clear()
}

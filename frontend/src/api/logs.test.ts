import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CACHE_PREFIX, CACHE_TTL_MS } from './cache-policy'
import { invalidateCacheByPrefix } from './cache'
import { clearLogs, listLogs } from './logs'
import { request, requestCached } from './http'

vi.mock('./http', () => ({
  request: vi.fn(),
  requestCached: vi.fn(),
}))

vi.mock('./cache', () => ({
  invalidateCacheByPrefix: vi.fn(),
}))

describe('logs api client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds logs list request with cache options', async () => {
    const requestCachedMock = vi.mocked(requestCached)
    requestCachedMock.mockResolvedValue({ items: [], next_cursor: null } as never)

    await listLogs({ limit: 50, pc_id: 'pc-1', ok: true })

    expect(requestCachedMock).toHaveBeenCalledWith(
      '/api/logs?limit=50&pc_id=pc-1&ok=true',
      expect.objectContaining({
        key: `${CACHE_PREFIX.logsList}?limit=50&pc_id=pc-1&ok=true`,
        ttlMs: CACHE_TTL_MS.logsList,
        staleWhileRevalidate: true,
      }),
    )
  })

  it('invalidates logs cache prefix after clear', async () => {
    const requestMock = vi.mocked(request)
    requestMock.mockResolvedValue({ deleted: 10 } as never)

    await clearLogs()

    expect(invalidateCacheByPrefix).toHaveBeenCalledWith(CACHE_PREFIX.logsList)
    expect(invalidateCacheByPrefix).toHaveBeenCalledTimes(1)
  })
})

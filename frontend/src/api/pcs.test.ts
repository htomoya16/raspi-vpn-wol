import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildUptimeSummaryPcPrefix,
  buildUptimeWeeklyPcPrefix,
  CACHE_PREFIX,
} from './cache-policy'
import { invalidateCacheByPrefix } from './cache'
import {
  createPc,
  deletePc,
  getPcUptimeSummary,
  getPcWeeklyTimeline,
  invalidatePcsAndUptimeCache,
  refreshAllStatuses,
  refreshPcStatus,
  sendPcWol,
  updatePc,
} from './pcs'
import { request, requestCached } from './http'

vi.mock('./http', () => ({
  request: vi.fn(),
  requestCached: vi.fn(),
}))

vi.mock('./cache', () => ({
  invalidateCacheByPrefix: vi.fn(),
}))

function expectGlobalInvalidateSet(): void {
  const invalidate = vi.mocked(invalidateCacheByPrefix)
  expect(invalidate).toHaveBeenCalledWith(CACHE_PREFIX.pcsList)
  expect(invalidate).toHaveBeenCalledWith(CACHE_PREFIX.uptimeSummary)
  expect(invalidate).toHaveBeenCalledWith(CACHE_PREFIX.uptimeWeekly)
  expect(invalidate).toHaveBeenCalledWith(CACHE_PREFIX.logsList)
  expect(invalidate).toHaveBeenCalledTimes(4)
}

describe('pcs api client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds uptime summary request with query parameters', async () => {
    const requestCachedMock = vi.mocked(requestCached)
    requestCachedMock.mockResolvedValue({} as never)

    await getPcUptimeSummary('pc main', {
      from: '2026-02-01',
      to: '2026-02-28',
      bucket: 'week',
      tz: 'Asia/Tokyo',
    })

    expect(requestCachedMock).toHaveBeenCalledWith(
      '/api/pcs/pc%20main/uptime/summary?from=2026-02-01&to=2026-02-28&bucket=week&tz=Asia%2FTokyo',
      expect.objectContaining({
        ttlMs: 120000,
      }),
    )
  })

  it('builds weekly timeline request without query when params are empty', async () => {
    const requestCachedMock = vi.mocked(requestCached)
    requestCachedMock.mockResolvedValue({} as never)

    await getPcWeeklyTimeline('pc-1')

    expect(requestCachedMock).toHaveBeenCalledWith(
      '/api/pcs/pc-1/uptime/weekly',
      expect.objectContaining({
        ttlMs: 120000,
      }),
    )
  })

  it('invalidates related cache prefixes after create/update/delete/status/wol mutations', async () => {
    const requestMock = vi.mocked(request)

    requestMock.mockResolvedValue({ pc: { id: 'pc-1' } } as never)
    await createPc({
      name: 'Main PC',
      mac: 'AA:BB:CC:DD:EE:FF',
      ip: '192.168.10.20',
      tags: [],
      note: null,
    })
    expectGlobalInvalidateSet()

    vi.clearAllMocks()
    requestMock.mockResolvedValue({ pc: { id: 'pc-1' } } as never)
    await updatePc('pc-1', { note: 'updated' })
    expectGlobalInvalidateSet()

    vi.clearAllMocks()
    requestMock.mockResolvedValue(undefined as never)
    await deletePc('pc-1')
    expectGlobalInvalidateSet()

    vi.clearAllMocks()
    requestMock.mockResolvedValue({ pc: { id: 'pc-1' } } as never)
    await refreshPcStatus('pc-1')
    expectGlobalInvalidateSet()

    vi.clearAllMocks()
    requestMock.mockResolvedValue({ job_id: 'job-1', state: 'queued' } as never)
    await sendPcWol('pc-1')
    expectGlobalInvalidateSet()

    vi.clearAllMocks()
    requestMock.mockResolvedValue({ job_id: 'job-2', state: 'queued' } as never)
    await refreshAllStatuses()
    expectGlobalInvalidateSet()
  })

  it('supports per-pc invalidate for uptime cache', () => {
    const invalidate = vi.mocked(invalidateCacheByPrefix)

    invalidatePcsAndUptimeCache('pc main')

    expect(invalidate).toHaveBeenCalledWith(CACHE_PREFIX.pcsList)
    expect(invalidate).toHaveBeenCalledWith(buildUptimeSummaryPcPrefix('pc main'))
    expect(invalidate).toHaveBeenCalledWith(buildUptimeWeeklyPcPrefix('pc main'))
    expect(invalidate).toHaveBeenCalledTimes(3)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setStoredBearerToken } from './auth'
import { clearApiCacheForTest } from './cache'
import { createPc, listPcs } from './pcs'

describe('cache invalidation flow', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    setStoredBearerToken('wol_token_for_test')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
    clearApiCacheForTest()
    setStoredBearerToken('')
  })

  it('re-fetches pcs list after create mutation invalidates cache', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'pc-main',
                name: 'Main PC',
                mac: 'AA:BB:CC:DD:EE:FF',
                ip: '192.168.10.20',
                tags: [],
                note: null,
                status: 'offline',
                last_seen_at: null,
                created_at: '2026-02-28T00:00:00+09:00',
                updated_at: '2026-02-28T00:00:00+09:00',
              },
            ],
            next_cursor: null,
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'pc-main',
                name: 'Main PC',
                mac: 'AA:BB:CC:DD:EE:FF',
                ip: '192.168.10.20',
                tags: [],
                note: null,
                status: 'offline',
                last_seen_at: null,
                created_at: '2026-02-28T00:00:00+09:00',
                updated_at: '2026-02-28T00:00:00+09:00',
              },
              {
                id: 'pc-sub',
                name: 'Sub PC',
                mac: '11:22:33:44:55:66',
                ip: '192.168.10.30',
                tags: [],
                note: null,
                status: 'offline',
                last_seen_at: null,
                created_at: '2026-02-28T00:10:00+09:00',
                updated_at: '2026-02-28T00:10:00+09:00',
              },
            ],
            next_cursor: null,
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            pc: {
              id: 'pc-sub',
              name: 'Sub PC',
              mac: '11:22:33:44:55:66',
              ip: '192.168.10.30',
              tags: [],
              note: null,
              status: 'offline',
              last_seen_at: null,
              created_at: '2026-02-28T00:10:00+09:00',
              updated_at: '2026-02-28T00:10:00+09:00',
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'pc-main',
                name: 'Main PC',
                mac: 'AA:BB:CC:DD:EE:FF',
                ip: '192.168.10.20',
                tags: [],
                note: null,
                status: 'offline',
                last_seen_at: null,
                created_at: '2026-02-28T00:00:00+09:00',
                updated_at: '2026-02-28T00:00:00+09:00',
              },
              {
                id: 'pc-sub',
                name: 'Sub PC',
                mac: '11:22:33:44:55:66',
                ip: '192.168.10.30',
                tags: [],
                note: null,
                status: 'offline',
                last_seen_at: null,
                created_at: '2026-02-28T00:10:00+09:00',
                updated_at: '2026-02-28T00:10:00+09:00',
              },
            ],
            next_cursor: null,
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )

    const first = await listPcs({ limit: 200 })
    const second = await listPcs({ limit: 200 })
    await createPc({
      name: 'Sub PC',
      mac: '11:22:33:44:55:66',
      ip: '192.168.10.30',
      tags: [],
      note: null,
    })
    const afterMutation = await listPcs({ limit: 200 })

    expect(first.items).toHaveLength(1)
    expect(second.items).toHaveLength(1)
    expect(afterMutation.items).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/pcs?limit=200')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/pcs?limit=200')
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/pcs')
    expect(fetchMock.mock.calls[3]?.[0]).toBe('/api/pcs?limit=200')
  })
})

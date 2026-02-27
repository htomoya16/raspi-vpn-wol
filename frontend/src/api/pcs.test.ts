import { describe, expect, it, vi } from 'vitest'

import { getPcUptimeSummary, getPcWeeklyTimeline } from './pcs'
import { request } from './http'

vi.mock('./http', () => ({
  request: vi.fn(),
}))

describe('pcs api client', () => {
  it('builds uptime summary request with query parameters', async () => {
    const requestMock = vi.mocked(request)
    requestMock.mockResolvedValue({} as never)

    await getPcUptimeSummary('pc main', {
      from: '2026-02-01',
      to: '2026-02-28',
      bucket: 'week',
      tz: 'Asia/Tokyo',
    })

    expect(requestMock).toHaveBeenCalledWith(
      '/api/pcs/pc%20main/uptime/summary?from=2026-02-01&to=2026-02-28&bucket=week&tz=Asia%2FTokyo',
    )
  })

  it('builds weekly timeline request without query when params are empty', async () => {
    const requestMock = vi.mocked(request)
    requestMock.mockResolvedValue({} as never)

    await getPcWeeklyTimeline('pc-1')

    expect(requestMock).toHaveBeenCalledWith('/api/pcs/pc-1/uptime/weekly')
  })
})

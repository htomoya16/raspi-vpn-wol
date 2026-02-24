import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, formatApiError, request } from './http'

describe('http api helpers', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('sends default Accept header and returns json body', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const result = await request<{ status: string }>('/api/health')

    expect(result).toEqual({ status: 'ok' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, options] = fetchMock.mock.calls[0]
    const headers = new Headers(options?.headers)
    expect(headers.get('Accept')).toBe('application/json')
  })

  it('throws ApiError with text detail on non json response', async () => {
    fetchMock.mockResolvedValue(
      new Response('service unavailable', {
        status: 503,
        headers: { 'content-type': 'text/plain' },
      }),
    )

    await expect(request('/api/logs')).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
      detail: 'service unavailable',
    })
  })

  it('maps api errors into user friendly messages', () => {
    expect(formatApiError(new ApiError(400, 'bad', 'bad'))).toBe('入力エラー: bad')
    expect(formatApiError(new ApiError(404, 'missing', 'missing'))).toBe('対象が見つかりません: missing')
    expect(formatApiError(new ApiError(409, '既に存在しています（MAC: AA）', null))).toBe(
      'このMACアドレスは既に登録されています',
    )
    expect(formatApiError(new ApiError(422, 'invalid body', null))).toBe('形式エラー: invalid body')
    expect(formatApiError(new Error('offline'))).toBe('offline')
  })
})

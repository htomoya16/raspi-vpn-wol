import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearApiCacheForTest } from './cache'
import { ApiError, formatApiError, request, requestCached } from './http'

describe('http api helpers', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
    clearApiCacheForTest()
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

  it('returns cached response within ttl and avoids duplicate fetch', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [1] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const first = await requestCached<{ items: number[] }>(
      '/api/pcs?limit=50',
      { key: 'pcs:list:limit=50', ttlMs: 1000 },
    )
    const second = await requestCached<{ items: number[] }>(
      '/api/pcs?limit=50',
      { key: 'pcs:list:limit=50', ttlMs: 1000 },
    )

    expect(first).toEqual({ items: [1] })
    expect(second).toEqual({ items: [1] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('deduplicates in-flight requests with same cache key', async () => {
    let resolveFetch: ((value: Response) => void) | null = null
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )

    const pendingA = requestCached<{ status: string }>(
      '/api/health',
      { key: 'health', ttlMs: 1000 },
    )
    const pendingB = requestCached<{ status: string }>(
      '/api/health',
      { key: 'health', ttlMs: 1000 },
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolveFetch?.(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const [a, b] = await Promise.all([pendingA, pendingB])
    expect(a).toEqual({ status: 'ok' })
    expect(b).toEqual({ status: 'ok' })
  })
})

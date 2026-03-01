import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { API_BEARER_INVALID_EVENT, setStoredBearerToken } from './auth'
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
    setStoredBearerToken('')
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
    setStoredBearerToken('wol_token_for_test')
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

  it('throws 401 before fetch when protected api is called without bearer token', async () => {
    await expect(request('/api/pcs')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      detail: 'api token is not configured',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dispatches invalid-token event when stored bearer token receives 401', async () => {
    const invalidListener = vi.fn()
    window.addEventListener(API_BEARER_INVALID_EVENT, invalidListener as EventListener)
    setStoredBearerToken('wol_invalid_token')
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'invalid bearer token' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    )

    await expect(request('/api/pcs')).rejects.toMatchObject({
      status: 401,
      detail: 'invalid bearer token',
    })
    expect(invalidListener).toHaveBeenCalledTimes(1)
    window.removeEventListener(API_BEARER_INVALID_EVENT, invalidListener as EventListener)
  })

  it('does not dispatch invalid-token event when Authorization header is explicit', async () => {
    const invalidListener = vi.fn()
    window.addEventListener(API_BEARER_INVALID_EVENT, invalidListener as EventListener)
    setStoredBearerToken('wol_current_valid_token')
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'invalid bearer token' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    )

    await expect(
      request('/api/auth/me', {
        headers: { Authorization: 'Bearer wol_candidate_token' },
      }),
    ).rejects.toMatchObject({
      status: 401,
      detail: 'invalid bearer token',
    })
    expect(invalidListener).not.toHaveBeenCalled()
    window.removeEventListener(API_BEARER_INVALID_EVENT, invalidListener as EventListener)
  })

  it('adds Authorization header when bearer token is stored', async () => {
    setStoredBearerToken('wol_token_for_test')
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    await request<{ status: string }>('/api/health')

    const [, options] = fetchMock.mock.calls[0]
    const headers = new Headers(options?.headers)
    expect(headers.get('Authorization')).toBe('Bearer wol_token_for_test')
  })

  it('maps api errors into user friendly messages', () => {
    expect(formatApiError(new ApiError(400, 'bad', 'bad'))).toBe('入力エラー: bad')
    expect(formatApiError(new ApiError(401, 'invalid bearer token', 'invalid bearer token'))).toBe(
      '認証エラー: invalid bearer token',
    )
    expect(formatApiError(new ApiError(403, 'insufficient scope', 'insufficient scope'))).toBe(
      '権限エラー: insufficient scope',
    )
    expect(formatApiError(new ApiError(404, 'missing', 'missing'))).toBe('対象が見つかりません: missing')
    expect(formatApiError(new ApiError(409, '既に存在しています（MAC: AA）', null))).toBe(
      'このMACアドレスは既に登録されています',
    )
    expect(formatApiError(new ApiError(422, 'invalid body', null))).toBe('形式エラー: invalid body')
    expect(formatApiError(new Error('offline'))).toBe('offline')
  })

  it('returns cached response within ttl and avoids duplicate fetch', async () => {
    setStoredBearerToken('wol_token_for_test')
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

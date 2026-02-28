import { clearInFlight, getCachedValue, getInFlight, setCachedValue, setInFlight } from './cache'

export class ApiError extends Error {
  status: number
  detail: string
  rawDetail: unknown

  constructor(status: number, detail: string, rawDetail: unknown) {
    super(detail || `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail || ''
    this.rawDetail = rawDetail
  }
}

function normalizeDetail(detail: unknown): string {
  if (detail == null) {
    return ''
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') {
          return item
        }
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg?: unknown }).msg)
        }
        return JSON.stringify(item)
      })
      .join(', ')
  }

  if (typeof detail === 'object') {
    if ('msg' in detail) {
      return String((detail as { msg?: unknown }).msg)
    }
    return JSON.stringify(detail)
  }

  return String(detail)
}

export function formatApiError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : '通信に失敗しました'
  }

  if (error.status === 400) {
    return `入力エラー: ${error.detail}`
  }
  if (error.status === 404) {
    return `対象が見つかりません: ${error.detail}`
  }
  if (error.status === 409) {
    if (error.detail.includes('MAC')) {
      return 'このMACアドレスは既に登録されています'
    }
    if (error.detail.includes('ID')) {
      return 'このIDは既に登録されています'
    }
    return `重複エラー: ${error.detail}`
  }
  if (error.status === 422) {
    return `形式エラー: ${error.detail}`
  }

  return `HTTP ${error.status}: ${error.detail}`
}

function withDefaultHeaders(headers?: HeadersInit): Headers {
  const next = new Headers(headers)
  if (!next.has('Accept')) {
    next.set('Accept', 'application/json')
  }
  return next
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: withDefaultHeaders(options.headers),
  })

  const contentType = response.headers.get('content-type') || ''
  let data: unknown = null

  if (contentType.includes('application/json')) {
    try {
      data = await response.json()
    } catch {
      data = null
    }
  } else {
    const text = await response.text()
    data = text ? { detail: text } : null
  }

  if (!response.ok) {
    const rawDetail =
      data && typeof data === 'object' && 'detail' in data
        ? (data as { detail?: unknown }).detail
        : null
    const detail = normalizeDetail(rawDetail) || `HTTP ${response.status}`
    throw new ApiError(response.status, detail, rawDetail)
  }

  return data as T
}

export interface RequestCacheOptions {
  key: string
  ttlMs: number
  staleWhileRevalidate?: boolean
}

function startCachedFetch<T>(
  key: string,
  path: string,
  options: RequestInit,
  ttlMs: number,
): Promise<T> {
  const pending = getInFlight<T>(key)
  if (pending) {
    return pending
  }

  const next = request<T>(path, options)
    .then((data) => {
      setCachedValue(key, data, ttlMs)
      return data
    })
    .finally(() => {
      clearInFlight(key)
    })

  setInFlight(key, next)
  return next
}

export async function requestCached<T>(
  path: string,
  cache: RequestCacheOptions,
  options: RequestInit = {},
): Promise<T> {
  const cached = getCachedValue<T>(cache.key)
  if (cached !== null) {
    if (cache.staleWhileRevalidate) {
      void startCachedFetch<T>(cache.key, path, options, cache.ttlMs).catch(() => undefined)
    }
    return cached
  }
  return startCachedFetch<T>(cache.key, path, options, cache.ttlMs)
}

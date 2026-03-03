import {
  clearInFlight,
  getCachedValue,
  getInFlight,
  logCacheDebug,
  setCachedValue,
  setInFlight,
} from './cache'
import { API_BEARER_INVALID_EVENT, getStoredBearerToken } from './auth'

const PUBLIC_API_PATH_PREFIXES = ['/api/health']
const BOOTSTRAP_NO_TOKEN_ROUTE = '/api/admin/tokens'

export class ApiError extends Error {
  status: number
  detail: string
  rawDetail: unknown
  retryAfterSeconds: number | null

  constructor(status: number, detail: string, rawDetail: unknown, retryAfterSeconds: number | null = null) {
    super(detail || `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail || ''
    this.rawDetail = rawDetail
    this.retryAfterSeconds = retryAfterSeconds
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
  if (error.status === 401) {
    return `認証エラー: ${error.detail}`
  }
  if (error.status === 403) {
    return `権限エラー: ${error.detail}`
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
  if (error.status === 429) {
    if (typeof error.retryAfterSeconds === 'number' && Number.isFinite(error.retryAfterSeconds)) {
      return `リクエストが多すぎます。${error.retryAfterSeconds}秒後に再試行してください`
    }
    return 'リクエストが多すぎます。しばらく待って再試行してください'
  }

  return `HTTP ${error.status}: ${error.detail}`
}

function resolvePathname(path: string): string {
  try {
    const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
    return new URL(path, base).pathname
  } catch {
    return path
  }
}

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

function requiresBearerToken(path: string, method: string): boolean {
  const pathname = normalizePathname(resolvePathname(path))
  const normalizedMethod = method.trim().toUpperCase() || 'GET'
  if (!pathname.startsWith('/api/')) {
    return false
  }
  if (
    pathname === BOOTSTRAP_NO_TOKEN_ROUTE &&
    (normalizedMethod === 'GET' || normalizedMethod === 'POST')
  ) {
    return false
  }
  return !PUBLIC_API_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function withDefaultHeaders(
  headers?: HeadersInit,
): { headers: Headers; usedStoredBearerToken: boolean } {
  const next = new Headers(headers)
  let usedStoredBearerToken = false
  if (!next.has('Accept')) {
    next.set('Accept', 'application/json')
  }
  if (!next.has('Authorization')) {
    const bearerToken = getStoredBearerToken()
    if (bearerToken) {
      next.set('Authorization', `Bearer ${bearerToken}`)
      usedStoredBearerToken = true
    }
  }
  return { headers: next, usedStoredBearerToken }
}

function dispatchStoredTokenInvalid(path: string, detail: string): void {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(
    new CustomEvent(API_BEARER_INVALID_EVENT, {
      detail: { path, reason: detail },
    }),
  )
}

function parseRetryAfterSeconds(value: string | null): number | null {
  if (!value) {
    return null
  }
  const normalized = value.trim()
  if (!normalized) {
    return null
  }
  const asSeconds = Number(normalized)
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.ceil(asSeconds)
  }
  const dateMillis = Date.parse(normalized)
  if (Number.isNaN(dateMillis)) {
    return null
  }
  const diffSeconds = Math.ceil((dateMillis - Date.now()) / 1000)
  return Math.max(0, diffSeconds)
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const bearerRequired = requiresBearerToken(path, method)
  const cacheMode = options.cache ?? 'no-store'
  const { headers: normalizedHeaders, usedStoredBearerToken } = withDefaultHeaders(options.headers)
  if (bearerRequired && !normalizedHeaders.get('Authorization')?.trim()) {
    throw new ApiError(401, 'api token is not configured', 'api token is not configured')
  }
  const response = await fetch(path, {
    ...options,
    cache: cacheMode,
    headers: normalizedHeaders,
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
    if (response.status === 401 && usedStoredBearerToken && bearerRequired) {
      dispatchStoredTokenInvalid(path, detail)
    }
    const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('Retry-After'))
    throw new ApiError(response.status, detail, rawDetail, retryAfterSeconds)
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
    logCacheDebug('fetch-join-inflight', { key, path })
    return pending
  }

  logCacheDebug('fetch-start', { key, path })
  const next = request<T>(path, options)
    .then((data) => {
      setCachedValue(key, data, ttlMs)
      logCacheDebug('fetch-success', { key, path, ttlMs })
      return data
    })
    .catch((error) => {
      logCacheDebug('fetch-failed', {
        key,
        path,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
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
    logCacheDebug('request-cached-hit', {
      key: cache.key,
      path,
      staleWhileRevalidate: Boolean(cache.staleWhileRevalidate),
    })
    if (cache.staleWhileRevalidate) {
      void startCachedFetch<T>(cache.key, path, options, cache.ttlMs).catch(() => undefined)
    }
    return cached
  }
  logCacheDebug('request-cached-miss', { key: cache.key, path })
  return startCachedFetch<T>(cache.key, path, options, cache.ttlMs)
}

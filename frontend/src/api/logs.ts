import type { LogClearResponse, LogListResponse } from '../types/models'
import { invalidateCacheByPrefix } from './cache'
import { buildLogsListCacheKey, CACHE_PREFIX, CACHE_TTL_MS } from './cache-policy'
import { request, requestCached } from './http'
import { toQueryString } from './query'

export interface ListLogsParams {
  pc_id?: string
  action?: string
  ok?: boolean
  since?: string
  until?: string
  limit?: number
  cursor?: number
}

export function listLogs(params: ListLogsParams = {}): Promise<LogListResponse> {
  const query = toQueryString(params)
  return requestCached<LogListResponse>(
    `/api/logs${query}`,
    {
      key: buildLogsListCacheKey(query),
      ttlMs: CACHE_TTL_MS.logsList,
      staleWhileRevalidate: true,
    },
  )
}

export function invalidateLogsCache(): void {
  invalidateCacheByPrefix(CACHE_PREFIX.logsList)
}

export async function clearLogs(): Promise<LogClearResponse> {
  const response = await request<LogClearResponse>('/api/logs', {
    method: 'DELETE',
  })
  invalidateLogsCache()
  return response
}

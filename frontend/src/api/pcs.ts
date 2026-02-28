import type {
  JobAccepted,
  PcCreatePayload,
  PcListResponse,
  PcResponse,
  PcUptimeSummaryResponse,
  PcUpdatePayload,
  PcWeeklyTimelineResponse,
  UptimeBucket,
} from '../types/models'
import {
  buildPcsListCacheKey,
  buildUptimeSummaryCacheKey,
  buildUptimeSummaryPcPrefix,
  buildUptimeWeeklyCacheKey,
  buildUptimeWeeklyPcPrefix,
  CACHE_PREFIX,
  CACHE_TTL_MS,
} from './cache-policy'
import { invalidateCacheByPrefix } from './cache'
import { request, requestCached } from './http'
import { toQueryString } from './query'

export interface ListPcsParams {
  q?: string
  status?: string
  tag?: string
  limit?: number
  cursor?: string
}

export function invalidatePcsAndUptimeCache(pcId?: string): void {
  invalidateCacheByPrefix(CACHE_PREFIX.pcsList)
  if (pcId && pcId.trim()) {
    invalidateCacheByPrefix(buildUptimeSummaryPcPrefix(pcId))
    invalidateCacheByPrefix(buildUptimeWeeklyPcPrefix(pcId))
    return
  }
  invalidateCacheByPrefix(CACHE_PREFIX.uptimeSummary)
  invalidateCacheByPrefix(CACHE_PREFIX.uptimeWeekly)
}

function invalidateLogCache(): void {
  invalidateCacheByPrefix(CACHE_PREFIX.logsList)
}

export function listPcs(params: ListPcsParams = {}): Promise<PcListResponse> {
  const query = toQueryString(params)
  return requestCached<PcListResponse>(
    `/api/pcs${query}`,
    {
      key: buildPcsListCacheKey(query),
      ttlMs: CACHE_TTL_MS.pcsList,
      staleWhileRevalidate: true,
    },
  )
}

export async function createPc(payload: PcCreatePayload): Promise<PcResponse> {
  const response = await request<PcResponse>('/api/pcs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  invalidatePcsAndUptimeCache()
  invalidateLogCache()
  return response
}

export async function deletePc(pcId: string): Promise<void> {
  await request<void>(`/api/pcs/${encodeURIComponent(pcId)}`, {
    method: 'DELETE',
  })
  invalidatePcsAndUptimeCache()
  invalidateLogCache()
}

export async function updatePc(pcId: string, payload: PcUpdatePayload): Promise<PcResponse> {
  const response = await request<PcResponse>(`/api/pcs/${encodeURIComponent(pcId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  invalidatePcsAndUptimeCache()
  invalidateLogCache()
  return response
}

export async function refreshPcStatus(pcId: string): Promise<PcResponse> {
  const response = await request<PcResponse>(`/api/pcs/${encodeURIComponent(pcId)}/status/refresh`, {
    method: 'POST',
  })
  invalidatePcsAndUptimeCache()
  invalidateLogCache()
  return response
}

export async function refreshAllStatuses(): Promise<JobAccepted> {
  const response = await request<JobAccepted>('/api/pcs/status/refresh', {
    method: 'POST',
  })
  invalidatePcsAndUptimeCache()
  invalidateLogCache()
  return response
}

export function sendPcWol(
  pcId: string,
  payload: Record<string, unknown> | null = null,
): Promise<JobAccepted> {
  const options: RequestInit = {
    method: 'POST',
  }

  if (payload && Object.keys(payload).length > 0) {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(payload)
  }

  return request<JobAccepted>(`/api/pcs/${encodeURIComponent(pcId)}/wol`, options).then((response) => {
    invalidatePcsAndUptimeCache()
    invalidateLogCache()
    return response
  })
}

export interface GetPcUptimeSummaryParams {
  from?: string
  to?: string
  bucket?: UptimeBucket
  tz?: string
}

export function getPcUptimeSummary(
  pcId: string,
  params: GetPcUptimeSummaryParams = {},
): Promise<PcUptimeSummaryResponse> {
  const query = toQueryString(params)
  return requestCached<PcUptimeSummaryResponse>(
    `/api/pcs/${encodeURIComponent(pcId)}/uptime/summary${query}`,
    {
      key: buildUptimeSummaryCacheKey(pcId, query),
      ttlMs: CACHE_TTL_MS.uptimeSummary,
      staleWhileRevalidate: true,
    },
  )
}

export interface GetPcWeeklyTimelineParams {
  week_start?: string
  tz?: string
}

export function getPcWeeklyTimeline(
  pcId: string,
  params: GetPcWeeklyTimelineParams = {},
): Promise<PcWeeklyTimelineResponse> {
  const query = toQueryString(params)
  return requestCached<PcWeeklyTimelineResponse>(
    `/api/pcs/${encodeURIComponent(pcId)}/uptime/weekly${query}`,
    {
      key: buildUptimeWeeklyCacheKey(pcId, query),
      ttlMs: CACHE_TTL_MS.uptimeWeekly,
      staleWhileRevalidate: true,
    },
  )
}

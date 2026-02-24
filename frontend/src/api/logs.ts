import type { LogClearResponse, LogListResponse } from '../types/models'
import { request } from './http'

function toQueryString(params: object): string {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }
    search.set(key, String(value))
  })

  const query = search.toString()
  return query ? `?${query}` : ''
}

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
  return request<LogListResponse>(`/api/logs${query}`)
}

export function clearLogs(): Promise<LogClearResponse> {
  return request<LogClearResponse>('/api/logs', {
    method: 'DELETE',
  })
}

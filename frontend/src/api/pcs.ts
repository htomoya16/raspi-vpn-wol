import type { JobAccepted, PcCreatePayload, PcListResponse, PcResponse, PcUpdatePayload } from '../types/models'
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

export interface ListPcsParams {
  q?: string
  status?: string
  tag?: string
  limit?: number
  cursor?: string
}

export function listPcs(params: ListPcsParams = {}): Promise<PcListResponse> {
  const query = toQueryString(params)
  return request<PcListResponse>(`/api/pcs${query}`)
}

export function createPc(payload: PcCreatePayload): Promise<PcResponse> {
  return request<PcResponse>('/api/pcs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deletePc(pcId: string): Promise<void> {
  return request<void>(`/api/pcs/${encodeURIComponent(pcId)}`, {
    method: 'DELETE',
  })
}

export function updatePc(pcId: string, payload: PcUpdatePayload): Promise<PcResponse> {
  return request<PcResponse>(`/api/pcs/${encodeURIComponent(pcId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function refreshPcStatus(pcId: string): Promise<PcResponse> {
  return request<PcResponse>(`/api/pcs/${encodeURIComponent(pcId)}/status/refresh`, {
    method: 'POST',
  })
}

export function refreshAllStatuses(): Promise<JobAccepted> {
  return request<JobAccepted>('/api/pcs/status/refresh', {
    method: 'POST',
  })
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

  return request<JobAccepted>(`/api/pcs/${encodeURIComponent(pcId)}/wol`, options)
}

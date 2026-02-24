import type { HealthResponse } from '../types/models'
import { request } from './http'

export function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/api/health')
}

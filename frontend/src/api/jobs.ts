import type { JobResponse } from '../types/models'
import { request } from './http'

export function fetchJob(jobId: string): Promise<JobResponse> {
  return request<JobResponse>(`/api/jobs/${encodeURIComponent(jobId)}`)
}

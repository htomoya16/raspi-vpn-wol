import { request } from './http'

export function fetchJob(jobId) {
  return request(`/api/jobs/${encodeURIComponent(jobId)}`)
}

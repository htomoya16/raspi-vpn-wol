import { request } from './http';

export function fetchLogs(limit = 20) {
  const query = new URLSearchParams({ limit: String(limit) });
  return request(`/api/logs?${query.toString()}`);
}

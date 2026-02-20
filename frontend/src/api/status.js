import { request } from './http';

export function fetchStatus(targetId) {
  const query = new URLSearchParams({ target: targetId });
  return request(`/api/status?${query.toString()}`);
}

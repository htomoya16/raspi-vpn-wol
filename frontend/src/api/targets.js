import { request } from './http';


export function fetchTargets() {
  return request('/api/targets');
}

export function saveTarget(payload) {
  return request('/api/targets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function removeTarget(targetId) {
  return request(`/api/targets/${encodeURIComponent(targetId)}`, {
    method: 'DELETE',
  });
}

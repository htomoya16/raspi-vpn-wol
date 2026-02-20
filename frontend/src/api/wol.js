import { request } from './http';

export function sendWol(targetId) {
  return request('/api/wol', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target: targetId }),
  });
}

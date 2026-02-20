import { request } from './http';


export function fetchTargets() {
  return request('/api/targets');
}
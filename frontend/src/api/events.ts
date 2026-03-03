import { getStoredBearerToken } from './auth'

export function openEvents(): EventSource | null {
  if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
    return null
  }

  const bearerToken = getStoredBearerToken().trim()
  if (!bearerToken) {
    return null
  }
  const query = new URLSearchParams({ token: bearerToken }).toString()
  return new window.EventSource(`/api/events?${query}`)
}

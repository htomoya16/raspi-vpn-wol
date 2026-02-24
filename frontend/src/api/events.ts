export function openEvents(): EventSource | null {
  if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
    return null
  }

  return new window.EventSource('/api/events')
}

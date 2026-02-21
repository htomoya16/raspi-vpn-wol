export function openEvents() {
  if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
    return null
  }

  return new window.EventSource('/api/events')
}

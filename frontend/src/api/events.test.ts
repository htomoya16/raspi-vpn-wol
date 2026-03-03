import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setStoredBearerToken } from './auth'
import { openEvents } from './events'

describe('openEvents', () => {
  const EventSourceMock = vi.fn()
  const originalEventSource = window.EventSource

  beforeEach(() => {
    Object.defineProperty(window, 'EventSource', {
      configurable: true,
      writable: true,
      value: EventSourceMock,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'EventSource', {
      configurable: true,
      writable: true,
      value: originalEventSource,
    })
    EventSourceMock.mockReset()
    setStoredBearerToken('')
  })

  it('returns null when bearer token is not set', () => {
    const source = openEvents()

    expect(source).toBeNull()
    expect(EventSourceMock).not.toHaveBeenCalled()
  })

  it('opens sse with query token when bearer token is set', () => {
    const fakeSource = { close: vi.fn() }
    EventSourceMock.mockImplementation(() => fakeSource)
    setStoredBearerToken('tok_abc+123')

    const source = openEvents()

    expect(source).toBe(fakeSource)
    expect(EventSourceMock).toHaveBeenCalledWith('/api/events?token=tok_abc%2B123')
  })
})

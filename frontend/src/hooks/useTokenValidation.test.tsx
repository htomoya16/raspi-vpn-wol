import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setStoredBearerToken } from '../api/auth'
import { useTokenValidation } from './useTokenValidation'

const getCurrentApiActorMock = vi.fn()

vi.mock('../api/authMe', () => ({
  getCurrentApiActor: (...args: unknown[]) => getCurrentApiActorMock(...args),
}))

describe('useTokenValidation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    getCurrentApiActorMock.mockReset()
  })

  afterEach(() => {
    setStoredBearerToken('')
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  async function flushMicrotasks(): Promise<void> {
    await Promise.resolve()
    await Promise.resolve()
  }

  it('does not verify token when token is not stored', () => {
    const { result } = renderHook(() => useTokenValidation())

    expect(result.current.hasBearerToken).toBe(false)
    expect(result.current.isTokenVerified).toBe(false)
    expect(getCurrentApiActorMock).not.toHaveBeenCalled()
  })

  it('verifies stored token and revalidates every 60 seconds', async () => {
    setStoredBearerToken('tok_valid_device')
    getCurrentApiActorMock.mockResolvedValue({
      token_id: 'tok-1',
      token_name: 'iphone-shortcut',
      token_role: 'device',
    })

    const { result } = renderHook(() => useTokenValidation())

    await act(async () => {
      await flushMicrotasks()
    })
    expect(result.current.isTokenVerified).toBe(true)
    expect(getCurrentApiActorMock).toHaveBeenCalledTimes(1)
    expect(getCurrentApiActorMock).toHaveBeenCalledWith('tok_valid_device')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000)
    })
    expect(getCurrentApiActorMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
      await flushMicrotasks()
    })
    expect(getCurrentApiActorMock).toHaveBeenCalledTimes(2)
  })

  it('skips focus-triggered revalidation when last validation is within 60 seconds', async () => {
    setStoredBearerToken('tok_focus_skip')
    getCurrentApiActorMock.mockResolvedValue({
      token_id: 'tok-2',
      token_name: 'ipad-browser',
      token_role: 'device',
    })

    const { result } = renderHook(() => useTokenValidation())
    await act(async () => {
      await flushMicrotasks()
    })
    expect(result.current.isTokenVerified).toBe(true)
    expect(getCurrentApiActorMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await act(async () => {
      await flushMicrotasks()
    })

    expect(getCurrentApiActorMock).toHaveBeenCalledTimes(1)
  })
})

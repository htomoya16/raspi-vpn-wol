import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Job, JobState, JobResponse } from '../types/models'
import { useJobTracker } from './useJobTracker'

const fetchJobMock = vi.fn<(jobId: string) => Promise<JobResponse>>()

vi.mock('../api/jobs', () => ({
  fetchJob: (jobId: string) => fetchJobMock(jobId),
}))

function createJob(state: JobState): Job {
  const now = '2026-02-24T00:00:00Z'
  return {
    id: 'job-1',
    type: 'wol',
    state,
    payload: null,
    result: null,
    error: null,
    created_at: now,
    started_at: now,
    finished_at: state === 'succeeded' || state === 'failed' ? now : null,
    updated_at: now,
  }
}

describe('useJobTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchJobMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tracks job until succeeded and triggers terminal refresh', async () => {
    const onTerminal = vi.fn().mockResolvedValue(undefined)
    fetchJobMock
      .mockResolvedValueOnce({ job: createJob('running') })
      .mockResolvedValueOnce({ job: createJob('succeeded') })

    const { result } = renderHook(() => useJobTracker({ onTerminal }))

    await act(async () => {
      const tracking = result.current.trackJob('job-1', 'WOL送信')
      await vi.advanceTimersByTimeAsync(2000)
      await tracking
    })

    expect(fetchJobMock).toHaveBeenCalledTimes(2)
    expect(onTerminal).toHaveBeenCalledTimes(1)
    expect(result.current.jobs[0]).toMatchObject({
      id: 'job-1',
      state: 'succeeded',
      label: 'WOL送信',
    })
  })

  it('marks job as failed when fetchJob throws error', async () => {
    const onTerminal = vi.fn().mockResolvedValue(undefined)
    fetchJobMock.mockRejectedValueOnce(new Error('network error'))

    const { result } = renderHook(() => useJobTracker({ onTerminal }))

    await act(async () => {
      const tracking = result.current.trackJob('job-1', 'WOL送信')
      await vi.advanceTimersByTimeAsync(1000)
      await tracking
    })

    expect(result.current.jobs[0]?.state).toBe('failed')
    expect(result.current.jobs[0]?.error).toContain('network error')
    expect(onTerminal).not.toHaveBeenCalled()
  })

  it('marks job as failed on timeout after polling limit', async () => {
    const onTerminal = vi.fn().mockResolvedValue(undefined)
    fetchJobMock.mockResolvedValue({ job: createJob('running') })

    const { result } = renderHook(() => useJobTracker({ onTerminal }))

    await act(async () => {
      const tracking = result.current.trackJob('job-1', 'WOL送信')
      await vi.advanceTimersByTimeAsync(30000)
      await tracking
    })

    expect(fetchJobMock).toHaveBeenCalledTimes(30)
    expect(result.current.jobs[0]?.state).toBe('failed')
    expect(result.current.jobs[0]?.error).toBe('ジョブ監視がタイムアウトしました')
    expect(onTerminal).not.toHaveBeenCalled()
  })
})

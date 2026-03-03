import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import JobQueue from './JobQueue'

describe('JobQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-28T12:00:10Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows elapsed time while job is running', async () => {
    render(
      <JobQueue
        jobs={[
          {
            id: 'job-1',
            state: 'running',
            type: 'wol',
            label: 'WOL送信',
            started_at: '2026-02-28T12:00:00Z',
            updated_at: '2026-02-28T12:00:10Z',
          },
        ]}
      />,
    )

    expect(screen.getByText('経過: 10s')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(screen.getByText('経過: 12s')).toBeInTheDocument()
  })

  it('does not show elapsed time for queued job', () => {
    render(
      <JobQueue
        jobs={[
          {
            id: 'job-2',
            state: 'queued',
            type: 'status_refresh_all',
            label: '全体ステータス更新',
            updated_at: '2026-02-28T12:00:10Z',
          },
        ]}
      />,
    )

    expect(screen.queryByText(/経過:/)).not.toBeInTheDocument()
  })
})

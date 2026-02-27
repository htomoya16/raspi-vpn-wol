import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Pc } from '../types/models'
import UptimePanel from './UptimePanel'

const getPcUptimeSummary = vi.fn()
const getPcWeeklyTimeline = vi.fn()

vi.mock('../api/pcs', () => ({
  getPcUptimeSummary: (...args: unknown[]) => getPcUptimeSummary(...args),
  getPcWeeklyTimeline: (...args: unknown[]) => getPcWeeklyTimeline(...args),
}))

function createPc(overrides: Partial<Pc> = {}): Pc {
  return {
    id: 'pc-1',
    name: 'Main PC',
    mac: 'AA:BB:CC:DD:EE:FF',
    ip: '192.168.10.10',
    tags: ['desk'],
    note: 'main machine',
    status: 'online',
    last_seen_at: '2026-02-24T00:00:00Z',
    created_at: '2026-02-24T00:00:00Z',
    updated_at: '2026-02-24T00:00:00Z',
    ...overrides,
  }
}

describe('UptimePanel', () => {
  beforeEach(() => {
    getPcUptimeSummary.mockReset()
    getPcWeeklyTimeline.mockReset()
    window.localStorage.removeItem('uptime:mock')
  })

  it('renders summary and weekly timeline from API responses', async () => {
    getPcUptimeSummary.mockResolvedValue({
      pc_id: 'pc-1',
      from: '2026-02-01',
      to: '2026-02-02',
      bucket: 'day',
      tz: 'Asia/Tokyo',
      items: [
        {
          label: '2026-02-01',
          period_start: '2026-02-01',
          period_end: '2026-02-01',
          online_seconds: 7200,
          online_ratio: 0.0833,
        },
      ],
    })
    getPcWeeklyTimeline.mockResolvedValue({
      pc_id: 'pc-1',
      week_start: '2026-02-23',
      week_end: '2026-03-01',
      tz: 'Asia/Tokyo',
      days: [
        {
          date: '2026-02-23',
          online_seconds: 7200,
          intervals: [
            {
              start: '01:00',
              end: '03:00',
              duration_seconds: 7200,
            },
          ],
        },
      ],
    })

    render(
      <UptimePanel
        pcs={[createPc()]}
        selectedPcId="pc-1"
        onSelectPc={vi.fn()}
      />,
    )

    await waitFor(() => expect(getPcUptimeSummary).toHaveBeenCalled())
    await waitFor(() => expect(getPcWeeklyTimeline).toHaveBeenCalled())

    expect(screen.getByText('オンライン集計グラフ')).toBeInTheDocument()
    expect(screen.getAllByText('2.0h').length).toBeGreaterThan(0)
    expect(screen.getByTitle(/2026-02-23 01:00 - 03:00/)).toBeInTheDocument()
  })

  it('falls back to first pc when selected id is invalid', async () => {
    getPcUptimeSummary.mockResolvedValue({
      pc_id: 'pc-1',
      from: '2026-02-01',
      to: '2026-02-01',
      bucket: 'day',
      tz: 'Asia/Tokyo',
      items: [],
    })
    getPcWeeklyTimeline.mockResolvedValue({
      pc_id: 'pc-1',
      week_start: '2026-02-23',
      week_end: '2026-03-01',
      tz: 'Asia/Tokyo',
      days: [],
    })

    render(
      <UptimePanel
        pcs={[createPc()]}
        selectedPcId="not-found"
        onSelectPc={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(getPcUptimeSummary).toHaveBeenCalledWith(
        'pc-1',
        expect.objectContaining({
          bucket: 'day',
          tz: 'Asia/Tokyo',
        }),
      )
    })

    expect(screen.getByLabelText('対象PC')).toHaveValue('pc-1')
  })

  it('changes week and shows API error when fetch fails', async () => {
    const user = userEvent.setup()
    getPcUptimeSummary.mockResolvedValueOnce({
      pc_id: 'pc-1',
      from: '2026-02-01',
      to: '2026-02-01',
      bucket: 'day',
      tz: 'Asia/Tokyo',
      items: [],
    })
    getPcWeeklyTimeline.mockResolvedValue({
      pc_id: 'pc-1',
      week_start: '2026-02-23',
      week_end: '2026-03-01',
      tz: 'Asia/Tokyo',
      days: [],
    })
    getPcUptimeSummary.mockRejectedValueOnce(new Error('uptime summary failed'))

    render(
      <UptimePanel
        pcs={[createPc()]}
        selectedPcId="pc-1"
        onSelectPc={vi.fn()}
      />,
    )

    await waitFor(() => expect(getPcUptimeSummary).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'オンライン集計を前へ' }))

    await waitFor(() => {
      expect(getPcUptimeSummary).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('uptime summary failed')).toBeInTheDocument()
  })

  it('uses mock data when mock toggle is enabled', async () => {
    if (!import.meta.env.DEV) {
      render(
        <UptimePanel
          pcs={[createPc()]}
          selectedPcId="pc-1"
          onSelectPc={vi.fn()}
        />,
      )
      expect(screen.queryByRole('button', { name: /モック表示:/ })).not.toBeInTheDocument()
      return
    }

    const user = userEvent.setup()
    getPcUptimeSummary.mockResolvedValue({
      pc_id: 'pc-1',
      from: '2026-02-01',
      to: '2026-02-01',
      bucket: 'day',
      tz: 'Asia/Tokyo',
      items: [],
    })
    getPcWeeklyTimeline.mockResolvedValue({
      pc_id: 'pc-1',
      week_start: '2026-02-23',
      week_end: '2026-03-01',
      tz: 'Asia/Tokyo',
      days: [],
    })

    render(
      <UptimePanel
        pcs={[createPc()]}
        selectedPcId="pc-1"
        onSelectPc={vi.fn()}
      />,
    )

    await waitFor(() => expect(getPcUptimeSummary).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'モック表示: OFF' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'モック表示: ON' })).toBeInTheDocument()
    })
    expect(window.localStorage.getItem('uptime:mock')).toBe('1')
  })
})

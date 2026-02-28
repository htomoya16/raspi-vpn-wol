import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { LogEntry } from '../types/models'
import LogsPanel from './LogsPanel'

function createLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 1,
    pc_id: 'pc-1',
    action: 'status',
    ok: true,
    message: 'status checked',
    details: { source: 'manual' },
    created_at: '2026-02-24T00:00:00Z',
    ...overrides,
  }
}

describe('LogsPanel', () => {
  it('opens front focus view when pressing header icon button', async () => {
    const user = userEvent.setup()
    render(
      <LogsPanel
        items={[createLogEntry()]}
        loading={false}
        error=""
        onReload={vi.fn()}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'ログを前面表示' }))
    const focusDialog = screen.getByRole('dialog', { name: '操作ログ' })
    expect(focusDialog).toBeInTheDocument()
    expect(within(focusDialog).queryByRole('button', { name: 'ログ消去' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '前面表示を閉じる' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '操作ログ' })).not.toBeInTheDocument()
    })
  })

  it('expands and closes detail row by tapping log row', async () => {
    const user = userEvent.setup()
    render(
      <LogsPanel
        items={[createLogEntry()]}
        loading={false}
        error=""
        onReload={vi.fn()}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.queryByText(/"source": "manual"/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '詳細を表示' }))
    expect(screen.getByText(/"source": "manual"/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '詳細を閉じる' }))
    expect(screen.queryByText(/"source": "manual"/)).not.toBeInTheDocument()
  })

  it('shows clear confirmation dialog and clears logs', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn().mockResolvedValue(undefined)

    render(
      <LogsPanel
        items={[createLogEntry()]}
        loading={false}
        error=""
        onReload={vi.fn()}
        onClear={onClear}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'ログ消去' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('ログを消去しますか？')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '消去する' }))

    await waitFor(() => {
      expect(onClear).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('groups log rows by job id from details', () => {
    render(
      <LogsPanel
        items={[
          createLogEntry({
            id: 1,
            job_id: 'job-1',
            details: { source: 'wol' },
            action: 'wol',
            message: 'first',
          }),
          createLogEntry({
            id: 2,
            details: { source: 'manual' },
            message: 'second',
          }),
          createLogEntry({
            id: 3,
            job_id: 'job-1',
            details: { source: 'status' },
            action: 'status',
            ok: false,
            message: 'third',
          }),
        ]}
        loading={false}
        error=""
        onReload={vi.fn()}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    const jobGroupButton = screen.getByRole('button', { name: /ID: job-1/ })
    expect(within(jobGroupButton).getByText('WOL送信')).toBeInTheDocument()
    expect(within(jobGroupButton).getByText('OK 1')).toBeInTheDocument()
    expect(within(jobGroupButton).getByText('NG 1')).toBeInTheDocument()
    expect(within(jobGroupButton).getByText('2件')).toBeInTheDocument()
    expect(within(jobGroupButton).queryByText('複合処理')).not.toBeInTheDocument()
    expect(screen.getByText('通常ログ')).toBeInTheDocument()
  })

  it('toggles grouped logs open and close with group header', async () => {
    const user = userEvent.setup()

    render(
      <LogsPanel
        items={[
          createLogEntry({
            id: 1,
            job_id: 'job-1',
            details: { source: 'wol' },
            message: 'grouped message',
          }),
          createLogEntry({
            id: 2,
            details: { source: 'manual' },
            message: 'normal message',
          }),
        ]}
        loading={false}
        error=""
        onReload={vi.fn()}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByText('grouped message')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /ID: job-1/ }))
    expect(screen.queryByText('grouped message')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /ID: job-1/ }))
    expect(screen.getByText('grouped message')).toBeInTheDocument()
  })

  it('orders groups by latest log id so newest group appears first', () => {
    render(
      <LogsPanel
        items={[
          createLogEntry({ id: 10, job_id: 'job-old', action: 'status', message: 'older grouped' }),
          createLogEntry({ id: 12, action: 'status', message: 'normal newer' }),
          createLogEntry({ id: 11, job_id: 'job-old', action: 'wol', message: 'older grouped followup' }),
        ]}
        loading={false}
        error=""
        onReload={vi.fn()}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    const groupButtons = screen.getAllByRole('button', {
      name: /OK \d.*NG \d.*件/,
    })
    expect(groupButtons[0]).toHaveTextContent('通常ログ')
    expect(groupButtons[1]).toHaveTextContent('ID: job-old')
  })

  it('splits normal logs into separate groups when interrupted by job logs', () => {
    render(
      <LogsPanel
        items={[
          createLogEntry({ id: 20, action: 'status', message: 'normal latest' }),
          createLogEntry({ id: 19, job_id: 'job-a', action: 'wol', message: 'job middle' }),
          createLogEntry({ id: 18, action: 'status', message: 'normal older' }),
        ]}
        loading={false}
        error=""
        onReload={vi.fn()}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    const groupButtons = screen.getAllByRole('button', {
      name: /OK \d.*NG \d.*件/,
    })
    expect(groupButtons).toHaveLength(3)
    expect(groupButtons[0]).toHaveTextContent('通常ログ')
    expect(groupButtons[1]).toHaveTextContent('ID: job-a')
    expect(groupButtons[2]).toHaveTextContent('通常ログ')
  })
})

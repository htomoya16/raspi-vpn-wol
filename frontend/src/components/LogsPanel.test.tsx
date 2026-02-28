import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { LogEntry } from '../types/models'
import { createLogEntryFactory } from '../test/factories'
import LogsPanel from './LogsPanel'

function createLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return createLogEntryFactory(overrides)
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
            action: 'pc_delete',
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
            action: 'wol',
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

  it('shows periodic status logs as collapsed by default', async () => {
    const user = userEvent.setup()
    render(
      <LogsPanel
        items={[
          createLogEntry({
            id: 30,
            job_id: 'job-status-1',
            action: 'status',
            event_kind: 'periodic_status',
            message: 'status by scheduler',
          }),
        ]}
        loading={false}
        error=""
        onReload={vi.fn()}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getAllByText('定期ステータス確認').length).toBeGreaterThan(0)
    expect(screen.queryByText('status by scheduler')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /定期ステータス確認/ }))
    expect(screen.getByText('status by scheduler')).toBeInTheDocument()
  })

  it('merges periodic status logs across different job ids into one group', () => {
    render(
      <LogsPanel
        items={[
          createLogEntry({
            id: 40,
            job_id: 'job-status-1',
            action: 'status',
            event_kind: 'periodic_status',
            ok: true,
            message: 'scheduled status 1',
          }),
          createLogEntry({
            id: 39,
            job_id: 'job-status-2',
            action: 'status',
            event_kind: 'periodic_status',
            ok: false,
            message: 'scheduled status 2',
          }),
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
    expect(groupButtons).toHaveLength(1)
    expect(groupButtons[0]).toHaveTextContent('定期ステータス確認')
    expect(groupButtons[0]).toHaveTextContent('定期ジョブ 2件')
    expect(groupButtons[0]).toHaveTextContent('OK 1')
    expect(groupButtons[0]).toHaveTextContent('NG 1')
    expect(groupButtons[0]).toHaveTextContent('2件')
  })

  it('shows manual status-refresh job as 全体ステータス更新 instead of periodic group', () => {
    render(
      <LogsPanel
        items={[
          createLogEntry({
            id: 50,
            job_id: 'job-status-manual',
            action: 'status',
            ok: true,
            message: 'manual refresh all',
          }),
        ]}
        loading={false}
        error=""
        onReload={vi.fn()}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.queryByText('定期ステータス確認')).not.toBeInTheDocument()
    const groupButton = screen.getByRole('button', { name: /ID: job-status-manual/ })
    expect(groupButton).toHaveTextContent('全体ステータス更新')
    expect(screen.getByText('manual refresh all')).toBeInTheDocument()
  })
})

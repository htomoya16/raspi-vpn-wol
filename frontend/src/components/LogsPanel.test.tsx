import { render, screen, waitFor } from '@testing-library/react'
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

    await user.click(screen.getByText('status checked'))
    expect(screen.getByText(/"source": "manual"/)).toBeInTheDocument()

    await user.click(screen.getByText('status checked'))
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
})

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { LogEntry } from '../types/models'
import { createLogEntryFactory } from '../test/factories'
import LogsPanel from './LogsPanel'

function createLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return createLogEntryFactory(overrides)
}

function mockMobileViewport() {
  const originalMatchMedia = window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query === '(max-width: 760px)',
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
  return () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    })
  }
}

function mockWindowScrollMetrics({
  innerHeight,
  scrollY,
  scrollHeight,
}: {
  innerHeight: number
  scrollY: number
  scrollHeight: number
}) {
  const originalInnerHeight = window.innerHeight
  const originalScrollY = window.scrollY
  const originalScrollHeight = document.documentElement.scrollHeight

  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: innerHeight,
  })
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: scrollY,
  })
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  })

  return () => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    })
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: originalScrollY,
    })
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: originalScrollHeight,
    })
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

  it('splits periodic status logs into separate groups when interrupted by other logs', () => {
    render(
      <LogsPanel
        items={[
          createLogEntry({
            id: 40,
            job_id: 'job-status-1',
            action: 'status',
            event_kind: 'periodic_status',
            ok: true,
            message: 'scheduled status latest',
          }),
          createLogEntry({
            id: 39,
            action: 'pc_upsert',
            message: 'manual update between periodic logs',
          }),
          createLogEntry({
            id: 38,
            job_id: 'job-status-2',
            action: 'status',
            event_kind: 'periodic_status',
            ok: false,
            message: 'scheduled status older',
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
    expect(groupButtons).toHaveLength(3)
    expect(groupButtons[0]).toHaveTextContent('定期ステータス確認')
    expect(groupButtons[0]).toHaveTextContent('定期ジョブ 1件')
    expect(groupButtons[1]).toHaveTextContent('通常ログ')
    expect(groupButtons[2]).toHaveTextContent('定期ステータス確認')
    expect(groupButtons[2]).toHaveTextContent('定期ジョブ 1件')
    expect(groupButtons[0]).toHaveTextContent('OK 1')
    expect(groupButtons[0]).toHaveTextContent('NG 0')
    expect(groupButtons[0]).toHaveTextContent('1件')
    expect(groupButtons[2]).toHaveTextContent('OK 0')
    expect(groupButtons[2]).toHaveTextContent('NG 1')
    expect(groupButtons[2]).toHaveTextContent('1件')
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

  it('shows load more button on desktop and calls onLoadMore', async () => {
    const user = userEvent.setup()
    const onLoadMore = vi.fn().mockResolvedValue(undefined)
    render(
      <LogsPanel
        items={[createLogEntry()]}
        loading={false}
        loadingMore={false}
        hasMore
        error=""
        onReload={vi.fn()}
        onLoadMore={onLoadMore}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'さらに表示（200件）' }))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('keeps periodic status group expanded after prepending newer periodic logs', async () => {
    const user = userEvent.setup()
    const existingItem = createLogEntry({
      id: 70,
      job_id: 'job-status-70',
      action: 'status',
      event_kind: 'periodic_status',
      message: 'existing periodic',
    })
    const newerItem = createLogEntry({
      id: 71,
      job_id: 'job-status-71',
      action: 'status',
      event_kind: 'periodic_status',
      message: 'newer periodic',
    })

    const { rerender } = render(
      <LogsPanel
        items={[existingItem]}
        loading={false}
        error=""
        onReload={vi.fn()}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(screen.getByRole('button', { name: /定期ステータス確認/ }))
    expect(screen.getByText('existing periodic')).toBeInTheDocument()

    rerender(
      <LogsPanel
        items={[newerItem, existingItem]}
        loading={false}
        error=""
        onReload={vi.fn()}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByText('newer periodic')).toBeInTheDocument()
    expect(screen.getByText('existing periodic')).toBeInTheDocument()
  })

  it('keeps periodic status group expanded after appending older periodic logs', async () => {
    const user = userEvent.setup()
    const latestItem = createLogEntry({
      id: 90,
      job_id: 'job-status-90',
      action: 'status',
      event_kind: 'periodic_status',
      message: 'latest periodic',
    })
    const olderItem = createLogEntry({
      id: 89,
      job_id: 'job-status-89',
      action: 'status',
      event_kind: 'periodic_status',
      message: 'older periodic',
    })

    const { rerender } = render(
      <LogsPanel
        items={[latestItem]}
        loading={false}
        error=""
        onReload={vi.fn()}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(screen.getByRole('button', { name: /定期ステータス確認/ }))
    expect(screen.getByText('latest periodic')).toBeInTheDocument()

    rerender(
      <LogsPanel
        items={[latestItem, olderItem]}
        loading={false}
        error=""
        onReload={vi.fn()}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByText('latest periodic')).toBeInTheDocument()
    expect(screen.getByText('older periodic')).toBeInTheDocument()
  })

  it('keeps an expanded periodic group open when periodic keys shift with new logs', async () => {
    const user = userEvent.setup()
    const initialTopA = createLogEntry({
      id: 220,
      job_id: 'job-status-220',
      action: 'status',
      event_kind: 'periodic_status',
      ok: true,
      message: 'top periodic A',
    })
    const initialTopB = createLogEntry({
      id: 219,
      job_id: 'job-status-219',
      action: 'status',
      event_kind: 'periodic_status',
      ok: true,
      message: 'top periodic B',
    })
    const initialMiddleA = createLogEntry({
      id: 150,
      job_id: 'job-status-150',
      action: 'status',
      event_kind: 'periodic_status',
      ok: true,
      message: 'target periodic keep-open',
    })
    const initialMiddleB = createLogEntry({
      id: 149,
      job_id: 'job-status-149',
      action: 'status',
      event_kind: 'periodic_status',
      ok: false,
      message: 'target periodic older',
    })
    const initialBottom = createLogEntry({
      id: 42,
      job_id: 'job-status-42',
      action: 'status',
      event_kind: 'periodic_status',
      ok: false,
      message: 'bottom periodic',
    })
    const separatorTop = createLogEntry({
      id: 218,
      action: 'pc_upsert',
      message: 'separator top',
    })
    const separatorBottom = createLogEntry({
      id: 148,
      action: 'pc_upsert',
      message: 'separator bottom',
    })

    const { rerender } = render(
      <LogsPanel
        items={[
          initialTopA,
          initialTopB,
          separatorTop,
          initialMiddleA,
          initialMiddleB,
          separatorBottom,
          initialBottom,
        ]}
        loading={false}
        error=""
        onReload={vi.fn()}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(screen.getByRole('button', { name: /定期ステータス確認.*OK 1.*NG 1.*2件/ }))
    expect(screen.getByText('target periodic keep-open')).toBeInTheDocument()
    expect(screen.getByText('target periodic older')).toBeInTheDocument()

    const newTopPeriodic = createLogEntry({
      id: 300,
      job_id: 'job-status-300',
      action: 'status',
      event_kind: 'periodic_status',
      ok: false,
      message: 'new top periodic',
    })
    const newTopSeparator = createLogEntry({
      id: 299,
      action: 'pc_upsert',
      message: 'new top separator',
    })

    rerender(
      <LogsPanel
        items={[
          newTopPeriodic,
          newTopSeparator,
          initialTopA,
          initialTopB,
          separatorTop,
          initialMiddleA,
          separatorBottom,
        ]}
        loading={false}
        error=""
        onReload={vi.fn()}
        onClear={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByText('target periodic keep-open')).toBeInTheDocument()
  })

  it('does not load more on mobile when only scrolling near bottom of logs sheet', async () => {
    const restoreViewport = mockMobileViewport()
    const restoreMetrics = mockWindowScrollMetrics({
      innerHeight: 800,
      scrollY: 376,
      scrollHeight: 1200,
    })
    const onLoadMore = vi.fn().mockResolvedValue(undefined)

    try {
      render(
        <LogsPanel
          items={[
            createLogEntry({
              id: 80,
              job_id: 'job-status-80',
              action: 'status',
              event_kind: 'periodic_status',
              message: 'periodic collapsed',
            }),
          ]}
          loading={false}
          loadingMore={false}
          hasMore
          error=""
          onReload={vi.fn()}
          onLoadMore={onLoadMore}
          onClear={vi.fn().mockResolvedValue(undefined)}
        />,
      )

      expect(screen.getByText('下端でさらに下へ引っ張ると、さらに200件読み込みます')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'さらに表示（200件）' })).not.toBeInTheDocument()

      fireEvent.scroll(window)
      fireEvent.scroll(window)
      fireEvent.scroll(window)
      expect(onLoadMore).toHaveBeenCalledTimes(0)
    } finally {
      restoreMetrics()
      restoreViewport()
    }
  })

  it('loads more only once per touch gesture at bottom', async () => {
    const restoreViewport = mockMobileViewport()
    const restoreMetrics = mockWindowScrollMetrics({
      innerHeight: 800,
      scrollY: 376,
      scrollHeight: 1200,
    })
    const onLoadMore = vi.fn().mockResolvedValue(undefined)

    try {
      render(
        <LogsPanel
          items={[
            createLogEntry({
              id: 82,
              job_id: 'job-status-82',
              action: 'status',
              event_kind: 'periodic_status',
              message: 'periodic collapsed',
            }),
          ]}
          loading={false}
          loadingMore={false}
          hasMore
          error=""
          onReload={vi.fn()}
          onLoadMore={onLoadMore}
          onClear={vi.fn().mockResolvedValue(undefined)}
        />,
      )

      fireEvent.touchStart(window, { touches: [{ clientY: 220 }] })
      fireEvent.touchMove(window, { touches: [{ clientY: 180 }] })
      fireEvent.touchMove(window, { touches: [{ clientY: 140 }] })
      fireEvent.scroll(window)
      fireEvent.touchEnd(window)

      await waitFor(() => {
        expect(onLoadMore).toHaveBeenCalledTimes(1)
      })
    } finally {
      restoreMetrics()
      restoreViewport()
    }
  })

  it('loads more on mobile when swiping at bottom even without scrollable range', async () => {
    const restoreViewport = mockMobileViewport()
    const restoreMetrics = mockWindowScrollMetrics({
      innerHeight: 800,
      scrollY: 0,
      scrollHeight: 800,
    })
    const onLoadMore = vi.fn().mockResolvedValue(undefined)

    try {
      render(
        <LogsPanel
          items={[
            createLogEntry({
              id: 81,
              job_id: 'job-status-81',
              action: 'status',
              event_kind: 'periodic_status',
              message: 'periodic collapsed',
            }),
          ]}
          loading={false}
          loadingMore={false}
          hasMore
          error=""
          onReload={vi.fn()}
          onLoadMore={onLoadMore}
          onClear={vi.fn().mockResolvedValue(undefined)}
        />,
      )

      fireEvent.touchStart(window, { touches: [{ clientY: 220 }] })
      fireEvent.touchMove(window, { touches: [{ clientY: 180 }] })
      fireEvent.touchEnd(window)

      await waitFor(() => {
        expect(onLoadMore).toHaveBeenCalledTimes(1)
      })
    } finally {
      restoreMetrics()
      restoreViewport()
    }
  })
})

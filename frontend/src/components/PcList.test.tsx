import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Pc, PcFilterState } from '../types/models'
import { createPcFactory } from '../test/factories'
import PcList, { type PcListProps } from './PcList'

function createPc(overrides: Partial<Pc> = {}): Pc {
  return createPcFactory(overrides)
}

function renderPcList(overrides: Partial<PcListProps> = {}) {
  const filters: PcFilterState = { q: '', status: '' }
  const baseProps: PcListProps = {
    items: [createPc()],
    loading: false,
    error: '',
    filters,
    appliedFilters: filters,
    onFilterChange: vi.fn(),
    onApplyFilters: vi.fn(),
    onClearFilters: vi.fn(),
    onReload: vi.fn(),
    onRefreshStatus: vi.fn(),
    onSendWol: vi.fn(),
    onShutdown: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockImplementation(async () => createPc()),
    busyById: {},
    rowErrorById: {},
    lastSyncedAt: '2026-02-24T00:00:00Z',
    ...overrides,
  }

  render(<PcList {...baseProps} />)
  return baseProps
}

describe('PcList', () => {
  it('disables shutdown for unconfigured and offline PCs', () => {
    renderPcList({ items: [createPc({ id: 'pc-1', status: 'online' }), createPc({ id: 'pc-2', status: 'offline', shutdown: { configured: true, reason: null } })] })
    expect(screen.getAllByRole('button', { name: 'シャットダウン' })).toHaveLength(2)
    for (const button of screen.getAllByRole('button', { name: 'シャットダウン' })) expect(button).toBeDisabled()
    expect(screen.getByText('SSH未設定')).toBeInTheDocument()
    expect(screen.getByText('オンライン時のみ操作できます')).toBeInTheDocument()
  })

  it('requires confirmation for only the selected PC and supports cancellation', async () => {
    const user = userEvent.setup()
    const onShutdown = vi.fn().mockResolvedValue(undefined)
    renderPcList({ onShutdown, items: [createPc({ status: 'online', shutdown: { configured: true, reason: null } })] })
    await user.click(screen.getByRole('button', { name: 'シャットダウン' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Main PC')
    expect(screen.getByRole('dialog')).toHaveTextContent('pc-1')
    expect(onShutdown).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'キャンセル' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onShutdown).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'シャットダウン' }))
    await user.click(screen.getByRole('button', { name: 'シャットダウンする' }))
    expect(onShutdown).toHaveBeenCalledExactlyOnceWith('pc-1')
  })

  it('disables both power actions while shutdown is running', () => {
    renderPcList({ busyById: { 'pc-1': { shutdown: true } }, items: [createPc({ status: 'online', shutdown: { configured: true, reason: null } })] })
    expect(screen.getByRole('button', { name: '起動' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /停止確認中/ })).toBeDisabled()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows empty-state message when no pc exists', () => {
    renderPcList({ items: [] })
    expect(screen.getByText('PCがまだ登録されていません。')).toBeInTheDocument()
  })

  it('shows filtered empty-state message when filters are active', () => {
    renderPcList({
      items: [],
      appliedFilters: { q: 'pc-1', status: '' },
    })
    expect(screen.getByText('該当するPCがありません。')).toBeInTheDocument()
  })

  it('keeps list layout while loading without showing blocking overlay', () => {
    renderPcList({ loading: true })
    expect(screen.getByText('Main PC')).toBeInTheDocument()
    expect(screen.queryByText(/PC一覧を読み込み中/)).not.toBeInTheDocument()
  })

  it('opens detail dialog when row is tapped', async () => {
    const user = userEvent.setup()
    renderPcList()

    await user.click(screen.getByText('Main PC'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('MAC')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'SSH設定' })).not.toBeInTheDocument()
  })

  it('shows SSH settings in the PC detail only for administrators', async () => {
    const user = userEvent.setup()
    renderPcList({ canManageSsh: true })
    await user.click(screen.getByText('Main PC'))
    expect(screen.getByRole('button', { name: 'SSH設定' })).toBeInTheDocument()
  })

  it('shows validation message when editing with empty required fields', async () => {
    const user = userEvent.setup()
    renderPcList()

    await user.click(screen.getByText('Main PC'))
    await user.click(screen.getByRole('button', { name: '編集' }))

    const nameInput = screen.getByLabelText(/表示名/)
    await user.clear(nameInput)
    expect(nameInput).toHaveValue('')

    await user.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByText(/表示名・MACアドレス・IPアドレスは必須です。/)).toBeInTheDocument()
  })

  it('opens delete confirmation and calls delete handler', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)
    renderPcList({ onDelete })

    await user.click(screen.getByText('Main PC'))
    await user.click(screen.getByRole('button', { name: '削除' }))
    expect(screen.getByText('PCを削除しますか？')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '削除する' }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('pc-1'))
  })
})
